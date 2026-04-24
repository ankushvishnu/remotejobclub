# remotejob.club — Improvement Checklist

## 1. Pricing Page

- [ ] Add a **Free tier card** alongside Pro and Elite so all three are visible side by side
- [ ] Free tier copy: *"Get started free. 15 curated job views with direct apply links. 5 AI resume scans. No credit card required."*
- [ ] Add *"One-time payment. No subscription."* under both Pro ($15) and Elite ($25) prices
- [ ] Fix **Pro Pass** feature copy:
  - Change *"Access to hidden ATS endpoints"* → *"Direct apply links from company career pages — no Google redirects"*
- [ ] Fix **Elite Pass** feature copy:
  - Change *"Priority algorithm processing"* → *"Full company database scan — 200+ career pages searched"*

---

## 2. CTA Improvements

- [ ] Add a **sticky bottom bar** that appears after free match results load:
  ```
  "You matched [X] more jobs — Upgrade to see all → [GET PRO]"
  ```
  - Pull real job count from DB minus what they already saw
  - Real number converts better than vague "upgrade for more"
- [ ] Make the sticky bar persist as the user scrolls through their 5–8 free matches
- [ ] Add urgency to apply links — show remaining click count:
  ```
  "22 of 40 applications sent"
  ```

---

## 3. LLM / Resume Scan Improvements

### System Prompt
Replace current prompt with structured JSON-only output:

```python
system_prompt = """
You are a job match analyst for remote roles.

Given a resume and a list of job listings,
score each job 0-100 based on:
  - Skills overlap (40 points)
  - Experience level match (25 points)
  - Domain/industry relevance (20 points)
  - Remote compatibility signals (15 points)

Return ONLY this JSON, nothing else:
{
  "matches": [
    {
      "job_id": "string",
      "score": 85,
      "matched_skills": ["Python", "LLM"],
      "missing_skills": ["Kubernetes"],
      "why": "Strong AI background matches this MLOps role. Missing k8s but not a dealbreaker.",
      "apply_confidence": "high|medium|low"
    }
  ]
}
"""
```

### Error Handling (OpenRouter Rate Limits)
- [ ] Free models hit rate limits aggressively (20 req/min, ~200 req/day)
- [ ] Add fallback logic:
  ```
  Try Gemma 2.6 (free primary)
    ↓ fails or rate limited
  Try Llama fallback (free)
    ↓ fails
  Queue retry after 90 seconds
    ↓ still fails
  Show cached similar matches instead
  ```
- [ ] Show user-facing message on rate limit:
  ```
  "Resume scan queued — results in ~2 mins"
  ```
  Never show a raw API error to the user.

### Match Results UI
- [ ] Each match card must show:
  - Match score badge (e.g. **85% match**)
  - One-line *"why this fits you"* explanation (from `why` field)
  - Direct apply link
  - "Save this job" button
- [ ] Show `apply_confidence` as a visual indicator (high = green, medium = amber, low = grey)

---

## 4. Job Freshness

- [ ] Only match resumes against jobs **scraped within last 30 days**
- [ ] Show *"Posted X days ago"* on every job card
- [ ] Grey out jobs older than 21 days with label: *"May already be filled"*
- [ ] When cron deletes stale jobs:
  - Also invalidate those jobs from users' saved lists
  - Show *"This role has been filled or removed"* instead of a dead link

---

## 5. Apply Link Scarcity (Use It as Marketing)

- [ ] Show remaining click count on each apply link:
  ```
  "22 of 40 applications sent"
  ```
- [ ] Add this as a **landing page headline**:
  ```
  "We limit applications per listing to protect your chances.
   Fewer applicants. Better odds."
  ```
  This is your biggest differentiator vs every other job board. Lead with it.

---

## 6. Analytics & Tracking (Build Now, Monetize Later)

- [ ] Track per user:
  - Which jobs they clicked apply on
  - Which job categories they viewed most
  - Which resume types matched which roles
- [ ] Track per job listing:
  - Total apply link clicks
  - Total views
  - Conversion rate (views → apply clicks)
- [ ] This data enables future **B2B revenue**:
  - Tell companies: *"47 qualified candidates viewed your role this month"*
  - Charge for sponsored/priority listings
  - Sell aggregate hiring trend reports

---

## 7. Stale Job Handling in Saved Lists

- [ ] When a job is deleted by cron:
  - Flag it in the saved_jobs table (`status: removed`)
  - Show *"This role has been filled or removed"* in the user's saved jobs view
  - Do NOT silently delete it from their list — show what happened

---

## 8. Landing Page Copy Priorities

- [ ] Lead with the apply limit angle:
  ```
  "We limit who can apply to each job.
   Fewer competitors. Better chances."
  ```
- [ ] Add social proof section as soon as you have any user numbers:
  ```
  "2,000+ remote jobs. Updated daily.
   Direct apply links. No aggregator noise."
  ```
- [ ] Add *"No credit card required"* near the free tier CTA

---

## Quick Priority Order

```
This week
  1. Fix pricing page copy (30 mins)
  2. Add sticky CTA bar after match results (1-2 hrs)
  3. Update LLM system prompt to structured JSON (1 hr)
  4. Add error handling for OpenRouter rate limits (1 hr)
  5. Add "Posted X days ago" to job cards (30 mins)

Next week
  6. Apply link click counter visible to users
  7. Stale job handling in saved lists
  8. Landing page copy rewrite
  9. Analytics tracking setup

Later
  10. B2B sponsored listing infrastructure
```
