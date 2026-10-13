import { cn } from "@/lib/utils";

const TONES = {
  neutral: "border-line bg-paper text-muted",
  overdue: "border-transparent bg-overdue/10 text-overdue",
  soon: "border-transparent bg-soon/10 text-soon",
  grass: "border-transparent bg-grass/10 text-pitch",
  done: "border-transparent bg-grass/15 text-pitch",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
