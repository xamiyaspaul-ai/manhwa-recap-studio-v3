"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface SectionHeadingProps {
  label: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  label,
  title,
  subtitle,
  icon: Icon,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-8",
        align === "center" ? "text-center" : "text-left",
        className
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-3",
          align === "center" && "mx-auto"
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          {label}
        </span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-lg leading-relaxed"
          style={align === "center" ? { margin: "0.375rem auto 0" } : undefined}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
