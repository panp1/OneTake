"use client";

interface SectionPill {
  key: string;
  label: string;
}

interface SectionPillsProps {
  sections: SectionPill[];
  active: string;
  onChange: (key: string) => void;
}

export default function SectionPills({ sections, active, onChange }: SectionPillsProps) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
      {sections.map((s) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 600,
              color: isActive ? "#FFFFFF" : "#1A1A1A",
              background: isActive ? "#32373C" : "#F5F5F5",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
