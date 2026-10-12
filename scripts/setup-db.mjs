import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { SCHEMA_STATEMENTS } from '../src/server/schema.js';

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
  const sql = neon(dbUrl);
  // One transaction: either the whole schema (and credential migration) applies or none of it.
  await sql.transaction(SCHEMA_STATEMENTS.map(({ text, params }) => sql.query(text, params)));
  console.log(`Database ready (${SCHEMA_STATEMENTS.length} statements).`);
}
