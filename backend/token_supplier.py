import os

import jwt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import jsonify, request
from dotenv import load_dotenv
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")

#this access token will expire 15 min after logging in
#this is whats used to prove identity on the frontend 
#its stored in js module-level mem not stored in sessionstorage or anything so its protected against XSS (cross scripting)
ACCESS_EXP_MIN = 15
#the refresh token is what's used to authorise getting a new access token on refresh/reload
#when this runs out the computer will automatically log us out and tell us that the session has expired and we need to log back in
REFRESH_EXP_DAYS = 30

def generate_access_token(user_id, username):
    payload = {
        'user_id': user_id,
        'username': username,
        'type': 'access',
        'exp': datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXP_MIN),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def generate_refresh_token(user_id):
    payload = {
        'user_id': user_id,
        'type': 'refresh',
        'exp': datetime.now(timezone.utc) + timedelta(days=REFRESH_EXP_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or malformed Authorization header."}), 401

        token = auth_header.split(' ', 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401

        # attach to request context so the route can use it
        request.user_id = payload['user_id']
        request.username = payload['username']
        return f(*args, **kwargs)
    return decorated

