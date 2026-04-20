import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();
  
  // If user is already authenticated, redirect them automatically
  useEffect(() => {
    if (user) {
      navigate('/terminal', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password 
      });
      if (error) {
        setError(error.message);
      } else if (data.user?.identities?.length === 0) {
         setError("An identity already exists with this email. Try signing in.");
      } else {
        setMessage('REGISTRATION SUCCESSFUL -> YOU CAN NOW SIGN IN');
        setMode('signin');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      if (error) {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto mt-12 bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border-hi)] p-8 shadow-[0_0_20px_rgba(239,159,39,0.1)]">
      <div className="flex items-center justify-between mb-6 border-b border-[var(--color-brand-border)] pb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--color-brand-amber)]" />
          <h2 className="text-xl font-bold text-[var(--color-brand-text)]">
            {mode === 'signin' ? 'ACCESS VAULT' : 'REGISTER IDENTITY'}
          </h2>
        </div>
        <button 
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
            setMessage('');
          }}
          className="text-xs text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)] underline"
        >
          {mode === 'signin' ? '[ CREATE ACCOUNT ]' : '[ ALREADY REGISTERED ]'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
            Email Identity
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="operator@remotejob.club"
            className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
            Passphrase
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••••••"
            className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 outline-none transition-colors font-sans"
          />
        </div>

        {error && (
          <div className="text-[var(--color-brand-red)] text-xs flex items-center gap-2 mt-2 bg-red-900/20 p-2 border border-red-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span className="flex-grow">{error}</span>
          </div>
        )}

        {message && (
          <div className="text-[var(--color-brand-green)] text-xs flex items-center gap-2 mt-2 bg-[#1e2b1e] p-2 border border-[var(--color-brand-green)]">
            <Terminal className="w-4 h-4 flex-shrink-0" /> <span className="flex-grow">{message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full py-3 bg-[var(--color-brand-amber)] text-black font-bold tracking-widest hover:bg-[#f5b545] disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
        >
          {loading ? 'AUTHENTICATING...' : mode === 'signin' ? 'INITIALIZE SESSION' : 'REGISTER NOW'}
        </button>
      </form>
    </div>
  );
}
