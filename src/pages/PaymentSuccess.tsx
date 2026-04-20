import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Terminal } from 'lucide-react';

export function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-md mx-auto mt-12 bg-[var(--color-brand-bg2)] border border-[var(--color-brand-green)] p-8 text-center text-[var(--color-brand-text)]">
      <CheckCircle2 className="w-16 h-16 text-[var(--color-brand-green)] mx-auto mb-6" />
      <h2 className="text-2xl font-bold text-[var(--color-brand-green)] mb-2">TXN_SUCCESSFUL</h2>
      <p className="text-sm text-[var(--color-brand-muted)] mb-8">
        Your link to the vault is active. +5 leads added to your identity.
      </p>

      <button
        onClick={() => navigate('/terminal')}
        className="px-8 py-3 bg-[var(--color-brand-green)] border-2 border-[var(--color-brand-green)] text-black font-bold tracking-widest hover:bg-transparent hover:text-[var(--color-brand-green)] transition-all flex items-center justify-center gap-3 mx-auto w-full"
      >
        <Terminal className="w-5 h-5" />
        ENTER TERMINAL
      </button>
    </div>
  );
}
