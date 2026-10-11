import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL to your Neon connection string before running db:setup.');
  process.exitCode = 1;
} else {
  const source = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const sql = neon(process.env.DATABASE_URL);
  const statements = source.split(';').map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Database ready (${statements.length} statements).`);
}
