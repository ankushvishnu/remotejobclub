import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Terminal, LogOut, LayoutDashboard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HomePage } from './pages/HomePage';
import { TerminalPage } from './pages/TerminalPage';
import { AuthPage } from './pages/AuthPage';
import { DevScanner } from './pages/DevScanner';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { DashboardPage } from './pages/DashboardPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { UpgradePage } from './pages/UpgradePage';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';

// Welcome banner displayed briefly after login
function WelcomeBanner({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mb-4 flex items-center justify-between bg-[var(--color-brand-green)]/10 border border-[var(--color-brand-green)] px-5 py-3"
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="w-2 h-2 rounded-full bg-[var(--color-brand-green)] animate-pulse flex-shrink-0" />
        <span className="text-[var(--color-brand-green)] font-semibold">
          Welcome back, <span className="text-[var(--color-brand-text)]">{name}</span>! Session initialized. ✓
        </span>
      </div>
      <button onClick={onDismiss} className="text-[var(--color-brand-muted)] hover:text-[var(--color-brand-text)]">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [prevUser, setPrevUser] = useState<typeof user>(null);

  // Detect login transitions to show welcome banner
  useEffect(() => {
    if (!prevUser && user && !loading) {
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Operator';
      setWelcomeName(name);
      // Only show on home page or after redirect
      setShowWelcome(true);
    }
    if (!user) setShowWelcome(false);
    setPrevUser(user);
  }, [user, loading]);

  const handleLogout = async () => {
    setShowWelcome(false);
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] font-mono p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between mb-4 border-b border-[var(--color-brand-border)] pb-4">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Terminal className="text-[var(--color-brand-amber)] w-5 h-5 flex-shrink-0" />
          <h1 className="text-base md:text-lg font-semibold tracking-tight text-[var(--color-brand-text)] whitespace-nowrap">
            REMOTEJOB.CLUB{' '}
            <span className="text-[var(--color-brand-muted)] font-normal">// TERMINAL</span>
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          {!loading && !user ? (
            <Link
              to="/auth"
              className="text-xs text-[var(--color-brand-muted)] hover:text-[var(--color-brand-green)] transition-colors border border-[var(--color-brand-border)] px-3 py-1"
            >
              [ LOG IN ]
            </Link>
          ) : (
            user && (
              <>
                <Link
                  to="/upgrade"
                  className={`text-xs whitespace-nowrap transition-colors border px-3 py-1 hidden sm:inline-flex items-center ${
                    location.pathname === '/upgrade'
                      ? 'border-[var(--color-brand-green)] text-[var(--color-brand-green)]'
                      : 'border-[var(--color-brand-border)] text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)] hover:text-black font-semibold'
                  }`}
                >
                  [ UPGRADE ]
                </Link>
                <Link
                  to="/dashboard"
                  className={`text-xs whitespace-nowrap inline-flex items-center gap-1 transition-colors border px-3 py-1 ${
                    location.pathname === '/dashboard'
                      ? 'border-[var(--color-brand-amber)] text-[var(--color-brand-amber)]'
                      : 'border-[var(--color-brand-border)] text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)] hover:border-[var(--color-brand-amber)]'
                  }`}
                >
                  <LayoutDashboard className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">DASH</span>
                </Link>
                <Link
                  to="/terminal"
                  className={`text-xs whitespace-nowrap inline-flex items-center transition-colors border px-3 py-1 hidden sm:inline-flex ${
                    location.pathname === '/terminal'
                      ? 'border-[var(--color-brand-green)] text-[var(--color-brand-green)]'
                      : 'border-[var(--color-brand-border)] text-[var(--color-brand-muted)] hover:text-[var(--color-brand-green)] hover:border-[var(--color-brand-green)]'
                  }`}
                >
                  [ SCAN ]
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)] hover:border-[var(--color-brand-amber)] transition-colors border border-[var(--color-brand-border)] px-3 py-1"
                >
                  <LogOut className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">EXIT</span>
                </button>
              </>
            )
          )}
          <div className="flex items-center gap-2 text-sm text-[var(--color-brand-amber)] border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] px-3 py-1 rounded-sm shadow-sm shadow-[var(--color-brand-border-hi)] hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-amber)] animate-pulse" />
            SYSTEM_ONLINE
          </div>
        </div>
      </header>

      {/* Welcome banner */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeBanner
            name={welcomeName}
            onDismiss={() => setShowWelcome(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="w-full max-w-4xl flex-grow flex flex-col gap-8 items-center">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/dev/scanner" element={<DevScanner />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mt-12 pt-6 border-t border-[var(--color-brand-border)] text-center text-xs text-[var(--color-brand-muted)] flex items-center justify-between flex-wrap gap-2">
        <p>© 2026 REMOTEJOB.CLUB // THE VAULT IS ACTIVE</p>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-[var(--color-brand-amber)] transition-colors">
            PRIVACY & DISCLAIMER
          </Link>
          <span className="opacity-30">|</span>
          <p>
            V_1.0.5.BETA ·{' '}
            <Link to="/dev/scanner" className="hover:text-[var(--color-brand-amber)]">
              DEV_ACCESS
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
