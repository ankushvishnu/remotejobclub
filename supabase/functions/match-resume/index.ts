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
        // Rate limited — try fallback model
        res = await makeRequest(FALLBACK_MODEL)
      }
      if (!res.ok) {
        const errText = await res.text()
        // Check if it's still a rate limit
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

    const curationPrompt = `You are an elite tech recruiter AI.
Candidate Keywords: ${keywords.join(", ")}
Constraints: Role=${constraints?.role||'Any'}, Location=${constraints?.location||'Any'}, Tech=${constraints?.tech||'Any'}, Arrangement=${constraints?.arrangement||'Any'}

Available DB Jobs:
${JSON.stringify(matchedJobs.slice(0, 15).map((j: any) => ({ id: j.id, title: j.title, company: j.company_domain, tech: j.tech_stack, location: j.location, arrangement: j.work_arrangement, snippet: j.description ? j.description.substring(0, 300) : '' })))}

Score matching jobs for this candidate from 1 to 10 based on exact skills match. Provide exactly 2 sentences of 'curation_notes'.
Return ONLY valid JSON in this exact structure:
{
  "matches": [
    { "id": "job_id_here", "match_score": 9.5, "curation_notes": "notes here" }
  ]
}
`
    const curateData = await callLLM({
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: curationPrompt }]
    })
    if (curateData.usage?.total_tokens) totalTokensUsed += curateData.usage.total_tokens;

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
      const jobBase = matchedJobs.find((j: any) => j.id === c.id) || matchedJobs[0]
      return {
        ...jobBase,
        match_score: c.match_score || 8.0,
        curation_notes: c.curation_notes || "Fits the specified constraints cleanly."
      }
    }).filter((job: any) => {
      if (!job || seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })
    
    // Truncate based on tier limits for results (just 10 normally anyway, but let's just show top 5-10)
    // The requirement was "Free tier will get 2 matches only...". This meant 2 reviews, not 2 jobs in the result, but let's limit the result array just to be safe.
    const resultCount = tier === 'free' ? 5 : 10;
    const limitedMatches = finalMatches.slice(0, resultCount);

    // Charge the quota since it succeeded
    await supabaseAdmin
      .from('profiles')
      .update({ 
        cycle_resume_reviews: currentReviews + 1,
        openrouter_token_count: (profile?.openrouter_token_count || 0) + totalTokensUsed
      })
      .eq('id', user.id)

    return new Response(JSON.stringify({ matches: limitedMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("match-resume error:", err)
    
    let status = 500
    let message = "Something went wrong. Please try again."
    
    if (err.message === 'RATE_LIMIT') {
      status = 429
      message = "Our AI models are experiencing high demand right now. Please wait a minute and try again. Your scan was not charged."
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
