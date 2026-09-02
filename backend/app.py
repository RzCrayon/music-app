from gevent import monkey, sleep as gevent_sleep
monkey.patch_all()

import limits
import time
import jwt
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
import json
from tasks import celery_app, run_audiveris_omr
from song_builder import generate_instrument_midi, render_midi_to_audio
import uuid

from image_enhancement import enhance_music
import r2_storage
import traceback
import bcrypt
import redis

from gevent.pywsgi import WSGIServer
from zxcvbn import zxcvbn
from token_supplier import JWT_SECRET, REFRESH_EXP_DAYS, generate_access_token, generate_refresh_token, token_required
from dotenv import load_dotenv

load_dotenv()
import os

#FROM NOW ON WE NEED TO MANUALLY REBUILD THE SERVER WITH ANY CHANGES TO THE FILES

#we need to add a an auth with JWT Web Tokens because even with json requests and with exposed urls like /api/songs/<int:user_id>
#anyone can edit from the browser or Postman etc... JWT will generate a signed token containing the user_id and the frontend 
#will store it and send it in every request header

#creates the port 5000 thing
app = Flask(__name__)

# CORS_ORIGINS is comma seperated so that we can add in the netlify later on
#for now tho default to http://localhost 
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
CORS(
    app, 
    expose_headers=['Retry-After'], 
    supports_credentials=True, 
    origins=CORS_ORIGINS
)
print(f"CORS_ORIGINS loaded as: {CORS_ORIGINS}", flush=True)

storage_uri = os.getenv("REDIS_STORAGE_URI")
redis_client = redis.from_url(storage_uri)

#instantiated so that its independent for each ip addr... that sthe get_remote_Address part
limiter = Limiter(
    get_remote_address, 
    app = app, 
    storage_uri = storage_uri,
    headers_enabled=True
)

ATTEMPT_KEY_PREFIX = "manual_attempts"

#the way this works is on every new record attempt an internal timer on the key (either sign up or sign in) resets to the window_seconds... that's why its 60 for timeout of sign in and 3600 (hr) for timeout of signup
#and then when the recorded attempts > allowed attempts (u cant record any more until the expiry timer is up) u just get the window_seconds left for that key back
#the expiry_timer won't reset until u record another attempt which wont happen until the timer is up
def get_secs_left(ip: str, key: str, max_attempts: int):
    bucket = f"{ATTEMPT_KEY_PREFIX}:{key}:{ip}"
    count = limiter.storage.get(bucket)

    attempts_remaining = max(max_attempts - count, 0)
    if attempts_remaining > 0:
        return -1

    expiry_epoch = limiter.storage.get_expiry(bucket)
    wait_seconds = max(int(expiry_epoch - time.time()), -1) if expiry_epoch else -1
    return wait_seconds

def record_attempt(ip: str, key: str, window_seconds: int):
    bucket = f"{ATTEMPT_KEY_PREFIX}:{key}:{ip}"
    limiter.storage.incr(bucket, window_seconds)


# ---------------------------------------------------------------------------
# DATABASE (Postgres via psycopg3 + a connection pool)
# ---------------------------------------------------------------------------
# Why a pool instead of "connect, do query, close" per request like the
# sqlite version: opening a fresh TCP connection to Postgres on every single
# request is expensive and Postgres has a hard cap on concurrent connections
# (Railway's default plans are usually ~20-100). A pool keeps a small set of
# connections open and hands them out/returns them per-request instead.
#
# row_factory=dict_row makes every fetchone()/fetchall() return dict-like
# rows (row["username"]) instead of tuples — this mirrors how the sqlite
# version used `cursor.row_factory = sqlite3.Row` in some routes, just
# applied consistently everywhere instead of ad hoc per-route.
#
# psycopg3 connections used as a context manager auto-COMMIT on clean exit
# and auto-ROLLBACK if an exception is raised inside the `with` block — so
# you generally don't need explicit cnxn.commit()/cnxn.close() calls below,
# the pool + context manager handle it.
DATABASE_URL = os.getenv("DATABASE_URL")

pool = ConnectionPool(
    DATABASE_URL,
    min_size=1,
    max_size=10,
    kwargs={"row_factory": dict_row, "autocommit": False},
)

