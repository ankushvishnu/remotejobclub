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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Fetch active targets from the company_directory table
    const { data: targets, error: fetchErr } = await supabaseClient
      .from('company_directory')
      .select('*')
      .eq('status', 'ACTIVE')

    if (fetchErr) throw fetchErr

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active companies found in directory' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let allJobs: any[] = [];

    // Helper to fetch and parse Ashby
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

    // Helper to fetch and parse Greenhouse
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

    // Helper to fetch and parse Lever
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

    // Execute fetches
    for (const t of targets) {
      try {
        let jobs = [];
        if (t.ats_provider === 'ashby') jobs = await fetchAshby(t.company_name, t.board_token);
        if (t.ats_provider === 'greenhouse') jobs = await fetchGreenhouse(t.company_name, t.board_token);
        if (t.ats_provider === 'lever') jobs = await fetchLever(t.company_name, t.board_token);
        if (jobs && jobs.length > 0) allJobs = [...allJobs, ...jobs.slice(0, 30)]; // Take top 30 from each
      } catch (err) {
        console.warn(`Failed scraping ${t.company_name}`, err);
      }
    }

    if (allJobs.length > 0) {
      // Clear out old apify/google jobs to strictly ensure direct ATS URLs are present
      await supabaseClient.from('job_postings').delete().neq('ats_source', 'ashby').neq('ats_source', 'greenhouse').neq('ats_source', 'lever');

      const { error: insertErr } = await supabaseClient
        .from('job_postings')
        .upsert(allJobs, { onConflict: 'semantic_hash', ignoreDuplicates: true });
        
      if (insertErr) console.error("Insert error:", insertErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      scraped_count: allJobs.length,
      companies_checked: targets.length
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("ingest-ats error:", err)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
