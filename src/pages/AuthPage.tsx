import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Terminal, Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// Google Logo SVG
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export function AuthPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setError(error.message);
      } else if (data.user?.identities?.length === 0) {
        setError('An account with this email already exists. Try signing in.');
      } else {
        // Auto-sign them in after registration (no email confirmation required)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMessage('Account created! Please sign in.');
          setMode('signin');
        }
        // If sign-in succeeded, the useEffect will redirect to '/'
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // If success, useEffect redirects to '/'
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      {/* Tab switcher */}
      <div className="flex border border-[var(--color-brand-border-hi)] mb-0">
        <button
          onClick={() => switchMode('signin')}
          className={`flex-1 py-3 text-sm font-bold tracking-widest transition-colors ${
            mode === 'signin'
              ? 'bg-[var(--color-brand-amber)] text-black'
              : 'bg-[var(--color-brand-bg2)] text-[var(--color-brand-muted)] hover:text-[var(--color-brand-text)]'
          }`}
        >
          [ SIGN IN ]
        </button>
        <button
          onClick={() => switchMode('signup')}
          className={`flex-1 py-3 text-sm font-bold tracking-widest transition-colors border-l border-[var(--color-brand-border-hi)] ${
            mode === 'signup'
              ? 'bg-[var(--color-brand-amber)] text-black'
              : 'bg-[var(--color-brand-bg2)] text-[var(--color-brand-muted)] hover:text-[var(--color-brand-text)]'
          }`}
        >
          [ CREATE ACCOUNT ]
        </button>
      </div>

      <div className="bg-[var(--color-brand-bg2)] border border-t-0 border-[var(--color-brand-border-hi)] p-8 shadow-[0_0_30px_rgba(239,159,39,0.08)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-5 h-5 text-[var(--color-brand-amber)]" />
          <h2 className="text-lg font-bold text-[var(--color-brand-text)]">
            {mode === 'signin' ? 'ACCESS THE VAULT' : 'REGISTER IDENTITY'}
          </h2>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-60 mb-6"
        >
          {googleLoading ? (
            <span className="animate-pulse">Connecting to Google...</span>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[var(--color-brand-border-hi)]" />
          <span className="text-xs text-[var(--color-brand-muted)] uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-[var(--color-brand-border-hi)]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ankush Vishnu"
                autoComplete="name"
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="operator@remotejob.club"
              autoComplete="email"
              className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 pr-12 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-xs text-[var(--color-brand-muted)] mb-2 block uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] focus:border-[var(--color-brand-amber)] text-[var(--color-brand-text)] px-4 py-3 pr-12 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)]"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-[var(--color-brand-red)] text-xs flex items-center gap-2 bg-red-900/20 p-3 border border-red-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="text-[var(--color-brand-green)] text-xs flex items-center gap-2 bg-[#1e2b1e] p-3 border border-[var(--color-brand-green)]">
              <Terminal className="w-4 h-4 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 bg-[var(--color-brand-amber)] text-black font-bold tracking-widest hover:bg-[#f5b545] disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
          >
            {loading
              ? 'PROCESSING...'
              : mode === 'signin'
              ? 'INITIALIZE SESSION'
              : 'REGISTER IDENTITY'}
          </button>
        </form>

        {/* Privacy note */}
        <p className="text-xs text-[var(--color-brand-muted)] text-center mt-6">
          By continuing, you agree to our{' '}
          <Link to="/privacy" className="text-[var(--color-brand-amber)] hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
