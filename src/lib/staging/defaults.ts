import { db } from "@/lib/db";

export const DEFAULT_FORMALIZE_BIN_SETTING_KEY = "default_formalize_bin_id";

export async function getDefaultFormalizeBinId(): Promise<string | null> {
  const setting = await db.appSetting.findUnique({
    where: { key: DEFAULT_FORMALIZE_BIN_SETTING_KEY },
    select: { value: true },
  });

  const binId = setting?.value?.trim();
  if (!binId) return null;

  const bin = await db.bin.findUnique({
    where: { id: binId },
    select: { id: true },
  });

  return bin?.id ?? null;
}
