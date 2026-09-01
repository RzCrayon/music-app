import sqlite3
import bcrypt

#DELETE BEFORE PRODUCTION

# scripts like this will allow us to modify the backend if needed on command
cnxn = sqlite3.connect('music_app.db')

# instrument = "piano"
# cnxn.execute("ALTER TABLE songs ADD COLUMN instrument TEXT")
# # password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
# cnxn.execute("UPDATE songs SET instrument = ?", (instrument, ))
# cnxn.commit()
# cnxn.close()
# print("done")

users = cnxn.execute("SELECT id, username FROM users").fetchall()
for user in users:
    print(user)
    cnxn.execute("DELETE FROM users WHERE id = ?", (user[0],))

cnxn.commit()
cnxn.close()