#the wav, mp3 audio file of the music being played
#used by the html to play the sound
#the user uploaded png/pdf
#
# NOTE: local static folders are no longer used for anything users need
# to persist. On Railway, web/worker are separate services with separate,
# ephemeral disks — anything saved to local disk vanishes on redeploy and
# is invisible to the other service anyway. Uploads and rendered audio now
# live in a Cloudflare R2 bucket (see r2_storage.py) so both services can
# reach them and they survive deploys.


#create a new account
@app.route('/api/users/new/validate', methods = ['POST'])
def validate_new_user():
    data = request.json
    username = data.get('username')
    #it is safe to retrieve a plain-text password from the frontend...
    #using HTTPS instead of HTTP secures the data on transfer from the frontend to the backend 
    password = data.get('password')

    if not username or not password: 
        return jsonify({"error": "Username and password are required."}), 400

    if len(password) < 8: 
        return jsonify({"error": "Password must be at least 8 characters long."}), 422

    try:
        results = zxcvbn(password, user_inputs=[username])
        if results['score'] < 2:
            feedback = results['feedback']['warning'] or "Password is too weak or common."
            return jsonify({"error": feedback}), 403

        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                cursor.execute('SELECT username FROM users WHERE username = %s', (username,))
                if cursor.fetchone():
                    return jsonify({"error": "Username already in use."}), 409

        return jsonify({"error": "Account validated."}), 200
    except Exception as e:
        return jsonify({"error": "Failed to validate account."}), 500


@app.route('/api/users/new', methods = ['POST'])
@limiter.limit('5 per hour')
def create_user():
    data = request.json
    username = data.get('username')
    #it is safe to retrieve a plain-text password from the frontend...
    #using HTTPS instead of HTTP secures the data on transfer from the frontend to the backend 
    password = data.get('password')

    ip = get_remote_address()
    record_attempt(ip, 'signup', 3600)

    #encode converts the plaintext to bytes so it can be hashed, decode converts the hash to a string for postgres
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user_id = str(uuid.uuid4())

    try:
        #one value in a tuple needs a comma to make a tuple

        #these %s's protect against sql injection
        #because alternatively we could've done smth like "SELECT * FROM users WHERE username = '{username}'"
        #and then if someone typed in ' OR '1'='1 as their username it would become
        #"SELECT * FROM users WHERE username = '' OR '1' = '1'"
        #which would return all the users
        #the %s's means the driver sends the query and the data separately
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, username, password_hash) VALUES (%s, %s, %s)",
                    (user_id, username, password_hash)
                )

        access_token = generate_access_token(user_id, username)
        refresh_token = generate_refresh_token(user_id)

        resp = jsonify({
                "token": access_token,
                "username": username,
                "message": f"Account. Welcome {username}."
            })
        resp.set_cookie(
            'refresh_token', refresh_token,
            httponly=True,
            secure=True,         # Railway serves HTTPS by default
            samesite='None',     # required for cross-site cookies (Netlify <-> Railway are different domains)
            max_age=REFRESH_EXP_DAYS * 24 * 60 * 60,
            path='/api/refresh'
        )

        return resp, 201
    except psycopg.errors.UniqueViolation:
        return jsonify({"error": "Username already in use."}), 409
    except psycopg.Error as e:
        print(e)
        return jsonify({"error": str(e)}), 500

#verify user exists by their username
@app.route('/api/users/login', methods = ['POST'])
#limits per ip... so each ip gets this
@limiter.limit('5 per minute')
def login_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    ip = get_remote_address()
    #60 for per minute
    record_attempt(ip, 'login', 60)

    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                cursor.execute("SELECT id, username, password_hash FROM users WHERE username = %s", (username,))
                userData = cursor.fetchone()

                #second condition checks to see if the typed password matches the encoded password
                if userData and bcrypt.checkpw(password.encode('utf-8'), userData["password_hash"].encode('utf-8')):

                    user_id = userData["id"]

                    access_token = generate_access_token(user_id, userData["username"])
                    refresh_token = generate_refresh_token(user_id)

                    cursor.execute("""
                        SELECT
                            song.id,
                            song.title,
                            song.instrument
                        FROM songs song 
                        WHERE song.user_id = %s
                        GROUP BY song.id
                    """, (user_id,))

                    #here we using fetchall instead of fetchone bc fetchone works on one song, whereas fetchall works on the list of songs
                    rows = cursor.fetchall()

                    songs_list = []
                    for row in rows:
                        songs_list.append({
                            "song_id": row["id"],
                            "title": row["title"],
                            "instrument": row["instrument"]
                        })

                    resp = jsonify({
                            "token": access_token,
                            "username": userData["username"],
                            "songs": songs_list,
                            "message": f"Sign in successful. Welcome {userData['username']}."
                        })
                    resp.set_cookie(
                        'refresh_token', refresh_token,
                        httponly=True,
                        secure=True,
                        samesite='None',
                        max_age=REFRESH_EXP_DAYS * 24 * 60 * 60,
                        path='/api/refresh'
                    )

                    return resp, 200
                else:
                    return jsonify({"error": "Login failed: ACCOUNT NOT FOUND."}), 404
    except psycopg.Error as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/users/login/status', methods = ['GET'])
