import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "warning" | "success";
}

export function StatCard({ label, value, hint, variant = "default" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        variant === "warning" && "border-amber-500/30 bg-amber-500/5",
        variant === "success" && "border-emerald-500/30 bg-emerald-500/5",
        variant === "default" && "border-zinc-800 bg-zinc-900/50",
      )}
    >
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-100">{value}</p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
