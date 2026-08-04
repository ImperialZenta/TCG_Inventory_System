import { PageHeader, EmptyState } from "@/components/page-header";

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Search cards across all blocks. Find which block holds a specific card for counter sales or listing."
      />

      <EmptyState
        title="Card search coming soon"
        description="Search by card name, set, or Scryfall ID to see quantities and block locations across your chaos inventory."
      />
    </>
  );
}
