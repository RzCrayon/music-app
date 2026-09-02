# switching over to postgres for railway deployment
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def init_db():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. Locally, point it at the docker-compose "
            "'postgres' service; in Railway it's provided automatically once "
            "you add the Postgres plugin (copy it into your service's env vars "
            "as DATABASE_URL if it isn't auto-linked)."
        )

    with psycopg.connect(DATABASE_URL) as cnxn:
        with cnxn.cursor() as cursor:

            # users.id stays TEXT (you're generating uuid4 strings in app.py,
            # not letting Postgres generate them) so no schema-level change
            # needed there.
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL
                )'''
            )

            # AUTOINCREMENT -> SERIAL (Postgres's auto-incrementing int type).
            # Foreign keys are enforced by default in Postgres — there's no
            # equivalent of SQLite's "PRAGMA foreign_keys = ON" to remember.
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS songs (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    notes_json TEXT NOT NULL,
                    audio_url TEXT,
                    instrument TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )'''
            )

            # TIMESTAMP -> TIMESTAMPTZ (store with timezone; avoids ambiguity
            # once you have users/servers in different timezones), and
            # CURRENT_TIMESTAMP -> NOW() is the Postgres-idiomatic spelling
            # (CURRENT_TIMESTAMP also works in Postgres, NOW() is just more
            # common there).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS practice_history (
                    id SERIAL PRIMARY KEY,
                    song_id INTEGER NOT NULL,
                    score REAL NOT NULL,
                    date_played TIMESTAMPTZ DEFAULT NOW(),
                    FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
                )'''
            )

        cnxn.commit()

    print("Database initiated (Postgres)")


if __name__ == '__main__':
    init_db()