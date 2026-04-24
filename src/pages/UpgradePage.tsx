import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Check, Heart, Lock, Star, ArrowRight, Sparkles } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

export function UpgradePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) { setLoadingProfile(false); return; }
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setUserTier(data?.subscription_tier || 'free');
        setLoadingProfile(false);
      });
  }, [user]);

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
        setUserTier(tier);
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

  // ── Tier-aware hero banner ──────────────────────────────────────────────────
  const HeroBanner = () => {
    if (loadingProfile) return <div className="h-32 animate-pulse bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border)] w-full max-w-2xl" />;

    if (userTier === 'elite') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl border-2 border-[var(--color-brand-amber)] bg-[var(--color-brand-amber)]/5 p-8 text-center space-y-3"
        >
          <div className="flex items-center justify-center gap-2 text-[var(--color-brand-amber)]">
            <Zap className="w-6 h-6" />
            <span className="text-xs font-bold tracking-widest uppercase">Elite Operator</span>
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-brand-amber)] tracking-tight">
            Thank you. Seriously.
          </h1>
          <p className="text-sm text-[var(--color-brand-muted)] leading-relaxed max-w-lg mx-auto">
            You're on Elite — the highest tier we offer. Your support keeps the scrapers running,
            the servers online, and the Vault full of verified opportunities. You've got full access.
            Go land that role.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/terminal')}
              className="px-6 py-2.5 bg-[var(--color-brand-amber)] text-black font-bold tracking-widest text-sm hover:bg-[#f5b545] transition-colors flex items-center gap-2"
            >
              SCAN VAULT <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 border border-[var(--color-brand-border-hi)] text-[var(--color-brand-muted)] text-sm hover:text-[var(--color-brand-text)] transition-colors"
            >
              BROWSE JOBS
            </button>
          </div>
        </motion.div>
      );
    }

    if (userTier === 'pro') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl border border-[var(--color-brand-green)] bg-[var(--color-brand-green)]/5 p-8 text-center space-y-3"
        >
          <div className="flex items-center justify-center gap-2 text-[var(--color-brand-green)]">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold tracking-widest uppercase">Pro Operator</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-brand-text)] tracking-tight">
            Thank you for supporting the Vault. 🙏
          </h1>
          <p className="text-sm text-[var(--color-brand-muted)] leading-relaxed max-w-lg mx-auto">
            You're on Pro — you have 45 direct apply links and 15 AI resume scans per cycle.
            That's enough to run a serious job search. If you want to go deeper — more matches,
            larger company database scans — Elite is one step up.
          </p>
          <p className="text-xs text-[var(--color-brand-muted)]/70 italic">
            No pressure. Use what you have. Elite is there when you're ready.
          </p>
        </motion.div>
      );
    }

    // Free tier
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl text-center space-y-4"
      >
        <h1 className="text-3xl font-bold text-[var(--color-brand-amber)] tracking-tight">
          {user ? 'Unlock the Full Vault' : 'Keep the Vault Running'}
        </h1>
        {user && (
          <p className="text-sm text-[var(--color-brand-muted)] max-w-lg mx-auto leading-relaxed">
            You're on the free tier. You get 15 job views and 2 resume scans. Upgrading unlocks direct
            apply links to more roles — no job board middlemen, no ghost listings.
          </p>
        )}
      </motion.div>
    );
  };

  // Only show the developer note for free users / logged-out
  const showDevNote = !userTier || userTier === 'free';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex-grow flex flex-col items-center gap-10 py-4 pb-20"
    >
      <HeroBanner />

      {showDevNote && (
        <div className="max-w-2xl w-full">
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
      )}

      {/* Pricing cards — hide elite card for elite users, hide pro card for elite users */}
      <PayPalScriptProvider options={{ "clientId": PAYPAL_CLIENT_ID, components: "buttons", currency: "USD" }}>
        <div className={`grid gap-6 w-full max-w-4xl ${userTier === 'elite' ? 'hidden' : userTier === 'pro' ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-3'}`}>

          {/* FREE TIER — only show when not logged in or free */}
          {(!userTier || userTier === 'free') && (
            <div className="bg-transparent border border-[var(--color-brand-border-hi)] flex flex-col opacity-70">
              <div className="p-6 border-b border-[var(--color-brand-border)] flex-grow">
                <div className="flex items-center gap-2 text-[var(--color-brand-muted)] mb-2">
                  <Lock className="w-5 h-5" />
                  <h3 className="text-xl font-bold">Free</h3>
                </div>
                <p className="text-xs text-[var(--color-brand-muted)] mb-6">No credit card required.</p>
                <div className="text-4xl font-bold text-[var(--color-brand-muted)] mb-1">$0</div>
                <p className="text-xs text-[var(--color-brand-muted)] mb-6">Always free</p>
                <ul className="space-y-3 mb-8">
                  {[
                    '15 curated job views with direct apply links',
                    '2 AI resume scans per cycle',
                    'Access to live job feed',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-brand-muted)]">
                      <Check className="w-4 h-4 text-[var(--color-brand-muted)] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 bg-[var(--color-brand-bg2)]">
                <button
                  onClick={() => navigate(user ? '/' : '/auth')}
                  className="w-full py-3 border border-[var(--color-brand-border-hi)] text-[var(--color-brand-muted)] text-sm font-bold tracking-widest hover:border-[var(--color-brand-text)] hover:text-[var(--color-brand-text)] transition-colors"
                >
                  {user ? "YOU'RE ON FREE" : 'GET STARTED FREE'}
                </button>
                <p className="text-center text-xs text-[var(--color-brand-muted)] mt-3">No credit card required</p>
              </div>
            </div>
          )}

          {/* PRO TIER — show for free + pro users */}
          {userTier !== 'elite' && (
            <div className={`bg-transparent border-2 flex flex-col ${userTier === 'pro' ? 'border-[var(--color-brand-green)]' : 'border-[var(--color-brand-border)]'}`}>
              <div className="p-6 border-b border-[var(--color-brand-border)] flex-grow">
                <div className="flex items-center gap-2 text-[var(--color-brand-text)] mb-2">
                  <Shield className="w-5 h-5" />
                  <h3 className="text-xl font-bold">Pro Pass</h3>
                  {userTier === 'pro' && (
                    <span className="ml-auto text-[10px] bg-[var(--color-brand-green)] text-black font-bold px-2 py-0.5 tracking-wider">CURRENT</span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-brand-muted)] mb-6">30 days of elevated access.</p>
                <div className="text-4xl font-bold text-white mb-1">$15</div>
                <p className="text-xs text-[var(--color-brand-green)] font-semibold mb-6">One-time payment. No subscription.</p>
                <ul className="space-y-3 mb-8">
                  {[
                    { text: '45 Job Views & Direct Apply links', strong: true },
                    { text: '15 Elite AI Resume Scans', strong: true },
                    { text: 'Direct apply links from company career pages — no Google redirects', strong: false },
                  ].map(f => (
                    <li key={f.text} className="flex items-start gap-3 text-sm text-[var(--color-brand-muted)]">
                      <Check className="w-4 h-4 text-[var(--color-brand-green)] shrink-0 mt-0.5" />
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 bg-[var(--color-brand-bg2)] z-0 min-h-[150px] relative">
                {loadingTier === 'pro' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-brand-bg2)]/80">
                    <span className="text-[var(--color-brand-amber)] animate-pulse text-sm font-semibold">PROCESSING...</span>
                  </div>
                )}
                {userTier === 'pro' ? (
                  <div className="text-center text-[var(--color-brand-green)] text-sm py-4 border border-[var(--color-brand-green)]/30 bg-[var(--color-brand-green)]/5">
                    ✓ Active — renew below to extend 30 days
                  </div>
                ) : PAYPAL_CLIENT_ID ? (
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
          )}

          {/* ELITE TIER — always show, marked as current for elite */}
          {userTier !== 'elite' && (
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
                <div className="text-4xl font-bold text-[var(--color-brand-amber)] mb-1">$25</div>
                <p className="text-xs text-[var(--color-brand-green)] font-semibold mb-6">One-time payment. No subscription.</p>
                <ul className="space-y-3 mb-8">
                  {[
                    '75 Job Views & Direct Apply links',
                    '30 Elite AI Resume Scans',
                    'Full company database scan — 200+ career pages searched',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-[var(--color-brand-text)]">
                      <Check className="w-4 h-4 text-[var(--color-brand-amber)] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
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
          )}

        </div>
      </PayPalScriptProvider>
    </motion.div>
  );
}
