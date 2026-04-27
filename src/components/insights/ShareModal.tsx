"use client";

import { useState, useEffect } from 'react';
import { X, Link2, Lock, Calendar, Eye, Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Dashboard } from './types';

interface ShareModalProps { dashboardId: string; onClose: () => void; }

export function ShareModal({ dashboardId, onClose }: ShareModalProps) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetch(`/api/insights/${dashboardId}`).then(r => r.json()).then(d => { setDashboard(d); setLoading(false); }).catch(() => setLoading(false)); }, [dashboardId]);

  const handleToggleShare = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/insights/${dashboardId}/share`, { method: 'POST' });
      const result = await res.json();
      setDashboard(prev => prev ? { ...prev, is_shared: result.is_shared, share_token: result.share_token } : null);
      toast.success(result.is_shared ? 'Sharing enabled' : 'Sharing disabled');
    } catch { toast.error('Failed'); } finally { setToggling(false); }
  };

  const handleCopyLink = () => {
    if (!dashboard?.share_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/insights/public/${dashboard.share_token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateSettings = async () => {
    try {
      const data: Record<string, unknown> = {};
      if (password) data.password = password;
      if (expiryDays) data.expires_in_days = parseInt(expiryDays);
      const res = await fetch(`/api/insights/${dashboardId}/share`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const updated = await res.json();
      setDashboard(updated); setPassword('');
      toast.success('Share settings updated');
    } catch { toast.error('Failed'); }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="card p-6 w-full max-w-md"><Loader2 className="w-6 h-6 text-[var(--muted-foreground)] animate-spin mx-auto" /></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="card p-6 w-full max-w-md space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Share Dashboard</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-[var(--muted-foreground)]" /><span className="text-sm text-[var(--foreground)]">Enable public link</span></div>
          <button onClick={handleToggleShare} disabled={toggling} className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${dashboard?.is_shared ? 'bg-green-500' : 'bg-[var(--border)]'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dashboard?.is_shared ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {dashboard?.is_shared && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-[var(--muted)] border border-[var(--border)] rounded-lg text-xs text-[var(--muted-foreground)] truncate">{window.location.origin}/insights/public/{dashboard.share_token}</div>
              <button onClick={handleCopyLink} className="btn-secondary !py-1.5 !px-2.5 cursor-pointer">{copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}</button>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Lock className="w-3.5 h-3.5" /> Password protection</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set password (optional)" className="input-base text-xs !py-1.5" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><Calendar className="w-3.5 h-3.5" /> Link expiry</label>
              <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} className="input-base text-xs !py-1.5">
                <option value="">No expiry</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
              </select>
            </div>
            {(password || expiryDays) && <button onClick={handleUpdateSettings} className="btn-primary w-full cursor-pointer">Update Settings</button>}
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] pt-1"><Eye className="w-3.5 h-3.5" /> {dashboard.view_count} view{dashboard.view_count !== 1 ? 's' : ''}</div>
          </>
        )}
      </div>
    </div>
  );
}
