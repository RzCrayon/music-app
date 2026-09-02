from gevent import monkey, sleep as gevent_sleep
monkey.patch_all()
import time
import json
import redis

import os
import glob
import shutil
import tempfile
from celery import Celery

from dotenv import load_dotenv
load_dotenv()

from omr_processor import extract_notes
import r2_storage

#cmd to start the worker
#celery -A tasks.celery_app worker --loglevel=info -P gevent --concurrency=4

def cleanup_files(upload_dir, base_name, cb):
    # Now operating inside a per-job tempfile.mkdtemp() directory (see
    # run_audiveris_omr below) instead of the old shared static/uploads
    # folder, so this just wipes the whole scratch directory rather than
    # globbing for files matching base_name within a shared folder. Kept
    # the glob+per-file removal loop anyway since Audiveris/enhance_music
    # can leave several sibling files (enhanced_*, *.musicxml, etc.) and
    # the retry-on-PermissionError logic is still useful on Windows-y
    # filesystems.
    pattern = os.path.join(upload_dir, f"*{base_name}*")

    try:
        matching_files = glob.glob(pattern)
    except Exception as e:
        cb(f"Failed to glob in cleanup ({pattern}: {e})")
        print(f"[Cleanup] Failed to glob {pattern}: {e}")
        return

    cb("Starting file cleanup process")
    for file_path in matching_files:
        if not os.path.isfile(file_path):
            continue

        for attempt in range(10):
            try:
                os.remove(file_path)
                print(f"[Cleanup] Removed: {file_path}")
                break

            except PermissionError as e:
                if attempt == 9:
                    print(
                        f"[Cleanup] Could not remove after 10 attempts: "
                        f"{file_path} — {e}"
                    )
                    cb(f"Failed to remove file after 10 attempts: {file_path} — {e}")
                else:
                    gevent_sleep(0.5)

            except FileNotFoundError:
                # Another process/thread already removed it.
                break

            except Exception as e:
                print(f"[Cleanup] Failed removing {file_path}: {e}")
                cb(f"Failed to remove file: {file_path} — {e}")
                break

    # remove the (now hopefully empty) scratch directory itself
    try:
        shutil.rmtree(upload_dir, ignore_errors=True)
    except Exception as e:
        print(f"[Cleanup] Failed removing scratch dir {upload_dir}: {e}")


storage_uri = os.getenv("REDIS_STORAGE_URI")
redis_client = redis.from_url(storage_uri)

def publish_progress(job_id, message, percent=None, done=False):
    payload = json.dumps({"message": message, "percent": percent, "done": done})
    # keep the latest state around for late subscribers, expire it so it doesn't linger forever
    redis_client.set(f"omr_progress_state:{job_id}", payload, ex=600)
    redis_client.publish(f"omr_progress:{job_id}", payload)

# Initialize Celery pointing to Redis
celery_app = Celery(
    'omr_tasks',
    broker=storage_uri,
    backend=storage_uri
)

@celery_app.task(bind=True)
def run_audiveris_omr(self, r2_key, preprocess_preset = 'clean_pdf'):
    job_id = self.request.id
    cb = lambda mssg, pct=None, done = False: publish_progress(job_id, mssg, pct)

    # Each job gets its own scratch directory on the worker's local (ephemeral)
    # disk. This is fine — it only needs to exist for the lifetime of this
    # task, unlike the original upload which has to be reachable by both the
    # web service (that saved it) and the worker service (that processes it).
    # That hand-off now happens through R2 instead of a shared volume.
    scratch_dir = tempfile.mkdtemp(prefix="omr_")
    base_name = os.path.splitext(os.path.basename(r2_key))[0]
    temp_img_path = os.path.join(scratch_dir, os.path.basename(r2_key))

    try:
        cb("Downloading uploaded sheetmusic")
        r2_storage.download_file(r2_key, temp_img_path)

        cb("Booting up the commands")
        extracted_notes, qual = extract_notes(temp_img_path, preprocess_preset=preprocess_preset, progress_cb=cb)
        
        return {
            "status": "SUCCESS", 
            "extracted_notes": extracted_notes, 
            "quality": qual
        }

    except Exception as err:
        publish_progress(job_id, f"Failed: {err}", done = True)
        raise err

    finally:
        #give the sys a moment to release handles if audiveris was just force-killed
        time.sleep(1.0)
        cleanup_files(scratch_dir, base_name, cb)
        # the original upload in R2 has served its purpose once OMR has run
        # (successfully or not) — delete it so you're not paying to store
        # sheet-music images indefinitely.
        r2_storage.delete_object(r2_key)
        cb("Done")

#explanation / notes for the live status updates going to the frontend
#we're using SSE, which is one directional, backend to frontend (think AI message streaming)
#Websocket would be two directional
#basically the way this works is its a GET message that returns a callback to a while loop that you can set the done to at any time
#the problem with this is that unless its authed someone can just inject a command with no done and just endlessly ping the server 
    #tying up the gevent worker pool and redis connections