const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('TABLES:', JSON.stringify(rows));
        rows.forEach(r => {
            db.all(`PRAGMA table_info(${r.name})`, (err, cols) => {
                console.log(`SCHEMA FOR ${r.name}:`, JSON.stringify(cols, null, 2));
            });
        });
    }
    setTimeout(() => db.close(), 1000);
});
