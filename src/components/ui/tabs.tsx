"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center justify-start gap-2 border-b border-border w-full overflow-x-auto no-scrollbar",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative whitespace-nowrap px-1 pb-3 text-sm font-medium text-muted-foreground transition-all",
        "hover:text-foreground",
        "data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-primary after:origin-left after:scale-x-0 after:transition-transform after:duration-300",
        "data-[state=active]:after:scale-x-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-6 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
