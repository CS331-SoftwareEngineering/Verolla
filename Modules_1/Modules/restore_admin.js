const Database = require('better-sqlite3');
const db = new Database('verolla.db');
const before = db.prepare('SELECT id,username,role,active FROM users WHERE id=1').get();
console.log('Before:', before);
db.prepare("UPDATE users SET role='admin' WHERE id=1").run();
const after = db.prepare('SELECT id,username,role FROM users WHERE id=1').get();
console.log('After:', after);
