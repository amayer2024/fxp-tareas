import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <img
      src="/fxp-logo.svg"
      alt="Fútbol por mi País"
      className={cn(
        "w-auto",
        size === "sm" && "h-8",
        size === "md" && "h-10",
        size === "lg" && "h-[72px] md:h-20",
        className,
      )}
    />
  );
}
