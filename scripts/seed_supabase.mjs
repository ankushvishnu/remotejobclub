// scripts/seed_supabase.mjs
// Called by GitHub Actions after discover_ats.mjs generates a SQL file.
// Parses the INSERT VALUES and upserts into Supabase via REST API.

import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQL_FILE = process.env.SQL_FILE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Find the SQL file if not passed explicitly
let sqlPath = SQL_FILE;
if (!sqlPath) {
  const files = fs.readdirSync('supabase/migrations')
    .filter(f => f.endsWith('_seed_discovered_ats.sql'))
    .sort();
  sqlPath = files.length ? `supabase/migrations/${files.at(-1)}` : null;
}

if (!sqlPath || !fs.existsSync(sqlPath)) {
  console.log('No SQL file found. Exiting.');
  process.exit(0);
}

const sql = fs.readFileSync(sqlPath, 'utf-8');

// Parse tuples from: ('name', 'url', 'ats', 'token')
const valuesBlock = sql.match(/VALUES\s*([\s\S]+?);/i)?.[1];
if (!valuesBlock) {
  console.error('Could not find VALUES block in SQL file.');
  process.exit(1);
}

const tuples = [];
const re = /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*\)/g;
let m;
while ((m = re.exec(valuesBlock)) !== null) {
  tuples.push({
    company_name: m[1].replace(/''/g, "'"),
    careers_url:  m[2].replace(/''/g, "'"),
    ats_provider: m[3].replace(/''/g, "'"),
    board_token:  m[4].replace(/''/g, "'"),
    status: 'ACTIVE',
  });
}

if (tuples.length === 0) {
  console.log('No tuples parsed from SQL. Exiting.');
  process.exit(0);
}

console.log(`Upserting ${tuples.length} companies into Supabase...`);

// Supabase REST upsert — requires unique constraint on board_token
// 'resolution=merge-duplicates' = ON CONFLICT DO UPDATE
const res = await fetch(`${SUPABASE_URL}/rest/v1/company_directory`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  },
  body: JSON.stringify(tuples),
});

const body = await res.text();
if (!res.ok) {
  console.error(`Supabase error ${res.status}:`, body);
  process.exit(1);
}

console.log(`✅ Upserted ${tuples.length} companies. HTTP ${res.status}`);
