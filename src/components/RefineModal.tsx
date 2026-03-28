'use client';

import { useState } from 'react';
import { X, Send, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface RefineAsset {
  id: string;
  blob_url: string | null;
  platform: string;
  format: string;
  evaluation_score: number | null;
  content: Record<string, unknown> | null;
  copy_data: Record<string, unknown> | null;
}

interface RefineModalProps {
  asset: RefineAsset;
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RefineModal({
  asset,
  requestId,
  isOpen,
  onClose,
  onSubmitted,
}: RefineModalProps) {
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const template = (asset.content?.template as string) || '';
  const headline = (asset.content?.headline as string) || (asset.copy_data?.headline as string) || '';
  const score = asset.evaluation_score;

  async function handleSend() {
    if (!feedback.trim()) {
      toast.error('Please describe your refinement');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/generate/${requestId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.id, feedback: feedback.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit refinement');
      }

      toast.success('Refinement queued — worker will process shortly');
      setFeedback('');
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit refinement');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40">
      <div className="bg-white h-full w-full max-w-md shadow-xl flex flex-col slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            Refine Asset
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Large image preview */}
          <div className="rounded-xl overflow-hidden bg-[var(--muted)] aspect-square flex items-center justify-center">
            {asset.blob_url ? (
              <img
                src={asset.blob_url}
                alt={headline || 'Asset preview'}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon size={48} className="text-[var(--muted-foreground)] opacity-30" />
            )}
          </div>

          {/* Asset details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="tag-pill text-xs font-medium"
                style={{ background: '#eff6ff', color: '#2563eb' }}
              >
                {asset.platform}
              </span>
              <span className="tag-pill text-xs">{asset.format}</span>
              {score !== null && score !== undefined && (
                <span
                  className={`tag-pill text-xs font-semibold ${
                    score >= 0.85
                      ? 'bg-green-50 text-green-700'
                      : score >= 0.70
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-red-50 text-red-700'
                  }`}
                >
                  {(score * 100).toFixed(0)}% score
                </span>
              )}
            </div>
            {template && (
              <p className="text-sm font-medium text-[var(--foreground)]">
                {template}
              </p>
            )}
            {headline && (
              <p className="text-sm text-[var(--muted-foreground)]">
                {headline}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)]" />
        </div>

        {/* Chat input area - pinned to bottom */}
        <div className="border-t border-[var(--border)] p-4 space-y-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe your refinement..."
            rows={3}
            className="input-base resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSend();
              }
            }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !feedback.trim()}
              className="btn-primary text-sm px-5 py-2 cursor-pointer"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {sending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Send size={14} />
                  Send
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
