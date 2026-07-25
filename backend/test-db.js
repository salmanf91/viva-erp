const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  console.log('DB Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    console.log('Connected to MySQL server successfully.');
    
    const [dbs] = await connection.query('SHOW DATABASES');
    console.log('Databases available:', dbs.map(d => d.Database || d.database || Object.values(d)[0]));
    
    await connection.end();
  } catch (err) {
    console.error('Error connecting to MySQL server:', err.message);
  }
}

test();
