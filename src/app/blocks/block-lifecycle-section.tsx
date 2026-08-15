import { LifecycleActionForm } from "./lifecycle-action-form";
import { shouldShowManaPoolDelistPlaybook } from "@/lib/blocks/mana-pool-delist-playbook";
import type { LifecycleTransition } from "@/lib/blocks/lifecycle";

interface BlockLifecycleSectionProps {
  blockId: string;
  status: string;
  channel: string;
  availableTransitions: LifecycleTransition[];
  reservedSessionDisplayId?: string | null;
}

export function BlockLifecycleSection({
  blockId,
  status,
  channel,
  availableTransitions,
  reservedSessionDisplayId,
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

  const transitions = reservedSessionDisplayId
    ? availableTransitions.filter((transition) => transition !== "ACTIVATE")
    : availableTransitions;

  if (transitions.length === 0) {
    if (reservedSessionDisplayId && availableTransitions.includes("ACTIVATE")) {
      return (
        <div>
          <h2 className="mb-4 text-lg font-medium text-zinc-100">Lifecycle</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm text-zinc-400">
              Mark as listed is disabled while this block is reserved in upload session{" "}
              {reservedSessionDisplayId}. Complete the session instead.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-zinc-100">Lifecycle</h2>
      <div className="space-y-4">
        {transitions.map((transition) => (
          <div
            key={transition}
            className={
              transition === "LIQUIDATE"
                ? "rounded-xl border border-red-900/40 bg-red-950/20 p-4"
                : "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            }
          >
            <LifecycleActionForm
              blockId={blockId}
              transition={transition}
              requiresManaPoolDelistPlaybook={shouldShowManaPoolDelistPlaybook(
                status,
                channel,
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