def check_login_rate_limit():
    try:
        ip = get_remote_address()
        sign_in_remaining = get_secs_left(ip, 'login', 5)
        sign_up_remaining = get_secs_left(ip, 'signup', 5)

        # return jsonify({
        #     "sign_up_remaining": -1,
        #     "sign_in_remaining": -1,
        # }), 200
        return jsonify({
            "sign_in_remaining": sign_in_remaining,
            "sign_up_remaining": sign_up_remaining
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#get the user dashboard
@app.route('/api/dashboard', methods = ['GET'])
@token_required
def get_user_dashboard():

    user_id = request.user_id

    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                #we use left join because it guarantees we get everything from the thing on the left
                #(songs) even if there's no attempt that matches the song_id
                #the alternative is INNER JOIN where we join from the practice_history table

                #if u say just join and youve practiced a song 20 times itll create 20 rows of data for a single song
                #but we do group by so that all the data is grouped by song.id

                #needs that as whenever we use max and count

                #ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY date_played DESC) as recency_rank
                #group the practice_history by song, then look at the timestamps and give the newest rank #1 (the DESC part)

                #you could just do recent_avgs.mastery as mastery but if no attempts mastery will be NULL
                #COALESCE is just so it gets set to 0 in that case
                cursor.execute("""
                    SELECT
                        song.id,
                        song.title,
                        song.instrument
                    FROM songs song 
                    WHERE song.user_id = %s
                """, (user_id,))

                #here we using fetchall instead of fetchone bc fetchone works on one song, whereas fetchall works on the list of songs
                rows = cursor.fetchall()

                songs_list = []
                for row in rows:
                    songs_list.append({
                        "song_id": row["id"],
                        "title": row["title"],
                        "instrument": row["instrument"]
                    })

                return jsonify({"songs": songs_list}), 200
    except psycopg.Error as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/attempts/<int:song_id>', methods=['GET'])
@token_required
def get_all_attempts(song_id):
    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:

                #security check to make sure that the passed in song id belongs to the tokened user
                cursor.execute("SELECT user_id FROM songs WHERE id = %s", (song_id,))
                song = cursor.fetchone()
                if not song:
                    return jsonify({"error": "Song not found."}), 404
                if song["user_id"] != request.user_id:
                    return jsonify({"error": "Forbidden."}), 403

                cursor.execute("""
                    WITH ChronologicalAttempts AS (
                        SELECT 
                            id,
                            song_id,
                            score,
                            date_played,
                            -- Dynamically number attempts chronologically (1, 2, 3...)
                            ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY date_played ASC, id ASC) as attempt_num
                        FROM practice_history
                        WHERE song_id = %s
                    )
                    SELECT 
                        id,
                        song_id,
                        score,
                        date_played,
                        attempt_num
                    FROM ChronologicalAttempts
                    ORDER BY date_played DESC
                """, (song_id,))

                rows = cursor.fetchall()

                # dict_row already gives us plain dicts, so no conversion needed
                # (the sqlite version had to do `[dict(row) for row in rows]`
                # to get out of sqlite3.Row objects — dict_row skips that step).
                attempts = [dict(row) for row in rows]

                return jsonify({
                    "attempts": attempts
                }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/songs/<int:song_id>', methods = ['POST'])
@token_required
def get_song(song_id): 
    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:

                cursor.execute("""
                    WITH ChronologicalAttempts AS (
                        SELECT 
                            id,
                            song_id,
                            score,
                            date_played,
                            -- Dynamically calculates attempt # (1st attempt, 2nd attempt, etc.)
                            ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY date_played ASC, id ASC) as attempt_num
                        FROM practice_history
                        WHERE song_id = %s
                    )
                    SELECT
                        song.id,
                        song.title,
                        song.notes_json,
                        song.audio_url,
                        song.instrument,
                        song.user_id,
                        best.id as best_id,
                        best.score as best_score,
                        best.attempt_num as best_attempt_num,
                        best.date_played as best_attempt_date,
                        (SELECT COUNT(*) FROM practice_history WHERE song_id = song.id) as total_attempts
                    FROM songs song
                    LEFT JOIN (
                        SELECT id, song_id, score, attempt_num, date_played
                        FROM ChronologicalAttempts
                        ORDER BY score DESC, date_played DESC
                        LIMIT 1
                    ) best ON song.id = best.song_id
                    WHERE song.id = %s
                """, (song_id, song_id))

                song = cursor.fetchone()

                if not song:
                    return jsonify({"error": "Song not found."}), 404
                if song["user_id"] != request.user_id:
                    return jsonify({"error": "Forbidden."}), 403

                notes_data = json.loads(song["notes_json"])
                if not notes_data:
                    return jsonify({"error": "Song note data was found compromised."}), 422 #Unprocessable Entity status code

                high_score = {
                    'score': None, 
                    'attempt_num': None,
                    'date': None,
                    'id': None
                }
                if song['best_score'] is not None:
                    high_score = {
                        "score": song['best_score'], 
                        "attempt_num": song['best_attempt_num'], 
                        "date": song['best_attempt_date'], 
                        "id": song['best_id']
                    }

                # audio_url in the DB now stores an R2 object *key*
                # (e.g. "audio/<uuid>.mp3"), not a public URL — the bucket
                # stays private and we hand back a short-lived signed URL
                # instead. If a song has no audio yet, audio_url is empty
                # and we just pass that through.
                signed_audio_url = (
                    r2_storage.generate_presigned_url(song["audio_url"])
                    if song["audio_url"] else ""
                )

                return jsonify({"song" : {
                    "song_id": song["id"],
                    "title": song["title"],
                    "audio_url": signed_audio_url,
                    "notes": notes_data,
                    "instrument": song["instrument"],
                    "highScore": high_score,
                    "total_attempts": song["total_attempts"],
                }}), 200

    except psycopg.Error as sqlite_err:
        print(f"Database err {sqlite_err}")
        return jsonify({"error": str(sqlite_err)}), 500

@app.route('/api/songs/<int:song_id>', methods = ['DELETE'])
@token_required
def delete_song(song_id):
    #request.form doesnt work for DELETE use json
    data = request.json
    song_id = data.get('song_id')

    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:

                cursor.execute("SELECT user_id, audio_url FROM songs WHERE id = %s", (song_id,))
                song = cursor.fetchone()

                if not song:
                    return jsonify({"error": "Song not found."}), 404
                if song["user_id"] != request.user_id:
                    return jsonify({"error": "Forbidden."}), 403

                cursor.execute("DELETE FROM songs WHERE id = %s", (song_id,))

                # clean up the rendered audio in R2 too, otherwise you're
                # paying for orphaned objects nothing points to anymore
                if song["audio_url"]:
                    r2_storage.delete_object(song["audio_url"])

                return jsonify({"message": "Song successfully deleted."}), 200
    except psycopg.Error as sqlite_err:
        print(f"Database err {sqlite_err}")
        return jsonify({"error": str(sqlite_err)}), 500

@app.route('/api/attempts/<int:attempt_id>', methods=['DELETE'])
@token_required
def delete_attempt(attempt_id):
    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:

                cursor.execute("""
                    SELECT songs.user_id FROM practice_history
                    JOIN songs ON songs.id = practice_history.song_id
                    WHERE practice_history.id = %s
                """, (attempt_id,))
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "Attempt not found."}), 404
                if row["user_id"] != request.user_id:
                    return jsonify({"error": "Forbidden."}), 403

                cursor.execute("DELETE FROM practice_history WHERE id = %s", (attempt_id,))
                return jsonify({"message": "Attempt successfully deleted."}), 200

    except psycopg.Error as sqlite_err:
        print(f"Database error: {sqlite_err}")
        return jsonify({"error": str(sqlite_err)}), 500


ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024

# ENQUEUE TASK
#even tho this whole process is not changing any data stored to database it's expensive and only authed users should be able to use it
@app.route('/api/songs/preview', methods = ['POST'])
@token_required
def enqueue_preview():
    if 'sheet_music_file' not in request.files:
        return jsonify({"error": "No files discovered in payload"}), 400

    uploaded_file = request.files['sheet_music_file']
    
    if uploaded_file.filename == '':
        return jsonify({"error": "Empty filename passed"}), 400

    uploaded_file.seek(0, os.SEEK_END)
    file_length = uploaded_file.tell()
    uploaded_file.seek(0)

    if file_length > MAX_FILE_SIZE:
        return jsonify({"error": f"File exceeds the 16MB limit."}), 413
    
    # instrument = request.form.get('instrument', 'piano')
    title = os.path.basename(uploaded_file.filename).rsplit('.', 1)[0].replace('_', ' ').title()
    file_extension = os.path.splitext(uploaded_file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 415

    unique_id = str(uuid.uuid4())
    ext = os.path.splitext(uploaded_file.filename)[1]

    # stream the upload straight to r2 bc railway and netlify r seperate services 
    r2_key = f"uploads/{unique_id}{ext}"
    try:
        r2_storage.upload_fileobj(uploaded_file, r2_key, content_type=uploaded_file.mimetype)
    except Exception as e:
        print(f"[R2] Upload failed: {e}")
        return jsonify({"error": "Failed to store uploaded file."}), 500

    # pass the r2_key
    print('Triggered audiveris')
    task = run_audiveris_omr.delay(r2_key)

    return jsonify({
        "job_id": task.id,
        "status": "PROCESSING",
        "suggested_title": title
    }), 202

# POLL TASK STATUS
@app.route('/api/songs/preview/status/<job_id>', methods=['GET'])
@token_required
def get_preview_status(job_id):
    task = run_audiveris_omr.AsyncResult(job_id)

    if task.state == 'PENDING':
        response = {"status": "PENDING"}
    elif task.state == 'SUCCESS':
        response = {"status": "SUCCESS", "data": task.result}
    elif task.state == 'FAILURE':
        response = {"status": "FAILED", "error": str(task.info)}
    else:
        response = {"status": task.state}

    return jsonify(response), 200

#ABORT TASK CONTROL
@app.route('/api/songs/preview/cancel/<job_id>', methods=['DELETE'])
@token_required
def cancel_preview(job_id):
    #`terminate=True` sends SIGTERM to kill active subprocesses immediately.
    celery_app.control.revoke(job_id, terminate=True, signal='SIGTERM')
    print(f"[OMR] Task {job_id} explicitly revoked/terminated by user.")
    return jsonify({"status": "CANCELLED"}), 200

#needs user id, title, extracted notes, and an audio url
@app.route('/api/songs', methods = ['POST'])
@token_required
def create_song():
    #the request.form is for big multipart form (basically how react bundles a file and regular text fields like user_id)
    #checks for a field user_id and defaults to 1 so it doesnt crash

    user_id = request.user_id

    data = request.json

    title = data.get('title')
    extracted_notes = data.get('notes')
    instrument = data.get('instrument')

    try:
        print("attempting to add song")

        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO songs (user_id, title, notes_json, audio_url, instrument) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (user_id, title, json.dumps(extracted_notes), '', instrument)
                )
                # Postgres has no cursor.lastrowid like sqlite — RETURNING id
                # + fetchone() is the idiomatic way to get the new row's id back.
                song_id = cursor.fetchone()["id"]

        return jsonify({
            "song_id": song_id, 
            "title": title,
            "extracted_notes": extracted_notes,
            "message": f"{title} successfully added to your dashboard."
        }), 201
    except psycopg.Error as sqlite_err:
        return jsonify({"error": str(sqlite_err)}), 500

@app.route('/api/score', methods = ['POST'])
@token_required
def create_song_data_entry():
    data = request.json
    song_id = data.get('song_id')
    score = data.get('score')

    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:

                #security check to make sure that the passed in song id belongs to the tokened user
                cursor.execute("SELECT user_id FROM songs WHERE id = %s", (song_id,))
                song = cursor.fetchone()
                if not song:
                    return jsonify({"error": "Song not found."}), 404
                if song["user_id"] != request.user_id:
                    return jsonify({"error": "Forbidden."}), 403

                cursor.execute(
                    "INSERT INTO practice_history (song_id, score) VALUES (%s, %s) RETURNING id",
                    (song_id, score)
                )
                entry_id = cursor.fetchone()["id"]

                # Grab stats: high score, high score date, attempt # of high score, and total attempts
                cursor.execute("""
                    WITH ChronologicalAttempts AS (
                        SELECT 
                            id,
                            song_id,
                            score,
                            date_played,
                            -- Number attempts chronologically (1st, 2nd, 3rd, etc.)
                            ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY date_played ASC, id ASC) as attempt_num,
                            -- Total attempts count
                            COUNT(*) OVER (PARTITION BY song_id) as total_attempts
                        FROM practice_history
                        WHERE song_id = %s
                    )
                    SELECT
                        score as best_score,
                        date_played as best_attempt_date,
                        attempt_num as best_attempt_num,
                        id as best_attempt_id,
                        total_attempts
                    FROM ChronologicalAttempts
                    ORDER BY score DESC, date_played DESC
                    LIMIT 1
                """, (song_id,))

                stats = cursor.fetchone()

                return jsonify({
                    "entry_id": entry_id,
                    "highScore": {
                        "score": stats["best_score"],
                        "date": stats["best_attempt_date"],
                        "attempt_num": stats["best_attempt_num"], 
                        "id": stats["best_attempt_id"]
                    },
                    "total_attempts": stats["total_attempts"]
                }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

#when our refresh token has expired 
@app.route('/api/refresh', methods=['POST'])
def refresh():
    token = request.cookies.get('refresh_token')
    if not token:
        return jsonify({"error": "No refresh token."}), 401
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if payload.get('type') != 'refresh':
            raise jwt.InvalidTokenError()
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token expired. Please log in again."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid refresh token."}), 401

    try:
        with pool.connection() as cnxn:
            with cnxn.cursor() as cursor:
                cursor.execute("SELECT username FROM users WHERE id = %s", (payload['user_id'],))
                row = cursor.fetchone()
                if not row:
                    return jsonify({"error": "User no longer exists."}), 401

                new_access = generate_access_token(payload['user_id'], row["username"])
                return jsonify({"token": new_access}), 200
    except psycopg.Error as e:
        return jsonify({"error": str(e)}), 500

