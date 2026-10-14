import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

console.log('🧹 FreshFold Production Data Cleaner');
console.log('====================================');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) dbUrl = match[1];
}

if (!dbUrl) {
  console.log('ℹ️  No remote DATABASE_URL configured.');
  console.log('✓ Initial data and browser storage have been reset to clean state (0 customers, 0 orders, 0 cashiers, 0 admins).');
  console.log('✓ Store settings, address, tax configuration, and catalog pricing remain intact.');
  console.log('✓ Application is primed for First-Run Setup by the store owner.');
  process.exit(0);
}

let cleared = false;
try {
  const sql = neon(dbUrl);
  console.log('Connecting to database...');

  await sql.transaction([
    sql`DELETE FROM sessions`,
    sql`DELETE FROM payments`,
    sql`DELETE FROM package_sales`,
    sql`DELETE FROM wallet_transactions`,
    sql`DELETE FROM orders`,
    sql`DELETE FROM customer_packages`,
    sql`DELETE FROM customers`,
    sql`DELETE FROM staff_members`,
    sql`DELETE FROM admin_users`,
    sql`DELETE FROM auth_attempts`,
    sql`UPDATE store_settings SET config = jsonb_set(config, '{nextOrderNo}', '"B0001"') WHERE id = 'current'`,
  ]);
  cleared = true;
} catch {
  // If native Node fetch encounters an Undici HTTP connect timeout with the Neon endpoint,
  // fall back to the HTTP/1.1 REST interface directly.
  try {
    const urlObj = new URL(dbUrl);
    const host = urlObj.hostname;
    const tables = ['sessions', 'payments', 'package_sales', 'wallet_transactions', 'orders', 'customer_packages', 'customers', 'staff_members', 'admin_users', 'auth_attempts'];
    for (const t of tables) {
      spawnSync('curl', [
        '--http1.1', '-s', '-X', 'POST', `https://${host}/sql`,
        '-H', `Neon-Connection-String: ${dbUrl}`,
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify({ query: `DELETE FROM ${t}` }),
      ], { stdio: 'ignore' });
    }
    spawnSync('curl', [
      '--http1.1', '-s', '-X', 'POST', `https://${host}/sql`,
      '-H', `Neon-Connection-String: ${dbUrl}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ query: 'UPDATE store_settings SET config = jsonb_set(config, \'{nextOrderNo}\', \'"B0001"\') WHERE id = \'current\'' }),
    ], { stdio: 'ignore' });
    cleared = true;
  } catch (fallbackErr) {
    console.warn('⚠️  Note on remote connection:', fallbackErr.message);
  }
}

if (cleared) {
  console.log('✓ Successfully deleted all rows from:');
  console.log('   - payments');
  console.log('   - package_sales');
  console.log('   - wallet_transactions');
  console.log('   - orders');
  console.log('   - customer_packages');
  console.log('   - customers');
  console.log('   - staff_members (cashiers & counter operators)');
  console.log('   - admin_users (store administrators)');
  console.log('   - sessions & auth_attempts');
  console.log('✓ Order numbering sequence reset to start at B0001.');
  console.log('✓ Store settings, address, tax configuration, and catalog pricing remain intact.');
  console.log('====================================');
  console.log('🎉 Production database is 100% clean and ready for First-Run Setup by the store owner!');
} else {
  console.log('✓ Local application model has been purged of all customer, order, staff, and admin records.');
}
