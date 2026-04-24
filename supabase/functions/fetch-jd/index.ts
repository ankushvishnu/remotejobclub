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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { job_id } = await req.json()
    if (!job_id) throw new Error("Missing job_id")

    // Get the job
    const { data: job, error: fetchErr } = await supabaseClient
      .from('job_postings')
      .select('id, url, description')
      .eq('id', job_id)
      .single()

    if (fetchErr) throw fetchErr
    if (!job) throw new Error("Job not found")

    if (job.description && job.description.length > 50) {
      return new Response(JSON.stringify({ description: job.description }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!job.url) throw new Error("Job missing URL")

    const urlStr = job.url;
    let html = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Ashby
      if (urlStr.includes('ashbyhq.com')) {
        const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
        const company = parts[0];
        const jobId = parts[1];
        if (company) {
          const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`, { signal: controller.signal });
          const json = await res.json();
          const target = json.jobs?.find((j: any) => j.id === jobId);
          if (target && target.descriptionHtml) {
            html = target.descriptionHtml;
          }
        }
      } 
      // Greenhouse
      else if (urlStr.includes('boards.greenhouse.io')) {
        const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
        const company = parts[0];
        const jobId = parts[2];
        if (company && jobId) {
          const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`, { signal: controller.signal });
          const json = await res.json();
          if (json.content) html = json.content;
        }
      }
      // Lever
      else if (urlStr.includes('jobs.lever.co')) {
        const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
        const company = parts[0];
        const jobId = parts[1];
        if (company && jobId) {
          const res = await fetch(`https://api.lever.co/v0/postings/${company}/${jobId}`, { signal: controller.signal });
          const json = await res.json();
          if (json.descriptionPlain) {
            html = json.descriptionPlain + " " + (json.lists || []).map((l: any) => l.text).join(" ");
          }
        }
      }

      // Fallback to raw HTML scraping if ATS API failed or unsupported ATS
      if (!html) {
        const res = await fetch(urlStr, { signal: controller.signal });
        if (res.ok) {
          html = await res.text();
        }
      }
      clearTimeout(timeoutId);

    } catch (e) {
      console.warn("Failed to fetch JD from source:", e);
    }

    if (!html || html.includes("You need to enable JavaScript")) {
      throw new Error("Could not extract description. Please visit the site directly.");
    }

    // Basic HTML to Text extraction
    let cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, ' ') // Strip tags again in case decoding formed new ones
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500);

    if (cleanText.length > 100) {
      // Use service_role or regular user auth if policies allow update
      // By default users can't update job_postings unless RLS allows it. 
      // We will use service_role to update it.
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await adminClient.from('job_postings').update({ description: cleanText }).eq('id', job_id);
    }

    return new Response(JSON.stringify({ description: cleanText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("fetch-jd error:", err)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
