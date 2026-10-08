from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId
import logging

load_dotenv()

mongo_uri = os.getenv("MONGO_URI")

# Mock database for when MongoDB is unavailable
class MockCollection:
    """Fallback in-memory collection when MongoDB is unavailable"""
    def __init__(self):
        self.documents = []
    
    def find(self, query=None):
        if query is None:
            return MockCursor(self.documents[:])
        # Simple filter logic
        results = []
        for doc in self.documents:
            match = True
            for key, value in query.items():
                if key == "_id":
                    if isinstance(value, dict) and value.get("$eq"):
                        if str(doc.get("_id")) != str(value["$eq"]):
                            match = False
                    elif str(doc.get("_id")) != str(value):
                        match = False
                elif key == "filename":
                    if isinstance(value, dict) and value.get("$regex"):
                        import re
                        if not re.search(value["$regex"], doc.get(key, ""), re.IGNORECASE):
                            match = False
                    elif doc.get(key) != value:
                        match = False
                elif key == "status":
                    if doc.get(key) != value:
                        match = False
                elif key == "category":
                    if isinstance(value, dict) and value.get("$regex"):
                        import re
                        if not re.search(value["$regex"], doc.get(key, ""), re.IGNORECASE):
                            match = False
                    elif doc.get(key) != value:
                        match = False
                elif doc.get(key) != value:
                    match = False
            if match:
                results.append(doc)
        return MockCursor(results)
    
    def find_one(self, query):
        for doc in self.find(query):
            return doc
        return None
    
    def insert_one(self, doc):
        doc["_id"] = ObjectId()
        self.documents.append(doc)
        return MockInsertResult(doc["_id"])
    
    def update_one(self, query, update):
        logging.info(f"MockCollection.update_one called with query={query}, update={update}")
        for doc in self.documents:
            # Handle both direct ObjectId and string comparison
            doc_id_match = False
            if "_id" in query:
                if isinstance(query["_id"], ObjectId):
                    doc_id_match = str(doc.get("_id")) == str(query["_id"])
                else:
                    doc_id_match = doc.get("_id") == query["_id"]
            
            if doc_id_match:
                logging.info(f"Found document to update: {doc.get('filename')}")
                if "$set" in update:
                    doc.update(update["$set"])
                    logging.info(f"Document updated, new status: {doc.get('status')}")
                return MockUpdateResult()
        
        logging.warning(f"Document not found for update with query: {query}")
        return MockUpdateResult()
    
    def delete_one(self, query):
        """Delete a document matching the query"""
        for i, doc in enumerate(self.documents):
            match = False
            if "_id" in query:
                # Handle both ObjectId and string comparisons
                doc_id = doc.get("_id")
                query_id = query.get("_id")
                
                # Convert both to string for comparison
                if isinstance(doc_id, ObjectId):
                    doc_id = str(doc_id)
                if isinstance(query_id, ObjectId):
                    query_id = str(query_id)
                
                match = str(doc_id) == str(query_id)
            
            if match:
                self.documents.pop(i)
                logging.info(f"MockCollection.delete_one: Deleted document {query.get('_id')}")
                return MockDeleteResult()
        
        logging.warning(f"MockCollection.delete_one: Document not found for query {query}")
        return MockDeleteResult()
    
    def count_documents(self, query=None):
        if query is None:
            return len(self.documents)
        return sum(1 for _ in self.find(query))
    
    def drop_index(self, name):
        pass
    
    def create_index(self, *args, **kwargs):
        pass
    
    def index_information(self):
        return {}

class MockCursor:
    def __init__(self, docs):
        self.docs = docs
    
    def __iter__(self):
        return iter(self.docs)
    
    def sort(self, key, direction):
        self.docs = sorted(self.docs, key=lambda x: x.get(key, ""), reverse=(direction == -1))
        return self

class MockInsertResult:
    def __init__(self, id):
        self.inserted_id = id

class MockUpdateResult:
    pass

class MockDeleteResult:
    pass

class MockDatabase:
    def __init__(self):
        self.collections = {"documents": MockCollection(), "users": MockCollection()}
        self.documents = self.collections["documents"]
    
    def __getitem__(self, name):
        return self.collections.setdefault(name, MockCollection())

# Try to connect to MongoDB Atlas
try:
    if mongo_uri:
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=5000,
            connectTimeoutMS=5000,
            retryWrites=False
        )
        
        # Test connection with shorter timeout
        client.admin.command('ping')
        db = client["document_routing_db"]
        collection = db["documents"]
        users_collection = db["users"]
        print("✓ MongoDB Atlas connection successful")
    else:
        raise Exception("No MONGO_URI provided")
except Exception as e:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("MongoDB is required in production") from e
    print(f"⚠ MongoDB connection failed: {str(e)[:80]}...")
    print("✓ Using in-memory fallback database for testing")
    # Use mock database as fallback
    mock_db = MockDatabase()
    collection = mock_db.documents
    users_collection = mock_db["users"]
