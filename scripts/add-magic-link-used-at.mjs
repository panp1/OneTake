import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ DEFAULT NULL`;

console.log('Added used_at column to magic_links');
