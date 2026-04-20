import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Cpu, RefreshCw, AlertTriangle } from 'lucide-react';

export function DevScanner() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [boards, setBoards] = useState("figma.com, linear.app, anthropic.com");

  const runIngestion = async () => {
    setLoading(true);
    setLogs(prev => [...prev, `> INIT INGESTION SEQUENCE...`]);
    
    try {
      const boardConfig = boards.split(',').map(b => b.trim()).map(domain => {
        const token = domain.split('.')[0];
        return { type: 'lever', token, domain };
      });

      setLogs(prev => [...prev, `> FIRING HTTP REQUEST TO EDGE FUNCTION...`]);

      const { data, error } = await supabase.functions.invoke('ingest-jobs', {
        body: { boards: boardConfig },
      });

      if (error) throw error;

      setLogs(prev => [
        ...prev, 
        `> SUCCESS. FETCHED: ${data.totalFetched}, INSERTS: ${data.added}, DUPLICATES MASKED: ${data.duplicates}`
      ]);
      
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] ${err.message || String(err)}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 bg-[var(--color-brand-bg2)] border border-[var(--color-brand-border-hi)] p-6 font-mono text-sm">
      <div className="flex items-center gap-2 mb-4 text-[var(--color-brand-amber)] border-b border-[var(--color-brand-border)] pb-2">
        <Cpu className="w-5 h-5" />
        <h2 className="font-bold uppercase tracking-wider">Scraper Dashboard</h2>
      </div>
      
      <div className="mb-4">
        <label className="text-[var(--color-brand-muted)] text-xs uppercase mb-1 block">Target Domains (Lever)</label>
        <input 
          type="text" 
          value={boards}
          onChange={e => setBoards(e.target.value)}
          className="w-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-border-hi)] p-2 text-xs text-[var(--color-brand-text)]" 
        />
      </div>

      <button 
        onClick={runIngestion}
        disabled={loading}
        className="w-full mb-6 bg-[var(--color-brand-amber)] text-black font-bold p-3 hover:bg-[#f5b545] disabled:opacity-50 flex justify-center items-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        EXECUTE CRAWL
      </button>

      <div className="bg-[#0b0907] border border-[var(--color-brand-border)] p-4 h-64 overflow-y-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={log.includes('[ERROR]') ? 'text-red-500' : 'text-[var(--color-brand-green)]'}>
            {log}
          </div>
        ))}
        {logs.length === 0 && <span className="text-[var(--color-brand-muted)]">Awaiting manual override...</span>}
      </div>
    </div>
  );
}
