"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  AlertCircle,
  CheckCircle2,
  Star,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { Theme, FONT } from "../gallery/tokens";

interface DashboardSidebarProps {
  theme: Theme;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stats: {
    active: number;
    creatives: number;
    avgVqa: number;
    pendingReview: number;
  };
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  filterKey: string;
  count?: number;
  isExpanded: boolean;
  isActive: boolean;
  theme: Theme;
  onClick: () => void;
}

function NavItem({
  icon,
  label,
  filterKey,
  count,
  isExpanded,
  isActive,
  theme,
  onClick,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
        background: isActive ? theme.card : "transparent",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? theme.text : theme.textMuted,
        fontFamily: FONT.sans,
        fontSize: "13px",
        textAlign: "left",
        transition: "background 0.15s ease, color 0.15s ease",
        flexShrink: 0,
        minHeight: "36px",
        boxSizing: "border-box" as const,
        outline: "none",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: "20px",
          height: "20px",
          color: isActive ? theme.accent : theme.textMuted,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: isExpanded
            ? "opacity 0.15s ease 0.15s"
            : "opacity 0.05s ease",
          whiteSpace: "nowrap",
          overflow: "hidden",
          flex: 1,
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            opacity: isExpanded ? 1 : 0,
            transition: isExpanded
              ? "opacity 0.15s ease 0.15s"
              : "opacity 0.05s ease",
            background: isActive ? "rgba(109,40,217,0.12)" : theme.surface,
            color: isActive ? "#A78BFA" : theme.textDim,
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "10px",
            padding: "1px 7px",
            flexShrink: 0,
            fontFamily: FONT.sans,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  isExpanded: boolean;
  theme: Theme;
  valueColor?: string;
}

function StatRow({ label, value, isExpanded, theme, valueColor }: StatRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 12px",
        minHeight: "28px",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          color: theme.textMuted,
          fontFamily: FONT.sans,
          opacity: isExpanded ? 1 : 0,
          transition: isExpanded
            ? "opacity 0.15s ease 0.15s"
            : "opacity 0.05s ease",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: valueColor ?? theme.text,
          fontFamily: FONT.sans,
          opacity: isExpanded ? 1 : 0,
          transition: isExpanded
            ? "opacity 0.15s ease 0.15s"
            : "opacity 0.05s ease",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider({ theme }: { theme: Theme }) {
  return (
    <div
      style={{
        height: "1px",
        background: theme.border,
        margin: "8px 0",
        flexShrink: 0,
      }}
    />
  );
}

function SectionLabel({
  label,
  isExpanded,
  theme,
}: {
  label: string;
  isExpanded: boolean;
  theme: Theme;
}) {
  return (
    <div
      style={{
        padding: "4px 12px 2px",
        opacity: isExpanded ? 1 : 0,
        transition: isExpanded
          ? "opacity 0.15s ease 0.15s"
          : "opacity 0.05s ease",
        overflow: "hidden",
        minHeight: "20px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: theme.textDim,
          fontFamily: FONT.sans,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function DashboardSidebar({
  theme,
  activeFilter,
  onFilterChange,
  stats,
}: DashboardSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        width: isExpanded ? "220px" : "48px",
        transition: "width 0.2s ease",
        overflow: "hidden",
        height: "100%",
        background: theme.surface,
        borderRight: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "12px 0",
        flexShrink: 0,
        boxSizing: "border-box" as const,
      }}
    >
      {/* Workspace section */}
      <SectionLabel label="Workspace" isExpanded={isExpanded} theme={theme} />

      <NavItem
        icon={<LayoutDashboard size={16} />}
        label="My Work"
        filterKey="all"
        count={stats.active}
        isExpanded={isExpanded}
        isActive={activeFilter === "all"}
        theme={theme}
        onClick={() => onFilterChange("all")}
      />
      <NavItem
        icon={<AlertCircle size={16} />}
        label="Needs Review"
        filterKey="review"
        count={stats.pendingReview}
        isExpanded={isExpanded}
        isActive={activeFilter === "review"}
        theme={theme}
        onClick={() => onFilterChange("review")}
      />
      <NavItem
        icon={<CheckCircle2 size={16} />}
        label="Completed"
        filterKey="completed"
        isExpanded={isExpanded}
        isActive={activeFilter === "completed"}
        theme={theme}
        onClick={() => onFilterChange("completed")}
      />

      <Divider theme={theme} />

      {/* Filters section */}
      <SectionLabel label="Filters" isExpanded={isExpanded} theme={theme} />

      <NavItem
        icon={<Star size={16} />}
        label="High Priority"
        filterKey="high-priority"
        isExpanded={isExpanded}
        isActive={activeFilter === "high-priority"}
        theme={theme}
        onClick={() => onFilterChange("high-priority")}
      />
      <NavItem
        icon={<RefreshCw size={16} />}
        label="Recently Updated"
        filterKey="recent"
        isExpanded={isExpanded}
        isActive={activeFilter === "recent"}
        theme={theme}
        onClick={() => onFilterChange("recent")}
      />
      <NavItem
        icon={<ImageIcon size={16} />}
        label="All Campaigns"
        filterKey="campaigns"
        isExpanded={isExpanded}
        isActive={activeFilter === "campaigns"}
        theme={theme}
        onClick={() => onFilterChange("campaigns")}
      />

      <Divider theme={theme} />

      {/* Quick Stats section */}
      <SectionLabel label="Quick Stats" isExpanded={isExpanded} theme={theme} />

      <StatRow
        label="Active"
        value={stats.active}
        isExpanded={isExpanded}
        theme={theme}
      />
      <StatRow
        label="Creatives"
        value={stats.creatives}
        isExpanded={isExpanded}
        theme={theme}
      />
      <StatRow
        label="Avg VQA"
        value={stats.avgVqa > 0 ? `${stats.avgVqa}%` : "—"}
        isExpanded={isExpanded}
        theme={theme}
        valueColor={theme.vqaGood}
      />
      <StatRow
        label="Pending"
        value={stats.pendingReview}
        isExpanded={isExpanded}
        theme={theme}
        valueColor="#f59e0b"
      />
    </div>
  );
}
