"""
Source Integration Module
Handles automatic document imports from various sources:
- Email (IMAP)
- Maximo (via API)
- SharePoint (via Microsoft Graph API)
- FTP/SFTP
- Cloud Storage (Google Drive, OneDrive, Dropbox)
"""

import logging
import os
import hashlib
import email
from email.header import decode_header, make_header
from datetime import datetime
from typing import List, Dict
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)


class SourceConnector(ABC):
    """Abstract base class for document sources"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def connect(self):
        """Connect to source"""
        pass
    
    @abstractmethod
    def fetch_documents(self) -> List[Dict]:
        """Fetch documents from source"""
        pass
    
    @abstractmethod
    def disconnect(self):
        """Disconnect from source"""
        pass


class EmailConnector(SourceConnector):
    """Import documents from email attachments"""
    
    def connect(self):
        """Connect to email server (IMAP)"""
        try:
            import imaplib
            self.client = imaplib.IMAP4_SSL(self.config.get("imap_host", "imap.gmail.com"))
            self.client.login(self.config.get("email"), self.config.get("password"))
            self.logger.info("Connected to email server")
        except Exception as e:
            self.logger.error(f"Email connection failed: {e}")
            raise
    
    def fetch_documents(self) -> List[Dict]:
        """Fetch email attachments"""
        documents = []
        self.client.select("INBOX")
        status, messages = self.client.uid("search", None, "ALL")
        if status != "OK":
            raise RuntimeError("Could not search the email inbox")

        message_uids = messages[0].split()[-100:]
        for message_uid in message_uids:
            status, msg_data = self.client.uid("fetch", message_uid, "(RFC822)")
            if status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                self.logger.warning("Could not fetch email UID %s", message_uid.decode())
                continue

            msg = email.message_from_bytes(msg_data[0][1])
            message_id = msg.get("Message-ID", "").strip()
            for attachment_index, part in enumerate(msg.walk()):
                raw_filename = part.get_filename()
                if not raw_filename:
                    continue

                filename = str(make_header(decode_header(raw_filename)))
                content = part.get_payload(decode=True)
                if not content:
                    continue

                identity = f"{message_id}:{message_uid.decode()}:{attachment_index}:{filename}"
                source_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()
                documents.append({
                    "filename": filename,
                    "content": content,
                    "source": "email",
                    "source_id": source_id,
                    "message_id": message_id,
                    "sender": msg.get("From", "Unknown"),
                    "timestamp": datetime.now().isoformat(),
                    "subject": str(make_header(decode_header(msg.get("Subject", "No Subject"))))
                })

        self.logger.info("Fetched %s attachments from email", len(documents))
        return documents
    
    def disconnect(self):
        """Close email connection"""
        try:
            self.client.close()
            self.client.logout()
            self.logger.info("Disconnected from email")
        except Exception as e:
            self.logger.warning(f"Email disconnect error: {e}")


class MaximoConnector(SourceConnector):
    """Import documents from IBM Maximo"""
    
    def connect(self):
        """Connect to Maximo API"""
        try:
            import requests
            self.session = requests.Session()
            self.session.headers.update({
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.config.get('maximo_token')}"
            })
            self.base_url = self.config.get("maximo_url", "https://maximo.example.com/api")
            self.logger.info("Connected to Maximo")
        except Exception as e:
            self.logger.error(f"Maximo connection failed: {e}")
            raise
    
    def fetch_documents(self) -> List[Dict]:
        """Fetch documents from Maximo"""
        documents = []
        
        try:
            # Fetch work orders and maintenance records
            endpoints = [
                "/workorder",
                "/mxapiwodetail",
                "/mxapiwomaterial",
                "/mxapiwoskill"
            ]
            
            for endpoint in endpoints:
                try:
                    response = self.session.get(f"{self.base_url}{endpoint}")
                    if response.status_code == 200:
                        records = response.json().get("member", [])
                        
                        for record in records:
                            documents.append({
                                "filename": f"MAXIMO_{record.get('wonum', 'UNKNOWN')}.txt",
                                "content": self._format_maximo_record(record),
                                "source": "Maximo",
                                "record_type": endpoint.replace("/", ""),
                                "timestamp": datetime.now().isoformat(),
                                "category": "Technical Report"
                            })
                
                except Exception as e:
                    self.logger.warning(f"Maximo endpoint {endpoint} failed: {e}")
            
            self.logger.info(f"Fetched {len(documents)} documents from Maximo")
        
        except Exception as e:
            self.logger.error(f"Maximo fetch failed: {e}")
        
        return documents
    
    def _format_maximo_record(self, record: Dict) -> str:
        """Format Maximo record as text"""
        lines = [
            f"Work Order: {record.get('wonum', 'N/A')}",
            f"Description: {record.get('description', 'N/A')}",
            f"Status: {record.get('status', 'N/A')}",
            f"Priority: {record.get('priority', 'N/A')}",
            f"Asset: {record.get('assetnum', 'N/A')}",
            f"Location: {record.get('location', 'N/A')}",
            f"Assigned To: {record.get('assignedto', 'N/A')}",
            f"Due Date: {record.get('schedfinish', 'N/A')}",
            "",
            record.get('longdescription', '')
        ]
        return "\n".join(lines)
    
    def disconnect(self):
        """Close Maximo connection"""
        try:
            self.session.close()
            self.logger.info("Disconnected from Maximo")
        except Exception as e:
            self.logger.warning(f"Maximo disconnect error: {e}")


class SharePointConnector(SourceConnector):
    """Import documents from Microsoft SharePoint"""
    
    def connect(self):
        """Connect to SharePoint via Microsoft Graph"""
        try:
            import requests
            from requests_oauthlib import OAuth2Session
            
            client_id = self.config.get("client_id")
            client_secret = self.config.get("client_secret")
            tenant_id = self.config.get("tenant_id")
            
            token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
            
            self.session = OAuth2Session(client_id)
            token = self.session.fetch_token(
                token_url,
                client_id=client_id,
                client_secret=client_secret,
                scope=["https://graph.microsoft.com/.default"]
            )
            
            self.base_url = "https://graph.microsoft.com/v1.0"
            self.logger.info("Connected to SharePoint")
        
        except Exception as e:
            self.logger.error(f"SharePoint connection failed: {e}")
            raise
    
    def fetch_documents(self) -> List[Dict]:
        """Fetch documents from SharePoint"""
        documents = []
        
        try:
            site_id = self.config.get("site_id")
            drive_id = self.config.get("drive_id")
            
            # Fetch files from SharePoint drive
            url = f"{self.base_url}/sites/{site_id}/drives/{drive_id}/root/children"
            response = self.session.get(url)
            
            if response.status_code == 200:
                items = response.json().get("value", [])
                
                for item in items:
                    if "file" in item:
                        documents.append({
                            "filename": item.get("name", "Unknown"),
                            "source": "SharePoint",
                            "source_id": item.get("id"),
                            "timestamp": item.get("lastModifiedDateTime"),
                            "download_url": item.get("webUrl"),
                            "category": "General Document"
                        })
            
            self.logger.info(f"Fetched {len(documents)} documents from SharePoint")
        
        except Exception as e:
            self.logger.error(f"SharePoint fetch failed: {e}")
        
        return documents
    
    def disconnect(self):
        """Close SharePoint connection"""
        try:
            self.session.close()
            self.logger.info("Disconnected from SharePoint")
        except Exception as e:
            self.logger.warning(f"SharePoint disconnect error: {e}")


class FTPConnector(SourceConnector):
    """Import documents from FTP/SFTP server"""
    
    def connect(self):
        """Connect to FTP/SFTP server"""
        try:
            protocol = self.config.get("protocol", "sftp")
            
            if protocol == "sftp":
                import paramiko
                self.client = paramiko.SSHClient()
                self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                self.client.connect(
                    self.config.get("host"),
                    port=self.config.get("port", 22),
                    username=self.config.get("username"),
                    password=self.config.get("password")
                )
                self.sftp = self.client.open_sftp()
            else:
                import ftplib
                self.client = ftplib.FTP(
                    self.config.get("host"),
                    self.config.get("username"),
                    self.config.get("password")
                )
            
            self.logger.info(f"Connected to {protocol.upper()} server")
        
        except Exception as e:
            self.logger.error(f"FTP connection failed: {e}")
            raise
    
    def fetch_documents(self) -> List[Dict]:
        """Fetch documents from FTP"""
        documents = []
        
        try:
            remote_path = self.config.get("remote_path", "/")
            
            if hasattr(self, 'sftp'):
                files = self.sftp.listdir(remote_path)
            else:
                files = self.client.nlst(remote_path)
            
            for filename in files:
                if any(filename.lower().endswith(ext) for ext in ['.txt', '.pdf', '.doc', '.xlsx']):
                    documents.append({
                        "filename": filename,
                        "source": "FTP",
                        "remote_path": f"{remote_path}/{filename}",
                        "timestamp": datetime.now().isoformat(),
                        "category": "General Document"
                    })
            
            self.logger.info(f"Fetched {len(documents)} documents from FTP")
        
        except Exception as e:
            self.logger.error(f"FTP fetch failed: {e}")
        
        return documents
    
    def disconnect(self):
        """Close FTP connection"""
        try:
            if hasattr(self, 'sftp'):
                self.sftp.close()
            else:
                self.client.quit()
            self.logger.info("Disconnected from FTP")
        except Exception as e:
            self.logger.warning(f"FTP disconnect error: {e}")


class SourceIntegrationManager:
    """Manages document imports from all sources"""
    
    def __init__(self):
        self.logger = logging.getLogger("SourceIntegration")
        self.sources: Dict[str, SourceConnector] = {}
    
    def register_source(self, source_name: str, connector: SourceConnector):
        """Register a document source"""
        self.sources[source_name] = connector
        self.logger.info(f"Registered source: {source_name}")
    
    def sync_all_sources(self) -> List[Dict]:
        """Sync documents from all registered sources"""
        all_documents = []
        
        for source_name, connector in self.sources.items():
            try:
                self.logger.info(f"Syncing from {source_name}...")
                connector.connect()
                try:
                    documents = connector.fetch_documents()
                finally:
                    connector.disconnect()
                all_documents.extend(documents)
                self.logger.info(f"Successfully synced {len(documents)} documents from {source_name}")
            
            except Exception as e:
                self.logger.error(f"Failed to sync {source_name}: {e}")
        
        return all_documents
    
    def sync_source(self, source_name: str) -> List[Dict]:
        """Sync documents from a specific source"""
        if source_name not in self.sources:
            self.logger.error(f"Source {source_name} not registered")
            return []
        
        try:
            connector = self.sources[source_name]
            self.logger.info(f"Syncing from {source_name}...")
            connector.connect()
            try:
                documents = connector.fetch_documents()
            finally:
                connector.disconnect()
            self.logger.info(f"Synced {len(documents)} documents from {source_name}")
            return documents
        
        except Exception as e:
            self.logger.error(f"Sync failed for {source_name}: {e}")
            raise


# Configuration templates
INTEGRATION_CONFIG = {
    "email": {
        "imap_host": os.getenv("IMAP_HOST", "imap.gmail.com"),
        "email": os.getenv("EMAIL_ADDRESS"),
        "password": os.getenv("EMAIL_PASSWORD")
    },
    "maximo": {
        "maximo_url": os.getenv("MAXIMO_URL", "https://maximo.example.com/api"),
        "maximo_token": os.getenv("MAXIMO_TOKEN")
    },
    "sharepoint": {
        "client_id": os.getenv("SHAREPOINT_CLIENT_ID"),
        "client_secret": os.getenv("SHAREPOINT_CLIENT_SECRET"),
        "tenant_id": os.getenv("SHAREPOINT_TENANT"),
        "site_id": os.getenv("SHAREPOINT_SITE_ID"),
        "drive_id": os.getenv("SHAREPOINT_DRIVE_ID")
    },
    "ftp": {
        "protocol": os.getenv("FTP_PROTOCOL", "sftp"),
        "host": os.getenv("FTP_HOST"),
        "port": int(os.getenv("FTP_PORT", "22")),
        "username": os.getenv("FTP_USERNAME"),
        "password": os.getenv("FTP_PASSWORD"),
        "remote_path": os.getenv("FTP_REMOTE_PATH", "/")
    }
}


if __name__ == "__main__":
    # Example usage
    manager = SourceIntegrationManager()
    
    # Register sources (only if credentials are configured)
    if INTEGRATION_CONFIG["email"].get("email"):
        manager.register_source("email", EmailConnector(INTEGRATION_CONFIG["email"]))
    
    if INTEGRATION_CONFIG["maximo"].get("maximo_token"):
        manager.register_source("maximo", MaximoConnector(INTEGRATION_CONFIG["maximo"]))
    
    if INTEGRATION_CONFIG["sharepoint"].get("client_id"):
        manager.register_source("sharepoint", SharePointConnector(INTEGRATION_CONFIG["sharepoint"]))
    
    if INTEGRATION_CONFIG["ftp"].get("host"):
        manager.register_source("ftp", FTPConnector(INTEGRATION_CONFIG["ftp"]))
    
    # Sync all sources
    documents = manager.sync_all_sources()
    print(f"\nTotal documents synced: {len(documents)}")
