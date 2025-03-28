const mysql = require('mysql2/promise');
require('dotenv').config()

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USERNAME, 
    password: '>xH:L*E=1lO]'||process.env.DB_PASSWORD ,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306, 
    waitForConnections: true,      
    connectionLimit: 10,         
    queueLimit: 0  
});

pool.on('connection', (connection) => {
    console.log('Connected to the database');
});
pool.on('error', (err) => {
    console.error('Database error:', err);
});

module.exports = pool;
