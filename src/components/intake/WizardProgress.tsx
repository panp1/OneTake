"use client";

const STEPS = [
  { key: "start", label: "Start" },
  { key: "task_mode", label: "Task & Mode" },
  { key: "details", label: "Details" },
  { key: "requirements", label: "Requirements" },
  { key: "review", label: "Review" },
];

interface WizardProgressProps {
  currentStep: number; // 0-indexed
}

export default function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", padding: "0 40px" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 48px", display: "flex", alignItems: "center" }}>
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div key={step.key} style={{ display: "contents" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDone ? "#dcfce7" : isActive ? "#32373C" : "#F7F7F8",
                    color: isDone ? "#15803d" : isActive ? "white" : "#8A8A8E",
                    border: !isDone && !isActive ? "1px solid #E8E8EA" : "none",
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                    color: isDone ? "#15803d" : isActive ? "#32373C" : "#8A8A8E",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, margin: "0 12px", minWidth: 20, background: isDone ? "#bbf7d0" : "#E8E8EA" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
