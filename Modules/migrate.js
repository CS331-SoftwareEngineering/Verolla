const fs = require('fs');
const path = require('path');
const { userDAL } = require('./dal');

const USERS_JSON = path.join(__dirname, 'users.json');

function migrate() {
    if (!fs.existsSync(USERS_JSON)) {
        console.log('No users.json found. Skipping migration.');
        return;
    }

    try {
        const data = fs.readFileSync(USERS_JSON, 'utf8');
        const users = JSON.parse(data);

        console.log(`Found ${users.length} users in JSON. Checking for migration...`);

        let migratedCount = 0;
        for (const user of users) {
            const existing = userDAL.findByEmailOrUsername(user.email) || userDAL.findByEmailOrUsername(user.username);
            
            if (!existing) {
                userDAL.insert({
                    fullName: user.fullName,
                    username: user.username,
                    org: user.org,
                    email: user.email,
                    phone: user.phone,
                    dob: user.dob,
                    password: user.password
                });
                migratedCount++;
            }
        }

        console.log(`Successfully migrated ${migratedCount} new users to SQLite.`);
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
process.exit(0);
