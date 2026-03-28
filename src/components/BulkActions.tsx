'use client';

import { Download, RefreshCw, CheckSquare, XSquare } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onDownloadSelected: () => void;
  onRetrySelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function BulkActions({
  selectedCount,
  onDownloadSelected,
  onRetrySelected,
  onSelectAll,
  onDeselectAll,
}: BulkActionsProps) {
  return (
    <div
      className="sticky bottom-4 z-20 bg-white border border-[var(--border)] rounded-[var(--radius-md)] px-5 py-3 flex items-center justify-between gap-4"
      style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}
    >
      <span className="text-sm font-medium text-[var(--foreground)]">
        {selectedCount} selected
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={onDownloadSelected}
          className="btn-primary text-xs px-4 py-2 cursor-pointer"
        >
          <Download size={14} />
          Download Selected
        </button>
        <button
          onClick={onRetrySelected}
          className="btn-secondary text-xs px-4 py-2 cursor-pointer"
        >
          <RefreshCw size={14} />
          Retry Selected
        </button>
        <button
          onClick={onSelectAll}
          className="btn-secondary text-xs px-4 py-2 cursor-pointer"
        >
          <CheckSquare size={14} />
          Select All
        </button>
        <button
          onClick={onDeselectAll}
          className="btn-secondary text-xs px-4 py-2 cursor-pointer"
        >
          <XSquare size={14} />
          Deselect All
        </button>
      </div>
    </div>
  );
}
