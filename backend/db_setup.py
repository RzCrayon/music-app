import sqlite3

def init_db():
    cnxn = sqlite3.connect('music_app.db')

    #writes the SQL commands
    cursor = cnxn.cursor()

    #this is what makes sure a user exists when inserting data to a user
    cursor.execute("PRAGMA foreign_keys = ON;")

    #create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, 
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL    
        )'''
    )

    #create songs table
    #that foreign id thing is what checks to make sure that the user exists 
    #if u try and add a song to a user that doesnt exist 
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id TEXT NOT NULL, 
            title TEXT NOT NULL,
            notes_json TEXT NOT NULL,
            audio_url TEXT, 
            instrument TEXT NOT NULL, 
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )'''
    )

    #real is decimal numbers
    #the on delete cascade stuff says if the foreign key is deleted cascade
    #down the dependencies and delete the related stuff... like all the 
    #practice_history for that one song
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS practice_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            song_id INTEGER NOT NULL, 
            score REAL NOT NULL, 
            date_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
        )'''
    )

    cnxn.commit()

    cnxn.close()
    print("Database initiated")

if __name__ == '__main__':
    init_db()
