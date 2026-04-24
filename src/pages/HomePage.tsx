import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Terminal, ShieldAlert, Briefcase, Search, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const TypewriterText = ({ text, className = '', speed = 30 }: { text: string, className?: string, speed?: number }) => {
  const [displayedText, setDisplayedText] = React.useState('');
  
  React.useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i));
      i++;
      if (i > text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span className={className}>{displayedText}<span className="animate-pulse">_</span></span>;
};

/** Returns "X days ago", "Today", or "Yesterday" */
function timeAgo(dateStr: string): { label: string; daysOld: number } {
  const posted = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - posted.getTime();
  const daysOld = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (daysOld === 0) return { label: 'Today', daysOld };
  if (daysOld === 1) return { label: 'Yesterday', daysOld };
  return { label: `${daysOld} days ago`, daysOld };
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeedExpanded, setIsFeedExpanded] = useState(false);
  
  const [filterTech, setFilterTech] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const [tierLimit, setTierLimit] = useState(15);

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    let limit = 15; // Free default

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();
        
      if (profile) {
        if (profile.subscription_tier === 'elite') limit = 75;
        else if (profile.subscription_tier === 'pro') limit = 45;
      }
    }
    setTierLimit(limit);

    // Fetch from vw_healthy_jobs — only recent, active listings
    let { data, error } = await supabase
      .from('vw_healthy_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error || !data) {
      const fallback = await supabase
        .from('job_postings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      data = fallback.data;
    }
    
    if (data) setJobs(data);
    setLoading(false);
  };

  const [fetchingJdId, setFetchingJdId] = useState<string | null>(null);

  const handleFetchJd = async (jobId: string) => {
    setFetchingJdId(jobId);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-jd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ job_id: jobId })
      });
      
      if (response.ok) {
        const { description } = await response.json();
        if (description) {
          setJobs(jobs.map(j => j.id === jobId ? { ...j, description } : j));
        }
      }
    } catch (err) {
      console.error(err);
    }
    setFetchingJdId(null);
  };

  const filteredJobs = jobs.filter((j: any) => {
    if (filterTech && !j.title?.toLowerCase().includes(filterTech.toLowerCase()) && !j.description?.toLowerCase().includes(filterTech.toLowerCase())) return false;
    if (filterLocation && !j.location?.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    return true;
  });

  const handleApplyClick = async (jobId: string) => {
    if (!user) {
      alert("You must be logged in to apply for jobs. Join the Remote Job Club today!");
      navigate('/auth');
      return;
    }

    const { data, error } = await supabase.rpc('record_job_view', { p_job_id: jobId });
    
    if (error) {
      alert("An error occurred while tracking your application.");
      return;
    }

    if (!data.success) {
      alert(data.error);
    } else {
      window.open(data.url, '_blank');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex-grow flex flex-col gap-12 py-4"
    >
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-brand-text)] mb-4 tracking-tight">
          SIGNAL OVER NOISE.
        </h2>
        <div className="h-8">
          <p className="text-[var(--color-brand-amber)] text-lg md:text-xl font-medium max-w-2xl mx-auto">
            <TypewriterText text="We find the hidden remote jobs. You get the interview." speed={50} />
          </p>
        </div>
        {/* Apply scarcity headline */}
        <p className="mt-6 text-[var(--color-brand-muted)] text-sm max-w-xl mx-auto leading-relaxed border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] px-5 py-3 inline-block">
          We limit who can apply to each job.{' '}
          <span className="text-[var(--color-brand-text)] font-semibold">Fewer competitors. Better chances.</span>
        </p>
      </div>

      {/* Cards row */}
      <div className="grid md:grid-cols-2 gap-8 w-full mt-4">
        <div className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-6 hover:border-[var(--color-brand-amber)] transition-colors">
          <h3 className="text-[var(--color-brand-amber)] font-semibold text-lg mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5"/> WHY WE EXIST
          </h3>
          <p className="text-[var(--color-brand-muted)] text-sm leading-relaxed">
            I applied to 200+ remote jobs and got ghosted by every giant job board. So I built this. The Vault only surfaces verified, active roles from companies that are actually hiring — not ghost jobs, not expired listings, not recruiter spam.
          </p>
          <p className="mt-3 text-xs text-[var(--color-brand-muted)] border-t border-[var(--color-brand-border)] pt-3">
            2,000+ remote jobs · Updated daily · Direct apply links · No aggregator noise
          </p>
        </div>
        
        <div className="w-full border border-[var(--color-brand-green)] bg-[#1e2b1e] p-6 text-center relative flex flex-col justify-center">
          <h3 className="text-[var(--color-brand-text)] font-semibold mb-2">ACCESS THE INNER VAULT</h3>
          <p className="text-[#8cdb8b] text-sm mb-2">Drop your resume, bypassing the generic crowd.</p>
          <p className="text-xs text-[var(--color-brand-muted)] mb-6">No credit card required</p>
          
          <button 
            onClick={() => navigate(user ? '/terminal' : '/auth')}
            className="px-6 py-3 bg-[var(--color-brand-green)] border-2 border-[var(--color-brand-green)] text-black font-bold tracking-widest hover:bg-transparent hover:text-[var(--color-brand-green)] transition-all flex items-center justify-center gap-3 w-full"
          >
            <Terminal className="w-5 h-5" />
            INITIALIZE TERMINAL
          </button>
        </div>
      </div>

      {/* Live Feed */}
      <div className="w-full border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] overflow-hidden">
        <div className="bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border-hi)] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--color-brand-amber)] font-semibold">
            <Briefcase className="w-5 h-5" /> RAW LIVE FEED
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)]" />
              <input 
                value={filterTech}
                onChange={e => setFilterTech(e.target.value)}
                placeholder="Tech / Role..."
                className="w-full bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border)] pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[var(--color-brand-amber)]"
              />
            </div>
            <div className="relative w-full md:w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)]" />
              <input 
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
                placeholder="Location..."
                className="w-full bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border)] pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[var(--color-brand-amber)]"
              />
            </div>
          </div>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-[var(--color-brand-muted)]">Scanning network...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-brand-muted)]">No active verified jobs matching those filters.</div>
          ) : (
            <div className="flex flex-col">
              {(isFeedExpanded ? filteredJobs : filteredJobs.slice(0, 5)).map((job, idx) => {
                const { label: postedLabel, daysOld } = timeAgo(job.created_at);
                const isStale = daysOld > 21;

                return (
                  <div 
                    key={job.id || idx} 
                    className={`border-b border-[var(--color-brand-border)] p-4 hover:bg-[var(--color-brand-bg)] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${isStale ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-grow">
                      <div className="text-[var(--color-brand-muted)] text-xs mb-1 uppercase tracking-wider">{(job.company_domain || '').replace(/\.placeholder$/i, '').split('.')[0]}</div>
                      <div className={`font-semibold text-lg ${isStale ? 'text-[var(--color-brand-muted)]' : 'text-[var(--color-brand-text)]'}`}>{job.title}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-brand-muted)] flex-wrap">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[var(--color-brand-green)]"/> {job.location || 'Remote'}</span>
                        <span className="border border-[var(--color-brand-border-hi)] px-2 bg-[var(--color-brand-bg2)]">{job.ats_source}</span>
                        {/* Posted X days ago */}
                        <span className={`flex items-center gap-1 ${isStale ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-amber)]'}`}>
                          <Clock className="w-3 h-3" /> {postedLabel}
                        </span>
                        {/* Stale warning */}
                        {isStale && (
                          <span className="flex items-center gap-1 text-[var(--color-brand-red)] border border-[var(--color-brand-red)]/40 px-2 py-0.5 text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> May already be filled
                          </span>
                        )}
                      </div>
                      {job.description ? (
                        <div className="mt-3 text-sm text-[var(--color-brand-muted)] line-clamp-3 leading-relaxed border-l-2 border-[var(--color-brand-amber-dim)] pl-3">
                          {job.description}
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleFetchJd(job.id)}
                          disabled={fetchingJdId === job.id}
                          className="mt-3 text-xs text-[var(--color-brand-amber)] border border-[var(--color-brand-amber-dim)] px-3 py-1 hover:bg-[var(--color-brand-amber-dim)] hover:text-black transition-colors"
                        >
                          {fetchingJdId === job.id ? 'LOADING DESCRIPTION...' : 'LOAD DESCRIPTION'}
                        </button>
                      )}
                    </div>
                    <div>
                      <button 
                        onClick={() => handleApplyClick(job.id)}
                        disabled={isStale}
                        className={`whitespace-nowrap px-4 py-2 border text-sm font-medium transition-colors ${isStale ? 'border-[var(--color-brand-border)] text-[var(--color-brand-muted)] cursor-not-allowed' : 'border-[var(--color-brand-green)] text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)] hover:text-black'}`}
                      >
                        {isStale ? 'POSSIBLY FILLED' : 'DIRECT APPLY ↗'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredJobs.length > 5 && (
                <button 
                  onClick={() => setIsFeedExpanded(!isFeedExpanded)}
                  className="w-full py-4 bg-[var(--color-brand-bg2)] text-[var(--color-brand-amber)] hover:bg-[var(--color-brand-bg3)] hover:text-[var(--color-brand-text)] transition-colors font-medium tracking-widest text-sm flex items-center justify-center border-t border-[var(--color-brand-border)]"
                >
                  {isFeedExpanded ? '[ COLLAPSE NETWORK TRAFFIC ]' : `[ EXPAND FULL VAULT (${filteredJobs.length - 5} MORE) ]`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
