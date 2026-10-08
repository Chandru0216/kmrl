import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)

try:
    import boto3
    HAS_BOTO3 = True
except Exception:
    HAS_BOTO3 = False


def _publish_sqs_message(sqs_client, queue_url, message_body, attributes=None):
    return sqs_client.send_message(QueueUrl=queue_url, MessageBody=message_body, MessageAttributes=attributes or {})


def _publish_sns_message(sns_client, topic_arn, message, attributes=None):
    return sns_client.publish(TopicArn=topic_arn, Message=message, MessageAttributes=attributes or {})


def apply_dual_dispatch(doc_id, filename, routing_details, collection, multi_dispatch_threshold=None):
    """Persist routing decisions and publish per-recipient messages.

    - `routing_details` is expected as a list of {recipient, confidence, priority}.
    - If boto3 and env vars are configured (`SQS_QUEUE_URL` or `SNS_TOPIC_ARN`), publish messages.
    - Always write `routing_decisions` array into the document record.
    """
    if not routing_details:
        logging.info("No routing details provided; skipping dispatch.")
        return None

    # Compose routing_decisions entries with timestamps
    decisions = []
    for rd in routing_details:
        decisions.append({
            "recipient": rd.get("recipient"),
            "confidence": float(rd.get("confidence", 0.0)),
            "priority": float(rd.get("priority", 0.0)),
            "dispatched_at": datetime.utcnow()
        })

    # Update DB record
    try:
        collection.update_one({"_id": collection._get_object_id(doc_id) if hasattr(collection, '_get_object_id') else _maybe_objectid(doc_id)}, {"$set": {"routing_decisions": decisions}})
    except Exception:
        # fallback: try matching by string _id
        collection.update_one({"_id": doc_id}, {"$set": {"routing_decisions": decisions}})

    # Publish messages if AWS is available and configured
    sqs_url = os.environ.get("SQS_QUEUE_URL")
    sns_arn = os.environ.get("SNS_TOPIC_ARN")

    if HAS_BOTO3 and (sqs_url or sns_arn):
        session_kwargs = {}
        aws_region = os.environ.get("AWS_REGION")
        if aws_region:
            session_kwargs['region_name'] = aws_region

        try:
            if sqs_url:
                sqs = boto3.client('sqs', **session_kwargs)
            else:
                sqs = None

            if sns_arn:
                sns = boto3.client('sns', **session_kwargs)
            else:
                sns = None

            for rd in decisions:
                payload = {
                    "doc_id": str(doc_id),
                    "filename": filename,
                    "recipient": rd['recipient'],
                    "confidence": rd['confidence'],
                    "priority": rd['priority'],
                    "dispatched_at": rd['dispatched_at'].isoformat()
                }
                # Prefer SQS if configured
                if sqs:
                    try:
                        _publish_sqs_message(sqs, sqs_url, str(payload))
                    except Exception as e:
                        logging.warning(f"SQS publish failed: {e}")
                if sns:
                    try:
                        sns.publish(TopicArn=sns_arn, Message=str(payload))
                    except Exception as e:
                        logging.warning(f"SNS publish failed: {e}")

        except Exception as e:
            logging.warning(f"AWS publish failed: {e}")

    else:
        logging.info("AWS SDK not available or no queue/topic configured — routing decisions saved locally.")

    return decisions


def _maybe_objectid(doc_id):
    # try to convert to ObjectId if running with pymongo; otherwise return the string
    try:
        from bson import ObjectId
        return ObjectId(doc_id)
    except Exception:
        return doc_id
