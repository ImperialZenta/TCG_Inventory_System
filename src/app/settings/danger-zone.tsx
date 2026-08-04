import Link from "next/link";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import {
  deleteAllBinsAction,
  deleteAllInventoryAction,
  deleteAllShelvesAction,
  deleteCardInventoryAction,
} from "./delete-actions";

export function DangerZone() {
  return (
    <section className="rounded-xl border border-red-900/50 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-medium text-red-200">Danger zone</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Destructive actions cannot be undone.{" "}
        <Link href="/api/backup/export" className="text-amber-400 hover:text-amber-300">
          Download a backup
        </Link>{" "}
        before deleting.
      </p>

      <div className="mt-6 space-y-4">
        <ConfirmDeleteForm
          title="Clear card inventory"
          description="Removes all blocks, cards, staging imports, orders, and pick history. Shelves and bins are kept."
          action={deleteCardInventoryAction}
          submitLabel="Clear inventory"
        />
        <ConfirmDeleteForm
          title="Clear all bins"
          description="Removes all bins and all card inventory. Shelves are kept."
          action={deleteAllBinsAction}
          submitLabel="Delete all bins"
        />
        <ConfirmDeleteForm
          title="Clear all shelves"
          description="Removes shelf records. Bins and their blocks/cards remain (bins become unassigned)."
          action={deleteAllShelvesAction}
          submitLabel="Delete all shelves"
        />
        <ConfirmDeleteForm
          title="Reset all inventory data"
          description="Full factory reset: shelves, bins, blocks, cards, staging, orders, and picks. App settings and languages are kept."
          action={deleteAllInventoryAction}
          submitLabel="Reset everything"
        />
      </div>
    </section>
  );
}
