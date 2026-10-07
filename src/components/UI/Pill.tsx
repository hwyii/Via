// src/components/UI/Pill.tsx
import type { ReactNode } from "react";

type PillProps = {
  active?: boolean;
  compact?: boolean;
  theme?: "light" | "dark" | "espresso";
  children: ReactNode;
  onClick: () => void;
};

export function Pill({ active, compact = false, theme = "dark", children, onClick }: PillProps) {
  const light = theme === "light";
  const espresso = theme === "espresso";
  return (
    <button
      onClick={onClick}
      style={{
        padding: compact ? "5px 8px" : "8px 12px",
        fontSize: compact ? 11 : undefined,
        borderRadius: 999,
        border: `1px solid ${espresso ? "#4a3015" : light ? "rgba(184,143,25,0.3)" : "rgba(255,255,255,0.18)"}`,
        background: active
          ? (espresso ? "#d4943a" : light ? "#d2ad35" : "rgba(255,255,255,0.92)")
          : (espresso ? "#251a0c" : light ? "rgba(255,255,255,0.88)" : "rgba(10,16,28,0.55)"),
        color: active
          ? (espresso ? "#1c1208" : light ? "#fff" : "#0b1220")
          : (espresso ? "#d9c5a8" : light ? "#6f570f" : "rgba(255,255,255,0.92)"),
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}
