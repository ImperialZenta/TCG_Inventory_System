import { PageHeader, EmptyState } from "@/components/page-header";

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Import Mana Pool orders, review line items, then generate a pick list."
      />

      <EmptyState
        title="Order import — Phase 4"
        description="Mana Pool API order import with review screen will be implemented after listing export. Configure MANAPOOL_EMAIL and MANAPOOL_API_TOKEN in Settings when ready."
      />
    </>
  );
}
