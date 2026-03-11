import type { PropsWithChildren } from "react";

import { Badge } from "@components/ui/badge";

type PillTone = "accent" | "muted" | "success";

interface PillProps extends PropsWithChildren {
  tone?: PillTone;
}

const toneVariant = {
  accent: "accent",
  muted: "secondary",
  success: "success"
} as const;

export function Pill({ children, tone = "muted" }: PillProps) {
  return <Badge variant={toneVariant[tone]}>{children}</Badge>;
}
