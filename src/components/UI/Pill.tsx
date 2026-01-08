// src/components/UI/Pill.tsx
import type { ReactNode } from "react";

type PillProps = {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
};

export function Pill({ active, children, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(255,255,255,0.92)" : "rgba(10,16,28,0.55)",
        color: active ? "#0b1220" : "rgba(255,255,255,0.92)",
        cursor: "pointer",
        backdropFilter: "blur(10px)"
      }}
    >
      {children}
    </button>
  );
}