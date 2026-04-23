import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, Check, Heart } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

export function UpgradePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const createOrder = async (tier: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in to purchase.");

      const response = await fetch('https://rikvsulujezoxmcxeauk.supabase.co/functions/v1/paypal-create-order', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ tier })
      });

      const orderData = await response.json();
      if (orderData.id) {
        return orderData.id;
      } else {
        throw new Error(orderData.error || "Could not initialize order");
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      return null;
    }
  };

  const onApprove = async (data: any, tier: string) => {
    setLoadingTier(tier);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired.");

      const response = await fetch('https://rikvsulujezoxmcxeauk.supabase.co/functions/v1/paypal-capture-order', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ orderID: data.orderID, tier })
      });

      const captureData = await response.json();
      if (captureData.success) {
        alert("Payment successful! Your account has been upgraded. Welcome to the Vault!");
        navigate('/dashboard');
      } else {
        throw new Error(captureData.error || "Capture failed");
      }
    } catch (err: any) {
      alert(`Payment Capture Error: ${err.message}`);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex-grow flex flex-col items-center gap-12 py-4 pb-20"
    >
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-3xl font-bold text-[var(--color-brand-amber)] tracking-tight">Keep the Vault Running</h1>
        
        <div className="bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border)] p-8 text-left space-y-4 shadow-xl">
          <div className="flex items-center gap-3 text-[var(--color-brand-amber)] pb-2 border-b border-[var(--color-brand-border)]">
            <Heart className="w-5 h-5" />
            <h2 className="font-semibold text-lg">A note from the developer</h2>
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-brand-muted)]">
            Hey there, I built The Remote ATS Vault because I was sick of wading through endless noise on public job boards just to find out a role was already filled or a "ghost job."
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-brand-muted)]">
            I designed our custom ATS scrapers and AI filtering logic for myself, but quickly realized it could help thousands of others land their dream remote roles.
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-brand-muted)]">
            <strong>Here's the honest truth:</strong> Running the scraping servers and the elite AI models (OpenRouter) costs money. Every resume scan burns API tokens. I don't want to lock you into an annoying recurring subscription you'll forget about. 
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-brand-text)] font-semibold">
            Our passes are strictly one-time payments for 30 days of access. Like a great dating app, our goal is for you to find what you need and delete us after your first month.
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-brand-muted)]">
            If you've found value here, buying a pass directly supports me and keeps the lights on. Thank you.
          </p>
        </div>
      </div>

      <PayPalScriptProvider options={{ "clientId": PAYPAL_CLIENT_ID, components: "buttons", currency: "USD" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          
          {/* PRO TIER */}
          <div className="bg-transparent border-2 border-[var(--color-brand-border)] flex flex-col">
            <div className="p-6 border-b border-[var(--color-brand-border)] flex-grow">
              <div className="flex items-center gap-2 text-[var(--color-brand-text)] mb-2">
                <Shield className="w-5 h-5" />
                <h3 className="text-xl font-bold">Pro Pass</h3>
              </div>
              <p className="text-xs text-[var(--color-brand-muted)] mb-6">30 days of elevated access.</p>
              
              <div className="text-4xl font-bold text-white mb-6">
                $15 <span className="text-sm text-[var(--color-brand-muted)] font-normal">/ 30 days</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-muted)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-green)] shrink-0 mt-0.5" />
                  <span><strong>45</strong> Job Views & Direct Apply links</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-muted)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-green)] shrink-0 mt-0.5" />
                  <span><strong>15</strong> Elite AI Resume Scans</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-muted)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-green)] shrink-0 mt-0.5" />
                  <span>Access to hidden ATS endpoints</span>
                </li>
              </ul>
            </div>
            
            <div className="p-6 bg-[var(--color-brand-bg2)] z-0 min-h-[150px] relative">
              {loadingTier === 'pro' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-brand-bg2)]/80">
                  <span className="text-[var(--color-brand-amber)] animate-pulse text-sm font-semibold">PROCESSING...</span>
                </div>
              )}
              {PAYPAL_CLIENT_ID ? (
                <PayPalButtons 
                  style={{ layout: "vertical", color: "black" }} 
                  createOrder={() => createOrder('pro')}
                  onApprove={(data) => onApprove(data, 'pro')}
                />
              ) : (
                <div className="text-center text-xs text-red-500">PayPal not configured.</div>
              )}
            </div>
          </div>

          {/* ELITE TIER */}
          <div className="bg-[var(--color-brand-bg2)] border-2 border-[var(--color-brand-amber)] relative flex flex-col shadow-2xl shadow-[var(--color-brand-amber)]/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-brand-amber)] text-black text-[10px] font-bold px-3 py-1 tracking-wider uppercase">
              Maximum Firepower
            </div>
            
            <div className="p-6 border-b border-[var(--color-brand-border)] flex-grow">
              <div className="flex items-center gap-2 text-[var(--color-brand-amber)] mb-2">
                <Zap className="w-5 h-5" />
                <h3 className="text-xl font-bold">Elite Pass</h3>
              </div>
              <p className="text-xs text-[var(--color-brand-muted)] mb-6">30 days of unrestricted hunting.</p>
              
              <div className="text-4xl font-bold text-[var(--color-brand-amber)] mb-6">
                $25 <span className="text-sm text-[var(--color-brand-muted)] font-normal">/ 30 days</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-text)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-amber)] shrink-0 mt-0.5" />
                  <span><strong>75</strong> Job Views & Direct Apply links</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-text)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-amber)] shrink-0 mt-0.5" />
                  <span><strong>30</strong> Elite AI Resume Scans</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[var(--color-brand-text)]">
                  <Check className="w-4 h-4 text-[var(--color-brand-amber)] shrink-0 mt-0.5" />
                  <span>Priority algorithm processing</span>
                </li>
              </ul>
            </div>
            
            <div className="p-6 z-0 min-h-[150px] relative">
              {loadingTier === 'elite' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-brand-bg2)]/80">
                  <span className="text-[var(--color-brand-amber)] animate-pulse text-sm font-semibold">PROCESSING...</span>
                </div>
              )}
              {PAYPAL_CLIENT_ID ? (
                <PayPalButtons 
                  style={{ layout: "vertical", color: "gold" }} 
                  createOrder={() => createOrder('elite')}
                  onApprove={(data) => onApprove(data, 'elite')}
                />
              ) : (
                <div className="text-center text-xs text-red-500">PayPal not configured.</div>
              )}
            </div>
          </div>

        </div>
      </PayPalScriptProvider>
    </motion.div>
  );
}
