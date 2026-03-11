import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@shared/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-background/80 text-foreground",
        accent: "border-accent/20 bg-accent/12 text-accent",
        success:
          "border-emerald-500/15 bg-emerald-500/10 text-emerald-700"
      }
    },
    defaultVariants: {
      variant: "secondary"
    }
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
