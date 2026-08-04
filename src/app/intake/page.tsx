import { PageHeader, EmptyState } from "@/components/page-header";

export default function IntakePage() {
  return (
    <>
      <PageHeader
        title="Intake"
        description="Pack mixed cards into a new chaos block. Scan or search cards, assign a location, then seal the block."
      />

      <EmptyState
        title="Intake workflow coming soon"
        description="This page will guide you through opening a block, adding cards via Scryfall search, and sealing the block when packing is complete."
        action={
          <div className="mx-auto max-w-md space-y-2 text-left text-sm text-zinc-400">
            <p className="font-medium text-zinc-300">Planned steps:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Create block with auto ID (MTG-0001)</li>
              <li>Assign shelf location</li>
              <li>Add cards or bulk lines</li>
              <li>Seal block and print label</li>
            </ol>
          </div>
        }
      />
    </>
  );
}
