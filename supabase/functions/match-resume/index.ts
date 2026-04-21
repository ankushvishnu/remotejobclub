import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract bearer token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing authorization header.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const token = authHeader.replace('Bearer ', '')

    // Use admin client to verify user server-side (avoids ES256 local parse issue)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // User-context client for DB queries (respects RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { resumeText, constraints } = await req.json()

    if (!resumeText) {
      return new Response(JSON.stringify({ error: 'No resume text provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openRouterKey) {
      throw new Error("OPENROUTER_API_KEY is not set in Edge Function secrets")
    }

    // Step 1: Extract keywords from resume via LLM
    const prompt = `Analyze this candidate resume and extract the top 3 core technical skills/keywords.
Return ONLY valid JSON: {"title": "job title", "keywords": ["skill1", "skill2", "skill3"]}.
Resume: \n${resumeText}`

    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/elephant-alpha",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }]
      })
    })

    if (!orRes.ok) {
      const errText = await orRes.text()
      throw new Error(`OpenRouter API Error: ${errText}`)
    }

    const orData = await orRes.json()
    let keywords = ["software", "engineer"]
    try {
      const content = orData.choices?.[0]?.message?.content || "{}"
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.keywords && Array.isArray(parsed.keywords)) {
        keywords = parsed.keywords
      }
    } catch(e) {
      console.warn("Failed to parse OpenRouter response", e)
    }

    // Step 2: Query DB for ACTIVE jobs
    const { data: dbJobs, error: dbError } = await supabaseClient
      .from('job_postings')
      .select('*')
      .eq('status', 'ACTIVE')
      .ilike('title', `%${constraints?.role || ''}%`)
      .limit(30)

    if (dbError) throw dbError

    const matchedJobs = dbJobs || []

    // If no DB jobs match, return empty gracefully — no external fallback
    if (matchedJobs.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 3: LLM curation pass over DB jobs
    const curationPrompt = `You are an elite tech recruiter AI.
Candidate Keywords: ${keywords.join(", ")}
Constraints: Role=${constraints?.role||'Any'}, Location=${constraints?.location||'Any'}, Tech=${constraints?.tech||'Any'}, Arrangement=${constraints?.arrangement||'Any'}

Available DB Jobs:
${JSON.stringify(matchedJobs.slice(0, 15).map((j: any) => ({ title: j.title, company: j.company_domain, tech: j.tech_stack, location: j.location, arrangement: j.work_arrangement })))}

Score matching jobs for this candidate from 1 to 10 based on exact skills match. Provide exactly 2 sentences of 'curation_notes'.
Return ONLY valid JSON in this exact structure:
{
  "matches": [
    { "title": "job_title", "company_domain": "company", "match_score": 9.5, "curation_notes": "notes here" }
  ]
}
`
    const curateRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/elephant-alpha",
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: curationPrompt }]
      })
    })

    if (!curateRes.ok) {
      const errText = await curateRes.text()
      throw new Error(`OpenRouter API Error during curation: ${errText}`)
    }

    const curateData = await curateRes.json()
    let curated: any[] = []
    try {
      const content = curateData.choices?.[0]?.message?.content || "{}"
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      curated = parsed.matches || []
    } catch(e) {
      console.warn("Failed to parse curation", e)
    }

    // Build matches and deduplicate by job id to prevent duplicate React keys
    const seen = new Set<string>()
    const finalMatches = curated.map((c: any) => {
      const jobBase = matchedJobs.find((j: any) => j.title === c.title || j.company_domain === c.company_domain) || matchedJobs[0]
      return {
        ...jobBase,
        match_score: c.match_score || 8.0,
        curation_notes: c.curation_notes || "Fits the specified constraints cleanly."
      }
    }).filter((job: any) => {
      if (!job || seen.has(job.id)) return false
      seen.add(job.id)
      return true
    }).slice(0, 5)

    return new Response(JSON.stringify({ matches: finalMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("match-resume error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
