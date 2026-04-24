import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  User, Briefcase, Star, Settings, Trash2, ExternalLink,
  CheckCircle2, Crown, Zap, Plus, X, Save, ChevronRight, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  full_name: string | null;
  job_title: string | null;
  industry: string | null;
  tech_stack: string[] | null;
  location_preference: string | null;
  subscription_tier: string;
  scan_count: number;
  created_at: string;
}

interface SavedJob {
  id: string;
  created_at: string;
  job_postings: {
    id: string;
    title: string;
    company_domain: string;
    location: string | null;
    url: string;
    ats_source: string | null;
    created_at: string;
  } | null; // null when the job was deleted from the DB
}

const INDUSTRIES = [
  'Software Engineering', 'Product Management', 'Design', 'Data Science',
  'DevOps / Infrastructure', 'Marketing', 'Sales', 'Finance', 'Operations', 'Other'
];

const TECH_SUGGESTIONS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Go', 'Rust', 'Docker',
  'Kubernetes', 'AWS', 'GCP', 'Azure', 'PostgreSQL', 'MongoDB', 'GraphQL',
  'Next.js', 'Vue', 'Angular', 'Swift', 'Kotlin', 'Flutter'
];

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'saved' | 'preferences'>('overview');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable preference state
  const [editedName, setEditedName] = useState('');
  const [editedJobTitle, setEditedJobTitle] = useState('');
  const [editedIndustry, setEditedIndustry] = useState('');
  const [editedTechStack, setEditedTechStack] = useState<string[]>([]);
  const [editedLocation, setEditedLocation] = useState('');
  const [techInput, setTechInput] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    const [profileRes, savedRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('saved_jobs')
        .select('id, created_at, job_postings(id, title, company_domain, location, url, ats_source, created_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    if (profileRes.data) {
      const p = profileRes.data as Profile;
      setProfile(p);
      setEditedName(p.full_name || '');
      setEditedJobTitle(p.job_title || '');
      setEditedIndustry(p.industry || '');
      setEditedTechStack(p.tech_stack || []);
      setEditedLocation(p.location_preference || '');
    }

    if (savedRes.data) {
      setSavedJobs(savedRes.data as any);
    }

    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: editedName,
      job_title: editedJobTitle,
      industry: editedIndustry,
      tech_stack: editedTechStack,
      location_preference: editedLocation,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadData();
    }
  };

  const removeSavedJob = async (savedJobId: string) => {
    await supabase.from('saved_jobs').delete().eq('id', savedJobId);
    setSavedJobs(prev => prev.filter(j => j.id !== savedJobId));
  };

  const addTech = (tech: string) => {
    const trimmed = tech.trim();
    if (trimmed && !editedTechStack.includes(trimmed)) {
      setEditedTechStack(prev => [...prev, trimmed]);
    }
    setTechInput('');
  };

  const removeTech = (tech: string) => {
    setEditedTechStack(prev => prev.filter(t => t !== tech));
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Operator';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  if (authLoading || loadingData) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-[var(--color-brand-amber)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--color-brand-muted)] text-sm">Loading identity data...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-6"
    >
      {/* Profile Header */}
      <div className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-brand-bg3)] border-2 border-[var(--color-brand-amber)] flex items-center justify-center text-xl font-bold text-[var(--color-brand-amber)]">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-brand-text)]">{displayName}</h2>
            <p className="text-xs text-[var(--color-brand-muted)]">{user?.email}</p>
            <p className="text-xs text-[var(--color-brand-muted)] mt-1">Member since {memberSince}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile?.subscription_tier === 'elite' ? (
            <div className="flex items-center gap-2 border border-[var(--color-brand-amber)]/60 bg-[var(--color-brand-amber)]/10 text-[var(--color-brand-amber)] px-4 py-2 text-sm font-bold">
              <Zap className="w-4 h-4" /> ELITE OPERATOR
            </div>
          ) : profile?.subscription_tier === 'pro' ? (
            <div className="flex items-center gap-2 border border-yellow-500/60 bg-yellow-500/10 text-yellow-400 px-4 py-2 text-sm font-bold">
              <Crown className="w-4 h-4" /> PRO OPERATOR
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg)] text-[var(--color-brand-muted)] px-4 py-2 text-sm">
              <Zap className="w-4 h-4" /> FREE TIER
            </div>
          )}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'SAVED JOBS', value: savedJobs.length, icon: Briefcase, color: 'text-[var(--color-brand-green)]' },
          { label: 'SCANS RUN', value: profile?.scan_count ?? 0, icon: Zap, color: 'text-[var(--color-brand-amber)]' },
          { label: 'TIER', value: (profile?.subscription_tier || 'free').toUpperCase(), icon: Star, color: 'text-[var(--color-brand-text)]' },
        ].map((stat) => (
          <div key={stat.label} className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-4 flex flex-col gap-2">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-[var(--color-brand-muted)] tracking-widest">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border border-[var(--color-brand-border-hi)]">
        {[
          { id: 'overview', label: 'OVERVIEW', icon: User },
          { id: 'saved', label: `SAVED JOBS (${savedJobs.length})`, icon: Briefcase },
          { id: 'preferences', label: 'PREFERENCES', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors border-r last:border-r-0 border-[var(--color-brand-border-hi)] ${
              activeTab === tab.id
                ? 'bg-[var(--color-brand-amber)] text-black'
                : 'bg-[var(--color-brand-bg2)] text-[var(--color-brand-muted)] hover:text-[var(--color-brand-text)]'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/terminal')}
              className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-5 hover:border-[var(--color-brand-amber)] transition-colors text-left flex items-center justify-between group"
            >
              <div>
                <div className="text-[var(--color-brand-amber)] font-bold mb-1">SCAN VAULT</div>
                <div className="text-xs text-[var(--color-brand-muted)]">Upload your resume and find matches</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-brand-muted)] group-hover:text-[var(--color-brand-amber)] transition-colors" />
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-5 hover:border-[var(--color-brand-green)] transition-colors text-left flex items-center justify-between group"
            >
              <div>
                <div className="text-[var(--color-brand-green)] font-bold mb-1">UPDATE PREFERENCES</div>
                <div className="text-xs text-[var(--color-brand-muted)]">Set your job title, tech stack, location</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-brand-muted)] group-hover:text-[var(--color-brand-green)] transition-colors" />
            </button>
          </div>

          {/* Upgrade CTA */}
          {profile?.subscription_tier !== 'elite' && (
            <div className="border border-[var(--color-brand-amber)] bg-[var(--color-brand-amber)]/5 p-6">
              <div className="flex items-start gap-4">
                <Crown className="w-8 h-8 text-[var(--color-brand-amber)] flex-shrink-0 mt-1" />
                <div className="flex-grow">
                  <h3 className="font-bold text-[var(--color-brand-amber)] mb-1">
                    {profile?.subscription_tier === 'pro' ? 'UPGRADE TO ELITE' : 'UPGRADE YOUR PASS'}
                  </h3>
                  <p className="text-xs text-[var(--color-brand-muted)] mb-4">
                    {profile?.subscription_tier === 'pro'
                      ? 'Go Elite for 75 job views and 30 AI resume scans per cycle.'
                      : 'Get up to 45 job views, 15 AI resume scans, and priority access to hidden leads.'}
                  </p>
                  <button
                    onClick={() => navigate('/upgrade')}
                    className="px-6 py-2 bg-[var(--color-brand-amber)] text-black font-bold text-sm tracking-widest hover:bg-[#f5b545] transition-colors"
                  >
                    {profile?.subscription_tier === 'pro' ? 'GO ELITE →' : 'UNLOCK ACCESS →'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'saved' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          {savedJobs.length === 0 ? (
            <div className="border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] p-12 text-center">
              <Briefcase className="w-10 h-10 text-[var(--color-brand-muted)] mx-auto mb-4" />
              <p className="text-[var(--color-brand-muted)] text-sm">No saved jobs yet.</p>
              <button
                onClick={() => navigate('/terminal')}
                className="mt-4 px-6 py-2 border border-[var(--color-brand-amber)] text-[var(--color-brand-amber)] text-sm hover:bg-[var(--color-brand-amber)] hover:text-black transition-colors"
              >
                START SCANNING →
              </button>
            </div>
          ) : (
          savedJobs.map((saved) => {
              const isRemoved = !saved.job_postings;
              return (
              <div
                key={saved.id}
                className={`border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isRemoved ? 'opacity-50' : 'hover:border-[var(--color-brand-green)]'
                }`}
              >
                <div className="flex-grow">
                  {isRemoved ? (
                    <>
                      <div className="flex items-center gap-2 text-[var(--color-brand-red)] text-sm font-semibold mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        This role has been filled or removed
                      </div>
                      <div className="text-xs text-[var(--color-brand-muted)]">
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[var(--color-brand-muted)] text-xs mb-1 uppercase">{saved.job_postings!.company_domain?.replace(/\.placeholder$/i, '').split('.')[0]}</div>
                      <div className="text-[var(--color-brand-text)] font-semibold">{saved.job_postings!.title}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-brand-muted)]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[var(--color-brand-green)]" />
                          {saved.job_postings!.location || 'Remote'}
                        </span>
                        <span>Saved {new Date(saved.created_at).toLocaleDateString()}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isRemoved && (
                    <a
                      href={saved.job_postings!.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-2 border border-[var(--color-brand-green)] text-[var(--color-brand-green)] text-xs hover:bg-[var(--color-brand-green)] hover:text-black transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> APPLY
                    </a>
                  )}
                  <button
                    onClick={() => removeSavedJob(saved.id)}
                    className="p-2 border border-[var(--color-brand-red)]/40 text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)] hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
          )}
        </motion.div>
      )}

      {activeTab === 'preferences' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-6">
          <h3 className="text-[var(--color-brand-amber)] font-bold mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5" /> IDENTITY PREFERENCES
          </h3>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs text-[var(--color-brand-muted)] mb-2 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-3 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-brand-muted)] mb-2 uppercase tracking-wider">Target Job Title</label>
              <input
                type="text"
                value={editedJobTitle}
                onChange={e => setEditedJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-3 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-brand-muted)] mb-2 uppercase tracking-wider">Industry</label>
              <select
                value={editedIndustry}
                onChange={e => setEditedIndustry(e.target.value)}
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-3 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none transition-colors"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map(ind => <option key={ind}>{ind}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--color-brand-muted)] mb-2 uppercase tracking-wider">Location Preference</label>
              <input
                type="text"
                value={editedLocation}
                onChange={e => setEditedLocation(e.target.value)}
                placeholder="e.g. Worldwide, US, EMEA, Asia"
                className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-3 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mt-5">
            <label className="block text-xs text-[var(--color-brand-muted)] mb-2 uppercase tracking-wider">Tech Stack</label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
              {editedTechStack.map(tech => (
                <span
                  key={tech}
                  className="flex items-center gap-1 bg-[var(--color-brand-bg3)] border border-[var(--color-brand-border-hi)] text-[var(--color-brand-amber)] text-xs px-3 py-1"
                >
                  {tech}
                  <button onClick={() => removeTech(tech)} className="ml-1 hover:text-[var(--color-brand-red)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={techInput}
                onChange={e => setTechInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech(techInput); } }}
                placeholder="Type a skill and press Enter..."
                className="flex-1 bg-[var(--color-brand-bg)] border border-[var(--color-brand-border)] p-3 text-sm text-[var(--color-brand-text)] focus:border-[var(--color-brand-amber)] outline-none transition-colors"
              />
              <button
                onClick={() => addTech(techInput)}
                className="px-3 py-2 border border-[var(--color-brand-border-hi)] text-[var(--color-brand-amber)] hover:bg-[var(--color-brand-amber)] hover:text-black transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {TECH_SUGGESTIONS.filter(t => !editedTechStack.includes(t)).slice(0, 8).map(tech => (
                <button
                  key={tech}
                  onClick={() => addTech(tech)}
                  className="text-xs border border-[var(--color-brand-border)] text-[var(--color-brand-muted)] px-2 py-1 hover:border-[var(--color-brand-amber)] hover:text-[var(--color-brand-amber)] transition-colors"
                >
                  + {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="px-8 py-3 bg-[var(--color-brand-amber)] text-black font-bold tracking-widest hover:bg-[#f5b545] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving ? (
                <span className="animate-pulse">SAVING...</span>
              ) : (
                <><Save className="w-4 h-4" /> SAVE PREFERENCES</>
              )}
            </button>
            {saveSuccess && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-[var(--color-brand-green)] text-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Saved successfully
              </motion.span>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
