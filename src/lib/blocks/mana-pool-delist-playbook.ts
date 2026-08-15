import type { BlockChannel, BlockStatus } from "@prisma/client";

export const MANAPOOL_SELLER_INVENTORY_URL = "https://manapool.com/seller/inventory";
export const MANAPOOL_SELLER_IMPORT_URL =
  "https://manapool.com/seller/inventory/import";

export const MANAPOOL_DELIST_HONESTY_COPY =
  "This app does not update Mana Pool. Taking a block offline only changes status in TCG Chaos Inventory — buyers may still purchase listed qty until you adjust Mana Pool manually.";

export const MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL =
  "I understand Mana Pool was not updated and I will adjust marketplace quantity manually.";

export const MANAPOOL_DELIST_PLAYBOOK_STEPS = [
  `Export your seller inventory from Mana Pool (ManaBox format) at ${MANAPOOL_SELLER_INVENTORY_URL}.`,
  "Open the CSV and find printings from this block. Set quantity to 0 or remove those rows. Mana Pool merges qty across blocks — one row may represent cards from several ACTIVE blocks, so edit totals carefully.",
  `Re-import the edited CSV at ${MANAPOOL_SELLER_IMPORT_URL}, or enable vacation mode on Mana Pool if you are pausing all listings temporarily.`,
] as const;

export function shouldShowManaPoolDelistPlaybook(
  status: BlockStatus | string,
  channel: BlockChannel | string,
): boolean {
  return status === "ACTIVE" && channel === "MANAPOOL";
}

export function requiresManaPoolArchiveConfirmation(
  status: BlockStatus | string,
  channel: BlockChannel | string,
  transition: string,
): boolean {
  return transition === "ARCHIVE" && shouldShowManaPoolDelistPlaybook(status, channel);
}
