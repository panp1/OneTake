"use client";

import { useEffect, useState, use } from 'react';
import { BarChart3, Lock, Loader2 } from 'lucide-react';
import type { DashboardLayoutData } from '@/components/insights/types';
import { WidgetRenderer } from '@/components/insights/WidgetRenderer';

export default function PublicDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [pageState, setPageState] = useState<'loading' | 'password' | 'ready' | 'error'>('loading');
  const [title, setTitle] = useState('');
  const [layoutData, setLayoutData] = useState<DashboardLayoutData | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/insights/public/${token}`)
      .then(async r => {
        if (r.status === 401) {
          const d = await r.json();
          setTitle(d.title || 'Dashboard');
          setPageState('password');
        } else if (r.ok) {
          const d = await r.json();
          setTitle(d.title);
          setLayoutData(d.layout_data);
          setPageState('ready');
        } else {
          setPageState('error');
        }
      })
      .catch(() => setPageState('error'));
  }, [token]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/insights/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const d = await res.json();
        setTitle(d.title);
        setLayoutData(d.layout_data);
        setPageState('ready');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Something went wrong');
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--muted)]">
        <Loader2 className="w-8 h-8 text-[var(--muted-foreground)] animate-spin" />
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--muted)]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h2 className="text-base font-medium text-[var(--foreground)]">Dashboard not found</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  if (pageState === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--muted)]">
        <form onSubmit={handlePasswordSubmit} className="card p-8 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[var(--muted-foreground)]" />
            <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">This dashboard is password protected.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="input-base" autoFocus />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full cursor-pointer">View Dashboard</button>
        </form>
      </div>
    );
  }

  if (!layoutData) return null;

  return (
    <div className="min-h-screen bg-[var(--muted)]">
      <div className="bg-white border-b border-[var(--border)] px-6 py-3">
        <h1 className="text-sm font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="text-[10px] text-[var(--muted-foreground)]">Shared Insights Dashboard</p>
      </div>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          {layoutData.widgets.map(widget => {
            const lgLayout = layoutData.gridLayouts.lg.find(l => l.i === widget.id);
            const colSpan = lgLayout?.w ?? 6;
            const height = lgLayout ? lgLayout.h * 80 + (lgLayout.h - 1) * 16 : 240;
            return (
              <div key={widget.id} style={{ gridColumn: `span ${Math.min(colSpan, 12)}`, height }}>
                <WidgetRenderer widget={widget} isEditMode={false} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
