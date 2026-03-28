'use client';

import { Image, Palette, Layers, Smartphone } from 'lucide-react';

type TabKey = 'characters' | 'elements' | 'composed' | 'mockups';

interface AssetCategoryTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  counts: {
    characters: number;
    elements: number;
    composed: number;
    mockups: number;
  };
}

const tabs: Array<{ key: TabKey; label: string; icon: typeof Image }> = [
  { key: 'characters', label: 'Characters', icon: Image },
  { key: 'elements', label: 'Design Elements', icon: Palette },
  { key: 'composed', label: 'Composed', icon: Layers },
  { key: 'mockups', label: 'Mockups', icon: Smartphone },
];

export default function AssetCategoryTabs({
  activeTab,
  onTabChange,
  counts,
}: AssetCategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key;
        const count = counts[key];
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150"
            style={{
              background: isActive ? '#32373C' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--muted-foreground)',
              border: isActive ? '1px solid #32373C' : '1px solid var(--border)',
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold"
              style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--muted)',
                color: isActive ? '#ffffff' : 'var(--muted-foreground)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
