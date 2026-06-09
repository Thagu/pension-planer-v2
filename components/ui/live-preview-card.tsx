"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { useIsXl } from "@/hooks/use-is-xl";

type LivePreviewCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Collapsible preview panel: collapsed by default on narrow screens,
 * expanded on xl+. Avoids sticky overlap and keeps form fields reachable.
 */
export function LivePreviewCard({
  title,
  description,
  icon,
  className,
  children,
}: LivePreviewCardProps) {
  const isXl = useIsXl();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(isXl);
  }, [isXl]);

  return (
    <CollapsibleCard
      title={title}
      description={description}
      icon={icon}
      className={className}
      open={open}
      onOpenChange={setOpen}
    >
      {children}
    </CollapsibleCard>
  );
}
