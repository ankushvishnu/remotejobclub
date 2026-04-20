import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Terminal, LogOut } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { TerminalPage } from './pages/TerminalPage';
import { AuthPage } from './pages/AuthPage';
import { DevScanner } from './pages/DevScanner';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';

function Header() {
  const { user } = useAuth();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="w-full max-w-4xl flex items-center justify-between mb-12 border-b border-[var(--color-brand-border)] pb-4">
      <Link 
        to="/"
        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
      >
        <Terminal className="text-[var(--color-brand-amber)] w-6 h-6" />
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--color-brand-text)]">
          REMOTEJOB.CLUB <span className="text-[var(--color-brand-muted)] font-normal hidden sm:inline">// TERMINAL</span>
        </h1>
      </Link>
      <div className="flex items-center gap-4">
        {!user ? (
          <Link to="/auth" className="text-xs text-[var(--color-brand-muted)] hover:text-[var(--color-brand-green)] transition-colors border border-[var(--color-brand-border)] px-3 py-1">
            [ LOG IN ]
          </Link>
        ) : (
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-[var(--color-brand-amber)] hover:text-white transition-colors">
            <LogOut className="w-3 h-3" /> [ END SESSION ]
          </button>
        )}
        <div className="flex items-center gap-2 text-sm text-[var(--color-brand-amber)] border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] px-3 py-1 rounded-sm shadow-sm shadow-[var(--color-brand-border-hi)] hidden sm:flex">
          <span className="w-2 h-2 rounded-full bg-[var(--color-brand-amber)] animate-pulse" />
          SYSTEM_ONLINE
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] font-mono p-4 md:p-8 flex flex-col items-center">
        <Header />

        <main className="w-full max-w-4xl flex-grow flex flex-col gap-8 items-center">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/dev/scanner" element={<DevScanner />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
          </Routes>
        </main>
        
        <footer className="w-full max-w-4xl mt-12 pt-6 border-t border-[var(--color-brand-border)] text-center text-xs text-[var(--color-brand-muted)] flex items-center justify-between">
          <p>© 2026 REMOTEJOB.CLUB // THE VAULT IS ACTIVE</p>
          <p>
            V_1.0.4.BETA · <Link to="/dev/scanner" className="hover:text-[var(--color-brand-amber)]">DEV_ACCESS</Link>
          </p>
        </footer>
      </div>
    </Router>
  );
}
