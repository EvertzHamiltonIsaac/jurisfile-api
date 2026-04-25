import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration object
// We read everything from .env — never hardcode credentials
const dbConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'DMS_LawFirm',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false, // true if using Azure SQL
    trustServerCertificate: true, // for local development
    enableArithAbort: true,
  },
  pool: {
    max: parseInt(process.env.SIMULTANEOUS_CONNECTIONS || '10'), // max simultaneous connections
    min: 0,
    idleTimeoutMillis: 30000, // close idle connections after 30s
  },
};

// Singleton connection pool
// We create it once and reuse it — opening a new connection
// on every request is expensive and slow
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;

  try {
    pool = await new sql.ConnectionPool(dbConfig).connect();

    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err);
      pool = null;
    });

    console.log('[DB] Connected to SQL Server successfully');
    return pool;
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    throw error;
  }
}

// Helper to get a Request object ready to use
// Usage: const result = await query().input('id', sql.Int, 1).query('SELECT...')
export async function query() {
  const p = await getPool();
  return new sql.Request(p);
}

// Export sql types so we can use them in services
export { sql };
