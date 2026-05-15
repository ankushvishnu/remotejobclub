import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { limit = 50, offset = 0 } = await req.json().catch(() => ({}));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Fetch batch of targets to avoid resource exhaustion
    const { data: targets, error: fetchErr } = await supabaseClient
      .from('company_directory')
      .select('*')
      .eq('status', 'ACTIVE')
      .range(offset, offset + limit - 1);

    if (fetchErr) throw fetchErr

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No more active companies to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Helper Fetchers
    const fetchAshby = async (company: string, board: string) => {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map((j: any) => ({
        company_domain: company.toLowerCase() + '.placeholder',
        title: j.title || 'Untitled',
        location: j.location || 'Remote',
        url: j.jobUrl || j.url,
        ats_source: 'ashby',
        status: 'ACTIVE',
        semantic_hash: `${company}-${j.title}`.replace(/[^a-zA-Z0-9]/g, '')
      }));
    };

    const fetchGreenhouse = async (company: string, board: string) => {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map((j: any) => ({
        company_domain: company.toLowerCase() + '.placeholder',
        title: j.title || 'Untitled',
        location: j.location?.name || 'Remote',
        url: j.absolute_url,
        ats_source: 'greenhouse',
        status: 'ACTIVE',
        semantic_hash: `${company}-${j.title}`.replace(/[^a-zA-Z0-9]/g, '')
      }));
    };

    const fetchLever = async (company: string, board: string) => {
      const res = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`);
      if (!res.ok) return [];
      const jobs = await res.json();
      return jobs.map((j: any) => ({
        company_domain: company.toLowerCase() + '.placeholder',
        title: j.text || 'Untitled',
        location: j.categories?.location || j.categories?.commitment || 'Remote',
        url: j.hostedUrl,
        ats_source: 'lever',
        status: 'ACTIVE',
        semantic_hash: `${company}-${j.text}`.replace(/[^a-zA-Z0-9]/g, '')
      }));
    };

    // Process companies with limited concurrency (10 at a time)
    const CONCURRENCY_LIMIT = 10;
    let allJobs: any[] = [];
    
    for (let i = 0; i < targets.length; i += CONCURRENCY_LIMIT) {
      const chunk = targets.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.all(chunk.map(async (t) => {
        try {
          if (t.ats_provider === 'ashby') return await fetchAshby(t.company_name, t.board_token);
          if (t.ats_provider === 'greenhouse') return await fetchGreenhouse(t.company_name, t.board_token);
          if (t.ats_provider === 'lever') return await fetchLever(t.company_name, t.board_token);
          return [];
        } catch (e) {
          console.error(`Error fetching ${t.company_name}:`, e);
          return [];
        }
      }));
      
      results.forEach(jobs => {
        if (jobs) allJobs = [...allJobs, ...jobs.slice(0, 30)];
      });
    }

    if (allJobs.length > 0) {
      // NOTE: Only clear out old jobs if you are running the VERY FIRST batch (offset 0)
      // or consider removing this delete line if you want to keep data from previous batch runs
      if (offset === 0) {
        await supabaseClient.from('job_postings').delete()
          .in('ats_source', ['ashby', 'greenhouse', 'lever']);
      }

      const { error: insertErr } = await supabaseClient
        .from('job_postings')
        .upsert(allJobs, { onConflict: 'semantic_hash', ignoreDuplicates: true });
        
      if (insertErr) throw insertErr;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      scraped_count: allJobs.length,
      companies_processed: targets.length,
      next_offset: offset + targets.length
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
