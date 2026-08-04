import { PageHeader, EmptyState } from "@/components/page-header";

export default function PickPage() {
  return (
    <>
      <PageHeader
        title="Pick Lists"
        description="Location-sorted picking guides for order fulfillment. Visit blocks in route order, confirm picks, and update inventory."
      />

      <EmptyState
        title="Pick lists coming soon"
        description="Create pick lists from orders or pullsheet uploads. Items will be grouped by block and sorted by shelf location for efficient picking."
      />
    </>
  );
}
