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

    // Check Quotas
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, cycle_resume_reviews, openrouter_token_count, current_cycle_start')
      .eq('id', user.id)
      .single()

    if (profileErr) throw profileErr

    let tier = profile?.subscription_tier || 'free'
    let currentReviews = profile?.cycle_resume_reviews || 0
    let cycleStart = profile?.current_cycle_start ? new Date(profile.current_cycle_start) : new Date()

    // Lazy Auto-downgrade
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (tier !== 'free' && cycleStart < thirtyDaysAgo) {
      tier = 'free'
      currentReviews = 0
      
      await supabaseAdmin.from('profiles').update({
        subscription_tier: 'free',
        cycle_job_views: 0,
        cycle_resume_reviews: 0,
        current_cycle_start: new Date().toISOString()
      }).eq('id', user.id)
    }
    
    let reviewLimit = 2; // Free
    if (tier === 'pro') reviewLimit = 15;
    else if (tier === 'elite') reviewLimit = 30;

    if (currentReviews >= reviewLimit) {
      return new Response(JSON.stringify({ error: `You have reached your ${tier.toUpperCase()} tier limit of ${reviewLimit} resume matches per cycle.` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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

    let totalTokensUsed = 0;

    // Step 1: Extract keywords from resume via LLM
    const prompt = `Analyze this candidate resume and extract the top 3 core technical skills/keywords.
Return ONLY valid JSON: {"title": "job title", "keywords": ["skill1", "skill2", "skill3"]}.
Resume: \n${resumeText}`

    const PRIMARY_MODEL = "inclusionai/ling-2.6-1t:free"
    const FALLBACK_MODEL = "meta-llama/llama-4-scout:free"

    // Helper: call OpenRouter with auto-retry on 429
    async function callLLM(body: Record<string, any>) {
      const makeRequest = (model: string) => fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model })
      })

      let res = await makeRequest(PRIMARY_MODEL)
      if (res.status === 429) {
        // Rate limited on primary — try fallback model immediately
        res = await makeRequest(FALLBACK_MODEL)
      }
      // If fallback also rate-limits, wait 10s and try primary once more
      if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 10000))
        res = await makeRequest(PRIMARY_MODEL)
      }
      if (!res.ok) {
        const errText = await res.text()
        if (res.status === 429 || errText.includes('rate-limit')) {
          throw new Error('RATE_LIMIT')
        }
        throw new Error(`AI_ERROR: ${errText}`)
      }
      return res.json()
    }

    const orData = await callLLM({
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }]
    })
    if (orData.usage?.total_tokens) totalTokensUsed += orData.usage.total_tokens;

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

    // Step 2: Query DB for ACTIVE jobs — ordered newest-first for diversity, large pool
    // Tier determines how deep the pool we query and how many matches we return
    const poolSize = tier === 'elite' ? 150 : tier === 'pro' ? 100 : 60

    let jobQuery = supabaseClient
      .from('job_postings')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(poolSize)

    // Only filter by role if a non-empty role constraint was provided
    if (constraints?.role && constraints.role.trim()) {
      jobQuery = jobQuery.ilike('title', `%${constraints.role.trim()}%`)
    }

    const { data: dbJobs, error: dbError } = await jobQuery

    if (dbError) throw dbError

    const matchedJobs = dbJobs || []

    // If no DB jobs match, return empty gracefully — no external fallback
    if (matchedJobs.length === 0) {
      // Still charge them a scan if it reached this far? Better to refund or not charge.
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 2.5: Lazy JD Fetching
    // Find up to 5 jobs that have NO description, fetch them, extract text, and save.
    const jobsWithoutJD = matchedJobs.filter((j: any) => !j.description).slice(0, 5);
    if (jobsWithoutJD.length > 0) {
      await Promise.all(jobsWithoutJD.map(async (job: any) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 second timeout

          const urlStr = job.url;
          let html = "";
          
          // Ashby
          if (urlStr.includes('ashbyhq.com')) {
            const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
            if (parts[0]) {
              const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${parts[0]}`, { signal: controller.signal });
              const json = await res.json();
              const target = json.jobs?.find((j: any) => j.id === parts[1]);
              if (target && target.descriptionHtml) html = target.descriptionHtml;
            }
          } 
          // Greenhouse
          else if (urlStr.includes('boards.greenhouse.io')) {
            const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
            if (parts[0] && parts[2]) {
              const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${parts[0]}/jobs/${parts[2]}`, { signal: controller.signal });
              const json = await res.json();
              if (json.content) html = json.content;
            }
          }
          // Lever
          else if (urlStr.includes('jobs.lever.co')) {
            const parts = new URL(urlStr).pathname.split('/').filter(Boolean);
            if (parts[0] && parts[1]) {
              const res = await fetch(`https://api.lever.co/v0/postings/${parts[0]}/${parts[1]}`, { signal: controller.signal });
              const json = await res.json();
              if (json.descriptionPlain) {
                html = json.descriptionPlain + " " + (json.lists || []).map((l: any) => l.text).join(" ");
              }
            }
          }

          // Fallback to raw HTML
          if (!html) {
            const res = await fetch(urlStr, { signal: controller.signal });
            if (res.ok) html = await res.text();
          }
          clearTimeout(timeoutId);

          if (html && !html.includes("You need to enable JavaScript")) {
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
              job.description = cleanText; // Update local memory
              // Update database asynchronously
              await supabaseClient.from('job_postings').update({ description: cleanText }).eq('id', job.id);
            }
          }
        } catch (err) {
          console.warn(`Failed lazy fetch for ${job.url}`);
        }
      }));
    }

    // How many jobs to feed the LLM — must fit in context window
    // Keep batch small: each entry ~80 tokens input + ~60 tokens output = ~140 tokens/job
    // At 4000 max_tokens output, we can safely get ~40 entries back
    const llmBatchSize = tier === 'elite' ? 40 : tier === 'pro' ? 30 : 20

    const curationPrompt = `You are a job match analyst for remote roles.

Score each job below 0-100 for this candidate.
Candidate Keywords: ${keywords.join(", ")}
Constraints: Role=${constraints?.role||'Any'}, Location=${constraints?.location||'Any'}, Tech=${constraints?.tech||'Any'}

Jobs to score:
${matchedJobs.slice(0, llmBatchSize).map((j: any, i: number) =>
  `[${i}] id:${j.id} title:"${j.title}" company:${j.company_domain} loc:${j.location||'Remote'} snippet:"${(j.description||'').substring(0,150)}"`
).join('\n')}

Return ONLY compact JSON - no explanation, no markdown:
{"matches":[{"id":"...","score":85,"why":"one sentence reason","conf":"high"}]}

Rules:
- Include ALL jobs with score >= 25 (be generous, include partial matches)
- conf must be: "high" (score>=75), "medium" (50-74), "low" (<50)
- Order by score descending
- If no jobs score above 25, include the top 5 by best fit anyway
`
    const curateData = await callLLM({
      max_tokens: 4000,
      messages: [{ role: "user", content: curationPrompt }]
    })
    if (curateData.usage?.total_tokens) totalTokensUsed += curateData.usage.total_tokens;

    let curated: any[] = []
    try {
      const content = curateData.choices?.[0]?.message?.content || "{}"
      // Strip markdown code fences if present
      const stripped = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      // Extract the JSON object
      const jsonMatch = stripped.match(/\{[\s\S]*\}/)
      const cleaned = jsonMatch ? jsonMatch[0] : stripped
      const parsed = JSON.parse(cleaned)
      curated = parsed.matches || []
      console.log(`LLM returned ${curated.length} matches from ${llmBatchSize} jobs`)
    } catch(e) {
      console.warn("Failed to parse curation response:", e)
      console.warn("Raw LLM content:", curateData.choices?.[0]?.message?.content?.substring(0, 500))
    }

    // Build matches and deduplicate by job id to prevent duplicate React keys
    const seen = new Set<string>()
    let finalMatches = curated.map((c: any) => {
      const jobBase = matchedJobs.find((j: any) => j.id === c.id)
      if (!jobBase) return null // skip if LLM hallucinated an ID
      const rawScore = c.score ?? c.match_score ?? 50
      const normalizedScore = rawScore <= 10 ? rawScore * 10 : rawScore
      return {
        ...jobBase,
        match_score: normalizedScore,
        score: normalizedScore,
        matched_skills: c.matched_skills || [],
        missing_skills: c.missing_skills || [],
        why: c.why || '',
        apply_confidence: c.conf || c.apply_confidence || (normalizedScore >= 75 ? 'high' : normalizedScore >= 50 ? 'medium' : 'low'),
        curation_notes: c.why || 'Fits the specified constraints.'
      }
    }).filter((job: any) => {
      if (!job || seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })

    // Tier-based result caps — separate from apply-click limits
    // Free: 5  |  Pro: 15  |  Elite: 30
    const resultCount = tier === 'elite' ? 30 : tier === 'pro' ? 15 : 5;

    // FALLBACK: if LLM returned nothing (parse error / all below threshold), return top jobs from pool directly
    if (finalMatches.length === 0 && matchedJobs.length > 0) {
      console.warn('LLM curation returned 0 results — using fallback: top jobs from pool')
      finalMatches = matchedJobs.slice(0, resultCount).map((j: any) => ({
        ...j,
        match_score: 60,
        score: 60,
        matched_skills: [],
        missing_skills: [],
        why: 'Keyword match from resume analysis.',
        apply_confidence: 'medium',
        curation_notes: 'Keyword match from resume analysis.'
      }))
    }
    
    const limitedMatches = finalMatches.slice(0, resultCount);

    // Charge the quota since it succeeded
    await supabaseAdmin
      .from('profiles')
      .update({ 
        cycle_resume_reviews: currentReviews + 1,
        openrouter_token_count: (profile?.openrouter_token_count || 0) + totalTokensUsed
      })
      .eq('id', user.id)

    return new Response(JSON.stringify({ matches: limitedMatches, tier, total_scored: finalMatches.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("match-resume error:", err)
    
    let status = 500
    let message = "Something went wrong. Please try again."
    
    if (err.message === 'RATE_LIMIT') {
      status = 429
      message = "Resume scan queued — our AI models are at capacity right now. Please wait ~2 minutes and try again. Your scan was not charged."
    } else if (err.message.includes('reached your')) {
      status = 403
      message = err.message
    } else if (err.message.includes('AI_ERROR')) {
      status = 502
      message = "Our AI service is temporarily unavailable. Please try again in a few minutes. Your scan was not charged."
    }
    
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
