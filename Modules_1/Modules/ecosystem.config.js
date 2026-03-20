module.exports = {
    apps: [
        {
            name:   'verolla',
            script: 'server.js',
            cwd:    '/home/ec2-user/verolla/Modules',

            env: {
                NODE_ENV: 'development',
                PORT:      3000,
                DB_PATH:  './verolla.db'
            },

            env_production: {
                NODE_ENV: 'production',
                PORT:      3000,
                DB_PATH:  '/data/verolla/verolla.db'
            },

            autorestart:    true,
            watch:          false,
            max_memory_restart: '300M',

            out_file:  '/var/log/verolla/out.log',
            error_file:'/var/log/verolla/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        }
    ]
};
