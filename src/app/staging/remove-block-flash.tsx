import Link from "next/link";

interface RemoveBlockFlashProps {
  removedBlock: string;
  cardsRemoved: number;
  lastBlock: boolean;
  importStillFormalized: boolean;
}

export function RemoveBlockFlash({
  removedBlock,
  cardsRemoved,
  lastBlock,
  importStillFormalized,
}: RemoveBlockFlashProps) {
  if (lastBlock) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        <p className="font-medium text-emerald-200">
          {removedBlock} removed — staging import unlocked
        </p>
        <p className="mt-2 text-emerald-100/90">
          No blocks remain for this import. Assign bins and{" "}
          <strong className="text-emerald-100">formalize again</strong> from this page, or{" "}
          <Link href="/staging" className="underline hover:text-emerald-50">
            discard on Staging
          </Link>{" "}
          and re-upload the CSV if the whole scan was wrong.
        </p>
      </div>
    );
  }

  if (importStillFormalized) {
    return (
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <p className="font-medium text-amber-200">
          {removedBlock} removed — {cardsRemoved} card{cardsRemoved === 1 ? "" : "s"} unassigned
        </p>
        <p className="mt-2 text-amber-100/90">
          Cards from that brick are no longer in inventory. See{" "}
          <strong className="text-amber-100">Assignment breakdown</strong> below for counts.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-amber-100/90">
          <li>
            <strong className="text-amber-100">Trusted scan, one bad brick:</strong> Repack the
            physical brick. Partial re-formalize (**I-021**) is not built yet — remove remaining
            blocks individually or use undo formalize if the whole export was wrong.
          </li>
          <li>
            <strong className="text-amber-100">Whole export wrong:</strong>{" "}
            <a href="#undo-formalize" className="underline hover:text-amber-50">
              Undo formalize
            </a>{" "}
            below (one click, all blocks) or{" "}
            <Link href="/staging" className="underline hover:text-amber-50">
              discard and re-upload
            </Link>{" "}
            on Staging.
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
      <p className="font-medium text-emerald-200">
        {removedBlock} removed ({cardsRemoved} card{cardsRemoved === 1 ? "" : "s"})
      </p>
    </div>
  );
}
