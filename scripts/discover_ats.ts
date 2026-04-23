import { ensureDir } from "https://deno.land/std@0.200.0/fs/ensure_dir.ts";

async function fetchAndDiscover(url: string) {
  try {
    // Fast match directly on URL
    if (url.includes('greenhouse.io')) {
      const match = url.match(/boards(?:\.eu)?\.greenhouse\.io\/([^/?]+)/);
      if (match) return { ats: 'greenhouse', token: match[1] };
    }
    if (url.includes('lever.co')) {
      const match = url.match(/jobs\.(?:eu\.)?lever\.co\/([^/?]+)/);
      if (match) return { ats: 'lever', token: match[1] };
    }
    if (url.includes('ashbyhq.com')) {
      const match = url.match(/jobs\.ashbyhq\.com\/([^/?]+)/);
      if (match) return { ats: 'ashby', token: match[1] };
    }

    // Deep scan for custom domains
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!res || !res.ok) return null;
    const html = await res.text();

    const ghMatch = html.match(/boards(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\/js\?for=)?([^/"'&?]+)/);
    if (ghMatch && ghMatch[1] !== 'embed') return { ats: 'greenhouse', token: ghMatch[1] };

    const leverMatch = html.match(/jobs\.(?:eu\.)?lever\.co\/([^/"'&?]+)/);
    if (leverMatch) return { ats: 'lever', token: leverMatch[1] };

    const ashbyMatch = html.match(/jobs\.ashbyhq\.com\/([^/"'&?]+)/);
    if (ashbyMatch) return { ats: 'ashby', token: ashbyMatch[1] };

    return null;
  } catch (e) {
    return null;
  }
}

// Extract company name heuristically from url or token
function getCompanyName(url: string, token: string) {
  try {
    const host = new URL(url).hostname;
    let name = host.replace('www.', '').split('.')[0];
    if (['jobs', 'boards', 'apply', 'careers'].includes(name.toLowerCase())) {
        name = token;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }
}

async function main() {
  const filePaths = Deno.args;
  
  if (filePaths.length === 0) {
    console.error("Usage: deno run -A scripts/discover_ats.ts <file1.md> <file2.md> ...");
    Deno.exit(1);
  }

  let results: any[] = [];
  
  for (const path of filePaths) {
    try {
      const text = await Deno.readTextFile(path);
      // Find all standard URLs in the text
      const urls = Array.from(text.matchAll(/https?:\/\/[^\s)\]'"]+/g)).map(m => m[0]);
      const uniqueUrls = [...new Set(urls)];

      console.log(`\nScanning ${uniqueUrls.length} unique URLs from ${path}...`);
      
      let count = 0;
      for (const url of uniqueUrls) {
        const result = await fetchAndDiscover(url);
        if (result) {
          const company = getCompanyName(url, result.token);
          results.push({
            company_name: company,
            careers_url: url,
            ats_provider: result.ats,
            board_token: result.token
          });
          count++;
          // Print discovered
          console.log(` ✅ Found ${company} (${result.ats}: ${result.token})`);
        }
      }
      console.log(`Discovered ${count} ATS targets in ${path}`);
    } catch (err) {
      console.error(`Error processing file ${path}:`, err);
    }
  }

  // Generate SQL insert
  let sql = `-- Auto-generated ATS discoveries\n`;
  sql += `INSERT INTO company_directory (company_name, careers_url, ats_provider, board_token) VALUES \n`;
  
  // Unique by board_token
  const uniqueResults = [];
  const seen = new Set();
  for (const r of results) {
    if (!seen.has(r.board_token)) {
      seen.add(r.board_token);
      uniqueResults.push(r);
    }
  }

  if (uniqueResults.length > 0) {
    const values = uniqueResults.map(r => `  ('${r.company_name.replace(/'/g, "''")}', '${r.careers_url.replace(/'/g, "''")}', '${r.ats_provider}', '${r.board_token.replace(/'/g, "''")}')`).join(',\n');
    sql += values + `;\n`; // The table doesn't have a unique constraint on board_token yet, so we just insert.
    
    await ensureDir('./supabase/migrations');
    // Using a timestamp for the migration filename
    const timestamp = new Date().toISOString().replace(/\D/g, '').substring(0, 14);
    const filename = `./supabase/migrations/${timestamp}_seed_discovered_ats.sql`;
    
    await Deno.writeTextFile(filename, sql);
    console.log(`\n🚀 Discovered ${uniqueResults.length} TOTAL unique ATS targets!`);
    console.log(`📝 Wrote SQL migration to: ${filename}`);
    console.log(`Run this file in your Supabase SQL editor to add these companies to your database.`);
  } else {
    console.log("\nNo ATS targets discovered.");
  }
}

if (import.meta.main) {
  main();
}
