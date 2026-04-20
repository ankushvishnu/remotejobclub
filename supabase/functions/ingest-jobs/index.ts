import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { crypto } from "jsr:@std/crypto"
import { encodeHex } from "jsr:@std/encoding/hex"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeDomain(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

async function getSemanticHash(title: string, domain: string) {
  const message = new TextEncoder().encode(title + domain);
  const hashBuffer = await crypto.subtle.digest("SHA-256", message);
  return encodeHex(hashBuffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Optional: add admin check via custom claims or checking role.
    
    // Request format: { boards: [{ type: 'lever', token: 'linear', domain: 'linear.app' }] }
    // If not provided, we can fallback to some defaults.
    const { boards = [
      { type: 'lever', token: 'figma', domain: 'figma.com' },
      { type: 'lever', token: 'linear', domain: 'linear.app' },
      { type: 'lever', token: 'anthropic', domain: 'anthropic.com' }
    ] } = await req.json().catch(() => ({}))

    let totalFetched = 0
    let duplicates = 0
    let added = 0

    const results = []

    for (const board of boards) {
      if (board.type === 'lever') {
        try {
          const res = await fetch(`https://api.lever.co/v0/postings/${board.token}?mode=json`)
          if (!res.ok) continue
          const data = await res.json()
          
          if (Array.isArray(data)) {
            totalFetched += data.length
            
            for (const j of data) {
              const normDomain = normalizeDomain(board.domain)
              const hash = await getSemanticHash(j.text, normDomain)
              
              const jobData = {
                company_domain: normDomain,
                job_source_id: j.id,
                semantic_hash: hash,
                title: j.text,
                description: j.descriptionPlain || j.description || '',
                url: j.hostedUrl,
                status: 'UNVERIFIED', // Will be picked up by AI Curator later, or ACTIVE for now
                ats_source: 'lever',
                location: j.categories?.location || j.categories?.commitment || ''
              }

              const { error } = await supabaseClient
                .from('job_postings')
                .insert(jobData)
              
              if (error) {
                if (error.code === '23505') { // Unique violation
                  duplicates++
                } else {
                  console.error("Insertion error:", error)
                }
              } else {
                added++
              }
            }
          }
          results.push({ board: board.domain, status: 'success' })
        } catch(e) {
          console.error(`Error scraping ${board.domain}`, e)
          results.push({ board: board.domain, status: 'failed', error: String(e) })
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Ingestion complete', totalFetched, added, duplicates, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
