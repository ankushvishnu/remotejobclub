import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com" // Use https://api-m.paypal.com for production

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized')
    }
    const token = authHeader.replace('Bearer ', '')

    const { orderID, tier } = await req.json()
    if (!orderID || !tier) throw new Error("Missing orderID or tier")

    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      throw new Error("PayPal secrets are not set in the Edge Function")
    }

    // 1. Verify User
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error("Invalid user session")

    // 2. Get PayPal Access Token
    const basicAuth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
    const tokenReq = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    })

    if (!tokenReq.ok) {
      const err = await tokenReq.text()
      throw new Error(`Failed to get PayPal token: ${err}`)
    }

    const { access_token } = await tokenReq.json()

    // 3. Capture Order
    const captureReq = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      }
    })

    if (!captureReq.ok) {
      const err = await captureReq.text()
      throw new Error(`Failed to capture PayPal order: ${err}`)
    }

    const captureData = await captureReq.json()
    if (captureData.status !== 'COMPLETED') {
      throw new Error(`Order capture not completed. Status: ${captureData.status}`)
    }

    // 4. Upgrade User Tier
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: tier,
        current_cycle_start: new Date().toISOString(),
        cycle_job_views: 0,
        cycle_resume_reviews: 0
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
