// Bundles every migration into supabase/setup.sql so the database can be
// created with a single paste into the Supabase SQL editor.
// Run with: npm run db:bundle
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const outFile = join(root, 'supabase', 'setup.sql');

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const header = `-- =====================================================================
-- Farm Hisab - complete database setup
--
-- GENERATED FILE - do not edit by hand.
-- Source: supabase/migrations/*.sql  (regenerate with: npm run db:bundle)
--
-- Paste this whole file into the Supabase SQL editor and press Run.
-- It creates every table, index, constraint, trigger and Row Level Security
-- policy, plus the optional demo-data functions.
-- Running it a second time is safe.
-- =====================================================================

`;

const body = files
  .map((name) => `\n\n-- ---------------------------------------------------------------------\n-- ${name}\n-- ---------------------------------------------------------------------\n\n${readFileSync(join(migrationsDir, name), 'utf8')}`)
  .join('\n');

writeFileSync(outFile, header + body, 'utf8');
console.log(`wrote supabase/setup.sql from ${files.length} migrations`);
