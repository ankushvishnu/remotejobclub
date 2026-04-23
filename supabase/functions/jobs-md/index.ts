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
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response('Error: Missing job ID parameter.', {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: job, error } = await supabaseAdmin
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .eq('status', 'ACTIVE')
      .single()

    if (error || !job) {
      return new Response('Error: Job not found or is no longer active.', {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const markdown = `# ${job.title}

**Company:** ${job.company_domain}
**Location:** ${job.location || 'Remote'}
**ATS Source:** ${job.ats_source}
**Posted / Scraped:** ${new Date(job.created_at).toLocaleDateString()}
**Salary Range:** ${job.salary_range || 'Not specified'}
**Work Arrangement:** ${job.work_arrangement || 'Remote'}

## Apply Now
[Direct Apply Link](${job.url})

${job.curation_notes ? `## Curation Notes\n${job.curation_notes}\n` : ''}
${job.tech_stack?.length > 0 ? `## Tech Stack\n${job.tech_stack.join(', ')}\n` : ''}

## Description
${job.description || 'No description available.'}

---
*This job was sourced and verified by The Remote ATS Vault.*
`

    return new Response(markdown, {
      headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' }
    })

  } catch (err: any) {
    return new Response(`Error: ${err.message}`, {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})
