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

    const { tier } = await req.json()
    
    let price = "15.00"
    if (tier === 'elite') price = "25.00"
    else if (tier !== 'pro') throw new Error('Invalid tier')

    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      throw new Error("PayPal secrets are not set in the Edge Function")
    }

    // 1. Get PayPal Access Token
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

    // 2. Create Order
    const orderReq = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: price
            },
            description: `The Remote ATS Vault - 30-Day ${tier.toUpperCase()} Pass`
          }
        ]
      })
    })

    if (!orderReq.ok) {
      const err = await orderReq.text()
      throw new Error(`Failed to create PayPal order: ${err}`)
    }

    const orderData = await orderReq.json()

    return new Response(JSON.stringify({ id: orderData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
