import { readFile, writeFile } from 'node:fs/promises';
const settingsPath = new URL('../.cloudflare/deployment.json', import.meta.url);
let settings;
try { settings = JSON.parse(await readFile(settingsPath, 'utf8')); }
catch { throw new Error('Cloudflare setup is incomplete. Add .cloudflare/deployment.json after creating the game database.'); }
if (!/^[a-f0-9]{32}$/.test(settings.account_id || '') || !/^[a-f0-9-]{36}$/.test(settings.database_id || '') || settings.database_id === '00000000-0000-4000-8000-000000000000') {
  throw new Error('Use the real account and D1 database IDs returned by Cloudflare.');
}
if (!/^[a-z][a-z0-9-]*$/.test(settings.worker_name || '') || typeof settings.database_name !== 'string' || !settings.database_name) throw new Error('Cloudflare Worker or database name is missing.');
const path = new URL('../dist/server/wrangler.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
config.name = settings.worker_name;
config.account_id = settings.account_id;
config.d1_databases = [{ binding: 'DB', database_name: settings.database_name, database_id: settings.database_id, migrations_dir: '../../drizzle' }];
// The permanent Worker receives its own public origin directly.
delete config.vars?.GAME_ORIGIN;
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
console.log(`Production configuration ready for ${settings.worker_name}.`);
