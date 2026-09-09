// src/components/UI/Pill.tsx
import type { ReactNode } from "react";

type PillProps = {
  active?: boolean;
  compact?: boolean;
  theme?: "light" | "dark";
  children: ReactNode;
  onClick: () => void;
};

export function Pill({ active, compact = false, theme = "dark", children, onClick }: PillProps) {
  const light = theme === "light";
  return (
    <button
      onClick={onClick}
      style={{
        padding: compact ? "5px 8px" : "8px 12px",
        fontSize: compact ? 11 : undefined,
        borderRadius: 999,
        border: `1px solid ${light ? "rgba(184,143,25,0.3)" : "rgba(255,255,255,0.18)"}`,
        background: active
          ? (light ? "#d2ad35" : "rgba(255,255,255,0.92)")
          : (light ? "rgba(255,255,255,0.88)" : "rgba(10,16,28,0.55)"),
        color: active
          ? (light ? "#fff" : "#0b1220")
          : (light ? "#6f570f" : "rgba(255,255,255,0.92)"),
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}
