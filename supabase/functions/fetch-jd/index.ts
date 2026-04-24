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

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    const res = await fetch(job.url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("Failed to fetch JD from source")

    const html = await res.text();
    // Basic HTML to Text extraction (strip scripts, styles, and tags)
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500); // Take first 1500 chars as summary

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
