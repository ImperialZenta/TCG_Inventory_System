import { LifecycleActionForm } from "./lifecycle-action-form";
import type { LifecycleTransition } from "@/lib/blocks/lifecycle";

interface BlockLifecycleSectionProps {
  blockId: string;
  status: string;
  availableTransitions: LifecycleTransition[];
}

export function BlockLifecycleSection({
  blockId,
  status,
  availableTransitions,
}: BlockLifecycleSectionProps) {
  if (status === "LIQUIDATED") {
    return (
      <div>
        <h2 className="mb-4 text-lg font-medium text-zinc-100">Lifecycle</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">
            Final state — no further transitions. Restore from backup if this was a mistake.
          </p>
        </div>
      </div>
    );
  }

  if (status === "OPEN") {
    return (
      <div>
        <h2 className="mb-4 text-lg font-medium text-zinc-100">Lifecycle</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">
            Seal this block first to lock contents, then you can mark it listed or take it offline.
          </p>
        </div>
      </div>
    );
  }

  if (availableTransitions.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-zinc-100">Lifecycle</h2>
      <div className="space-y-4">
        {availableTransitions.map((transition) => (
          <div
            key={transition}
            className={
              transition === "LIQUIDATE"
                ? "rounded-xl border border-red-900/40 bg-red-950/20 p-4"
                : "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            }
          >
            <LifecycleActionForm blockId={blockId} transition={transition} />
          </div>
        ))}
      </div>
    </div>
  );
}
