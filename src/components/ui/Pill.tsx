import type { PropsWithChildren } from "react";

type PillTone = "accent" | "muted" | "success";

interface PillProps extends PropsWithChildren {
  tone?: PillTone;
}

export function Pill({ children, tone = "muted" }: PillProps) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

