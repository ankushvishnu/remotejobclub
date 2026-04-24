import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileType, CheckCircle2, Zap, ShieldAlert, Cpu, Briefcase, Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure the worker for pdf.js utilizing local bundled worker via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const JobDescription = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-4 max-w-2xl">
      <p className={`text-sm text-[var(--color-brand-muted)] leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
        {text}
      </p>
      <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-[var(--color-brand-amber)] text-xs mt-2 hover:underline">
        [{expanded ? ' COLLAPSE ' : ' EXPAND '}]
      </button>
    </div>
  );
};

const TypewriterText = ({ text, className = '', speed = 30 }: { text: string, className?: string, speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
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

export function TerminalPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const [isRefining, setIsRefining] = useState(false);
  const [refineData, setRefineData] = useState({ role: '', location: '', tech: '', arrangement: 'Remote' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track which jobs user has already saved
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  const [totalScored, setTotalScored] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // Load already-saved job IDs and user tier on mount
  useEffect(() => {
    if (!user) return;
    // Saved jobs
    supabase
      .from('saved_jobs')
      .select('job_posting_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedJobIds(new Set(data.map((r: any) => r.job_posting_id)));
      });
    // User tier
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.subscription_tier) setUserTier(data.subscription_tier);
      });
  }, [user]);

  const handleSaveJob = async (jobId: string) => {
    if (!user || savingJobId) return;
    setSavingJobId(jobId);
    const { error } = await supabase.from('saved_jobs').insert({ user_id: user.id, job_posting_id: jobId });
    if (!error) setSavedJobIds(prev => new Set([...prev, jobId]));
    setSavingJobId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setErrorMsg("Please upload a PDF");
        return;
      }
      setFile(selectedFile);
      setIsRefining(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type !== 'application/pdf') {
        setErrorMsg("Please upload a PDF");
        return;
      }
      setFile(droppedFile);
      setIsRefining(true);
    }
  };

  const startScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setResults(null);
    setScanProgress(0);
    setErrorMsg('');

    let progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 10) + 5;
      });
    }, 500);

    try {
      // Call Supabase Edge Function directly
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        throw new Error("Authentication token lost. Your device clock appears to be out of sync with the server, causing the session to drop. Please sync your clock and sign in again.");
      }

      // Extract text strictly in the client-side browser to avoid Deno Edge Function memory limits & binary compilation issues.
      const arrayBuffer = await file.arrayBuffer();
      const pdfDocs = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let resumeText = '';
      for (let i = 1; i <= pdfDocs.numPages; i++) {
        const page = await pdfDocs.getPage(i);
        const content = await page.getTextContent();
        resumeText += content.items.map((item: any) => item.str).join(' ') + ' ';
        if (resumeText.length > 20000) break;
      }

      if (!resumeText.trim()) throw new Error("Could not extract readable text from the provided PDF.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumeText, constraints: refineData })
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error(`Server returned a non-JSON status of ${response.status}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || data.message || `Scan failed with status ${response.status}.`);
      }

      clearInterval(progressInterval);
      setScanProgress(100);
      
      setTimeout(() => {
        setIsScanning(false);
        setResults(data.matches || []);
        if (data.tier) setUserTier(data.tier);
        if (typeof data.total_scored === 'number') setTotalScored(data.total_scored);
      }, 500);

    } catch (err: any) {
      console.error(err);
      clearInterval(progressInterval);
      setIsScanning(false);
      setErrorMsg(err.message || 'System interruption detected.');
    }
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
        if (description && results) {
          setResults(results.map((j: any) => j.id === jobId ? { ...j, description } : j));
        }
      }
    } catch (err) {
      console.error(err);
    }
    setFetchingJdId(null);
  };

  if (loading) return <div className="text-center p-8">Checking clearance...</div>;

  return (
    <>
      {!isScanning && !results && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          {errorMsg && (
            <div className="mb-4 bg-red-900/20 border border-[var(--color-brand-red)] p-4 text-[var(--color-brand-red)] text-sm">
              [SYSTEM ERROR] {errorMsg}
            </div>
          )}

          {!file ? (
            <div 
              className={`border border-dashed p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragging ? 'bg-[var(--color-brand-bg3)] border-[var(--color-brand-amber)]' : 'border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)]'} hover:bg-[var(--color-brand-bg3)] hover:border-[var(--color-brand-amber)]`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf" 
                className="hidden" 
              />
              <Upload className="w-10 h-10 text-[var(--color-brand-amber-dim)] mb-4" />
              <h2 className="text-lg font-medium mb-2">Initialize Search Sequence</h2>
              <p className="text-sm text-[var(--color-brand-muted)]">
                Drop your resume (PDF) to authenticate and scan the Vault.
              </p>
            </div>
          ) : isRefining ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border-hi)] p-8">
              <div className="flex items-center gap-2 text-[var(--color-brand-green)] mb-6 border-b border-[var(--color-brand-border-hi)] pb-4">
                <FileType className="w-5 h-5" />
                <span className="truncate max-w-[200px] font-semibold">{file.name}</span>
                <CheckCircle2 className="w-4 h-4 ml-auto" />
              </div>
              
              <h3 className="text-[var(--color-brand-amber)] font-bold mb-4 flex items-center gap-2"><Cpu className="w-5 h-5"/> REFINE CONSTRAINTS</h3>
              
              <div className="grid gap-4 mb-6">
                <div>
                  <label className="block text-xs text-[var(--color-brand-muted)] mb-1">TARGET ROLE</label>
                  <input type="text" placeholder="e.g. Senior Frontend Engineer" value={refineData.role} onChange={e => setRefineData({...refineData, role: e.target.value})} className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-2 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-brand-muted)] mb-1">LOCATION PREFERENCE</label>
                  <input type="text" placeholder="e.g. US, EMEA, Worldwide" value={refineData.location} onChange={e => setRefineData({...refineData, location: e.target.value})} className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-2 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-brand-muted)] mb-1">TECH STACK / WEDGE</label>
                  <input type="text" placeholder="e.g. React, Go, Docker" value={refineData.tech} onChange={e => setRefineData({...refineData, tech: e.target.value})} className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-2 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-brand-muted)] mb-1">WORK ARRANGEMENT</label>
                  <select value={refineData.arrangement} onChange={e => setRefineData({...refineData, arrangement: e.target.value})} className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-2 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none">
                    <option>Fully Remote</option>
                    <option>Hybrid</option>
                    <option>On-site</option>
                  </select>
                </div>
              </div>

              <motion.button
                onClick={(e) => { e.stopPropagation(); setIsRefining(false); startScan(); }}
                className="w-full py-4 bg-transparent border-2 border-[var(--color-brand-amber)] text-[var(--color-brand-amber)] font-bold tracking-widest hover:bg-[var(--color-brand-green)] hover:text-black hover:border-[var(--color-brand-green)] transition-all flex items-center justify-center gap-3"
              >
                EXECUTE SCAN
              </motion.button>
            </motion.div>
          ) : null}
        </motion.div>
      )}

      {isScanning && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg mt-12 bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border-hi)] p-8 shadow-[0_0_20px_rgba(239,159,39,0.1)] relative overflow-hidden"
        >
          <motion.div 
            className="absolute left-0 right-0 h-1 bg-[var(--color-brand-amber)] shadow-[0_0_10px_var(--color-brand-amber)] top-0 z-10"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />

          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end">
              <span className="text-[var(--color-brand-amber)] font-bold text-lg">
                <TypewriterText text="[ SCANNING VAULT ]" />
              </span>
              <span className="text-[var(--color-brand-muted)] text-sm">{scanProgress}%</span>
            </div>
            
            <div className="h-2 w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)]">
              <div 
                className="h-full bg-[var(--color-brand-amber)] transition-all duration-300 ease-out"
                style={{ width: `${scanProgress}%` }}
              />
            </div>

            <div className="text-xs text-[var(--color-brand-muted)] flex flex-col gap-2 mt-4 font-mono">
              <TypewriterText text="> INGESTING RESUME VECTOR..." speed={50} />
              {scanProgress > 30 && <TypewriterText text="> OPENROUTER CLASSIFICATION..." speed={40} />}
              {scanProgress > 60 && <TypewriterText text="> LLM CURATION: SCORING WEDGE SKILLS..." speed={30} />}
              {scanProgress > 90 && <TypewriterText text="> DECRYPTING VERIFIED LEADS..." speed={20} />}
            </div>
          </div>
        </motion.div>
      )}

      {!isScanning && results && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full flex flex-col gap-6 pb-28"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-brand-border-hi)] pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--color-brand-green)]" />
              <h2 className="text-xl text-[var(--color-brand-green)] font-semibold">SIGNAL ACQUIRED: {results.length} MATCHES</h2>
            </div>
            <button 
              onClick={() => { setResults(null); setFile(null); }}
              className="text-sm text-[var(--color-brand-muted)] hover:text-[var(--color-brand-text)] border border-[var(--color-brand-border)] px-3 py-1 bg-[var(--color-brand-bg2)]"
            >
              [ RESET SCAN ]
            </button>
          </div>

          <div className="grid gap-4">
            <AnimatePresence>
              {results.map((job: any, index: number) => {
                // Normalise score: could be 0-10 or 0-100
                const rawScore = job.match_score ?? job.score ?? 0;
                const pct = rawScore <= 10 ? Math.round(rawScore * 10) : Math.round(rawScore);

                // apply_confidence colouring
                const confidence = (job.apply_confidence || '').toLowerCase();
                const confidenceColor =
                  confidence === 'high' ? 'text-[var(--color-brand-green)] border-[var(--color-brand-green)]' :
                  confidence === 'medium' ? 'text-[var(--color-brand-amber)] border-[var(--color-brand-amber)]' :
                  confidence === 'low' ? 'text-[var(--color-brand-muted)] border-[var(--color-brand-border-hi)]' : '';

                // "why this fits you"
                const why = job.why || job.curation_notes || '';

                return (
                  <motion.div 
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className="group bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border-hi)] p-6 hover:border-[var(--color-brand-green)] transition-all shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {/* Match % badge */}
                          <span className="text-[var(--color-brand-green)] text-xs border border-[var(--color-brand-green)] px-2 py-[2px] bg-[#1e2b1e] font-bold">
                            {pct}% MATCH
                          </span>
                          {/* apply_confidence badge */}
                          {confidence && (
                            <span className={`text-[10px] border px-2 py-[2px] uppercase tracking-wider font-semibold ${confidenceColor}`}>
                              {confidence === 'high' ? '✓ HIGH CONFIDENCE' : confidence === 'medium' ? '~ MED CONFIDENCE' : '↓ LOW CONFIDENCE'}
                            </span>
                          )}
                          <span className="text-[var(--color-brand-muted)] text-xs uppercase">{(job.company_domain || '').replace(/\.placeholder$/i, '').split('.')[0]}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-brand-text)] mb-2 group-hover:text-[var(--color-brand-green)] transition-colors">
                          {job.title}
                        </h3>
                        {/* Why this fits you */}
                        {why && (
                          <p className="text-sm text-[var(--color-brand-amber)] mb-3 italic">
                            &quot;{why}&quot;
                          </p>
                        )}
                        {job.description ? (
                          <div className="text-sm text-[var(--color-brand-muted)] line-clamp-3 leading-relaxed mb-4">
                            {job.description}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleFetchJd(job.id)}
                            disabled={fetchingJdId === job.id}
                            className="mb-4 text-xs text-[var(--color-brand-green)] border border-[var(--color-brand-green)] px-3 py-1 bg-[#1e2b1e] hover:bg-[var(--color-brand-green)] hover:text-black transition-colors"
                          >
                            {fetchingJdId === job.id ? 'LOADING DESCRIPTION...' : 'LOAD DESCRIPTION'}
                          </button>
                        )}
                        {/* Matched / missing skills */}
                        {(job.matched_skills?.length > 0 || job.missing_skills?.length > 0) && (
                          <div className="flex gap-4 text-xs flex-wrap mb-3">
                            {job.matched_skills?.length > 0 && (
                              <span className="text-[var(--color-brand-green)]">
                                ✓ {job.matched_skills.join(', ')}
                              </span>
                            )}
                            {job.missing_skills?.length > 0 && (
                              <span className="text-[var(--color-brand-muted)]">
                                ✗ Missing: {job.missing_skills.join(', ')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Curation notes (fallback when why field absorbed above) */}
                        {job.curation_notes && !job.why && (
                          <div className="bg-[var(--color-brand-bg)] border-l-2 border-[var(--color-brand-amber-dim)] p-3 pl-4 relative">
                            <div className="absolute top-3 left-[-11px] bg-[var(--color-brand-bg)]">
                              <Briefcase className="w-4 h-4 text-[var(--color-brand-amber-dim)]" />
                            </div>
                            <p className="text-xs text-[var(--color-brand-amber)] font-medium mb-1 uppercase tracking-wider">AI Curation Notes:</p>
                            <p className="text-sm text-[var(--color-brand-text)] opacity-90">{job.curation_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end justify-between min-w-[140px] border-t border-[var(--color-brand-border)] pt-4 md:border-t-0 md:pt-0 gap-3">
                        <div className="text-right text-xs text-[var(--color-brand-muted)] mb-2">
                          <div className="flex items-center gap-1 justify-end text-[var(--color-brand-green)]">
                            <CheckCircle2 className="w-4 h-4" /> VERIFIED
                          </div>
                        </div>

                        <button 
                          onClick={async () => {
                            if (!user) return;
                            const { data, error } = await supabase.rpc('record_job_view', { p_job_id: job.id });
                            if (error) {
                              alert("An error occurred while tracking your application.");
                              return;
                            }
                            if (!data.success) {
                              alert(data.error);
                            } else {
                              window.open(data.url, '_blank');
                            }
                          }}
                          className="w-full py-2 bg-transparent border border-[var(--color-brand-green)] text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)] hover:text-black transition-colors font-medium text-sm flex items-center justify-center gap-2"
                        >
                          ACCESS LINK <span className="text-[10px]">↗</span>
                        </button>

                        <button
                          onClick={() => handleSaveJob(job.id)}
                          disabled={savedJobIds.has(job.id) || savingJobId === job.id}
                          className={`w-full py-2 border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                            savedJobIds.has(job.id)
                              ? 'border-[var(--color-brand-amber)]/40 text-[var(--color-brand-amber)]/60 cursor-default'
                              : 'border-[var(--color-brand-border-hi)] text-[var(--color-brand-muted)] hover:border-[var(--color-brand-amber)] hover:text-[var(--color-brand-amber)]'
                          }`}
                        >
                          {savedJobIds.has(job.id) ? (
                            <><BookmarkCheck className="w-3.5 h-3.5" /> SAVED</>
                          ) : savingJobId === job.id ? (
                            <span className="animate-pulse">SAVING...</span>
                          ) : (
                            <><Bookmark className="w-3.5 h-3.5" /> SAVE JOB</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {results.length === 0 && (
              <div className="text-center p-8 text-[var(--color-brand-muted)]">No active leads match your wedge skills yet.</div>
            )}
          </div>

          {/* Tier-aware bottom bar */}
          {user && results.length > 0 && (
            userTier === 'elite' ? (
              // Elite: informational — no upgrade push
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-[var(--color-brand-bg)] border-t-2 border-[var(--color-brand-green)] px-6 py-4 shadow-2xl"
              >
                <p className="text-sm text-[var(--color-brand-muted)]">
                  <span className="text-[var(--color-brand-green)] font-bold">{results.length} matches</span> returned from{' '}
                  <span className="text-[var(--color-brand-text)] font-bold">{totalScored || results.length}</span> scored.
                  {' '}For more roles, browse the{' '}
                  <button
                    onClick={() => window.location.href = '/'}
                    className="text-[var(--color-brand-amber)] underline hover:no-underline"
                  >
                    live job feed →
                  </button>
                </p>
                <span className="text-xs border border-[var(--color-brand-green)]/40 text-[var(--color-brand-green)] px-3 py-1 whitespace-nowrap">
                  ⚡ ELITE
                </span>
              </motion.div>
            ) : (
              // Free / Pro: upgrade CTA
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-[var(--color-brand-bg)] border-t-2 border-[var(--color-brand-amber)] px-6 py-4 shadow-2xl"
              >
                <p className="text-sm text-[var(--color-brand-text)]">
                  Showing <span className="text-[var(--color-brand-amber)] font-bold">{results.length}</span> matches.
                  {' '}<span className="text-[var(--color-brand-muted)]">More verified jobs await — upgrade to unlock them all.</span>
                </p>
                <button
                  onClick={() => window.location.href = '/upgrade'}
                  className="whitespace-nowrap px-5 py-2 bg-[var(--color-brand-amber)] text-black font-bold text-sm tracking-widest hover:bg-[#f5b545] transition-colors flex-shrink-0"
                >
                  {userTier === 'pro' ? 'GO ELITE →' : 'GET PRO →'}
                </button>
              </motion.div>
            )
          )}
        </motion.div>
      )}
    </>
  );
}
