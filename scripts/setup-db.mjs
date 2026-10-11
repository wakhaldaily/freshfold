import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) dbUrl = match[1];
}

if (!dbUrl) {
  console.error('Set DATABASE_URL to your Neon connection string before running db:setup.');
  process.exitCode = 1;
} else {
  const source = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const sql = neon(dbUrl);
  const statements = source.split(';').map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Database ready (${statements.length} statements).`);
}
