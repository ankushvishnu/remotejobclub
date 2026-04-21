import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Terminal, ShieldAlert, Briefcase, Search, CheckCircle2 } from 'lucide-react';
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

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeedExpanded, setIsFeedExpanded] = useState(false);
  
  const [filterTech, setFilterTech] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) setJobs(data);
    setLoading(false);
  };

  const filteredJobs = jobs.filter((j: any) => {
    if (filterTech && !j.title?.toLowerCase().includes(filterTech.toLowerCase()) && !j.description?.toLowerCase().includes(filterTech.toLowerCase())) return false;
    if (filterLocation && !j.location?.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex-grow flex flex-col gap-12 py-4"
    >
      <div className="text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-brand-text)] mb-4 tracking-tight">
          SIGNAL OVER NOISE.
        </h2>
        <div className="h-8">
          <p className="text-[var(--color-brand-amber)] text-lg md:text-xl font-medium max-w-2xl mx-auto">
            <TypewriterText text="We find the hidden remote jobs. You get the interview." speed={50} />
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full mt-4">
        <div className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-6 hover:border-[var(--color-brand-amber)] transition-colors">
          <h3 className="text-[var(--color-brand-amber)] font-semibold text-lg mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5"/> WHO WE ARE
          </h3>
          <p className="text-[var(--color-brand-muted)] text-sm leading-relaxed">
            We are automated curators. We deploy sensors to scrape private career pages and ATS platforms to find active, verified remote roles before they hit the massive public boards.
          </p>
        </div>
        
        <div className="w-full border border-[var(--color-brand-green)] bg-[#1e2b1e] p-6 text-center relative flex flex-col justify-center">
          <h3 className="text-[var(--color-brand-text)] font-semibold mb-2">ACCESS THE INNER VAULT</h3>
          <p className="text-[#8cdb8b] text-sm mb-6">Drop your resume, bypassing the generic crowd.</p>
          
          <button 
            onClick={() => navigate(user ? '/terminal' : '/auth')}
            className="px-6 py-3 bg-[var(--color-brand-green)] border-2 border-[var(--color-brand-green)] text-black font-bold tracking-widest hover:bg-transparent hover:text-[var(--color-brand-green)] transition-all flex items-center justify-center gap-3 w-full"
          >
            <Terminal className="w-5 h-5" />
            INITIALIZE TERMINAL
          </button>
        </div>
      </div>

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
              {(isFeedExpanded ? filteredJobs : filteredJobs.slice(0, 5)).map((job, idx) => (
                <div key={job.id || idx} className="border-b border-[var(--color-brand-border)] p-4 hover:bg-[var(--color-brand-bg)] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-grow">
                    <div className="text-[var(--color-brand-muted)] text-xs mb-1 uppercase tracking-wider">{job.company_domain}</div>
                    <div className="text-[var(--color-brand-text)] font-semibold text-lg">{job.title}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-brand-muted)]">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[var(--color-brand-green)]"/> {job.location || 'Remote'}</span>
                      <span className="border border-[var(--color-brand-border-hi)] px-2 bg-[var(--color-brand-bg2)]">{job.ats_source}</span>
                      <span className="text-[var(--color-brand-amber)]">{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>
                    <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="whitespace-nowrap px-4 py-2 border border-[var(--color-brand-green)] text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)] hover:text-black transition-colors text-sm font-medium"
                    >
                      DIRECT APPLY ↗
                    </a>
                  </div>
                </div>
              ))}

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