#need the logout endpoint because if we just refreshed the cookie when we login a new user 
#if someone logs out but no one new logs in that cookie remains in the build and can be exploited
@app.route('/api/logout', methods=['POST'])
def logout():
    resp = jsonify({"message": "You've been logged out."})
    resp.delete_cookie('refresh_token', path='/api/refresh')
    return resp, 200

@app.route('/api/songs/preview/stream/<job_id>', methods = ['GET'])
def stream_preview_progress(job_id):
    def event_stream():
        pubsub = redis_client.pubsub()
        #get the correct progress data 
        pubsub.subscribe(f"omr_progress:{job_id}")
        #catch up on whatever happened before we subscribed
        last_state = redis_client.get(f"omr_progress_state:{job_id}")
        if last_state:
            yield f"data: {last_state.decode('utf-8')}\n\n"
            if json.loads(last_state).get('done'):
                pubsub.unsubscribe(f"omr_progress:{job_id}")
                return

        #add a head 5 min cap to this process so that if the file hasn't loaded in five minutes we close the 
        #connection so that it can't be attacked or spammed and there's not tm redis build up (see the explanation in tasks.py)
        deadline = time.time() + 300
        try:
            for message in pubsub.listen():
                message = pubsub.get_message(timeout=5.0)  # returns None after 5s if nothing arrived
                if message is None:
                    continue
                if message['type'] != 'message':
                    continue
                data = message['data']
                #get the actual message
                yield f"data: {data.decode('utf-8') if isinstance(data, bytes) else data}\n\n"
                #if the message says we're done break the loop and return the response 
                if json.loads(data).get('done'):
                    break
        finally:
            pubsub.unsubscribe(f"omr_progress:{job_id}")

    return Response(event_stream(), mimetype='text/event-stream')

#prevents imports of this file later on from running the actual backend server
if __name__ == '__main__':
    # Railway assigns a dynamic PORT env var — it does not guarantee 5000
    # is the port your service is reachable on, so read it at runtime
    # instead of hardcoding it.
    port = int(os.getenv("PORT", 5000))
    http_server = WSGIServer(('0.0.0.0', port), app)
    print(f"Serving on http://0.0.0.0:{port}")

    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down gracefully...")
        http_server.stop()