import { Suspense } from "react";
import { CorrectionIntakeForm } from "./correction-intake-form";

export default function PickCorrectionPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500">Loading correction intake…</p>
      }
    >
      <CorrectionIntakeForm />
    </Suspense>
  );
}
