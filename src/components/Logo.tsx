import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
  <img src="/favicon.png" alt="Daily Gap logo" className={cn("h-7 w-7 object-contain", className)} />
);
