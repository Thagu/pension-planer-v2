"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsibleCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
};

export function CollapsibleCard({
  title,
  description,
  icon,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  headerClassName,
  children,
}: CollapsibleCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Card className={className}>
      <CardHeader
        className={cn(
          "cursor-pointer select-none pb-3",
          !open && "pb-6",
          headerClassName,
        )}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </CardHeader>
      <CardContent className={cn(!open && "hidden")}>{children}</CardContent>
    </Card>
  );
}
