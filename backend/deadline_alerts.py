from flask import request, jsonify
from datetime import datetime, timedelta
from db import collection

# Endpoint to get documents with near deadlines and not completed
# Returns documents with status != 'Completed' and deadline within 7 days from today

def register_deadline_alerts_route(app):
    @app.route("/deadline-alerts", methods=["GET", "OPTIONS"])
    def deadline_alerts():
        if request.method == "OPTIONS":
            return "", 204
        try:
            today = datetime.utcnow()
            near = today + timedelta(days=7)
            # Only consider documents with a real deadline (not 'Not specified')
            docs = list(collection.find({
                "status": {"$ne": "Completed"},
                "deadline": {"$ne": "Not specified"}
            }))
            # Parse and filter deadlines
            result = []
            for doc in docs:
                try:
                    deadline_dt = datetime.strptime(doc["deadline"], "%Y-%m-%d")
                    if today <= deadline_dt <= near:
                        doc["_id"] = str(doc["_id"])
                        result.append(doc)
                except Exception:
                    continue
            return jsonify(result), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
