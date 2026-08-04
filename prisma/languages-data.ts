/** Shared language definitions — used by seed and runtime. */
export interface LanguageDefinition {
  scryfallCode: string;
  manapoolCode: string | null;
  label: string;
  localOnly: boolean;
}

export const LANGUAGES: LanguageDefinition[] = [
  { scryfallCode: "en", manapoolCode: "EN", label: "English", localOnly: false },
  { scryfallCode: "es", manapoolCode: "ES", label: "Spanish", localOnly: false },
  { scryfallCode: "fr", manapoolCode: "FR", label: "French", localOnly: false },
  { scryfallCode: "de", manapoolCode: "DE", label: "German", localOnly: false },
  { scryfallCode: "it", manapoolCode: "IT", label: "Italian", localOnly: false },
  { scryfallCode: "pt", manapoolCode: "PT", label: "Portuguese", localOnly: false },
  { scryfallCode: "ja", manapoolCode: "JA", label: "Japanese", localOnly: false },
  { scryfallCode: "ko", manapoolCode: "KO", label: "Korean", localOnly: false },
  { scryfallCode: "ru", manapoolCode: "RU", label: "Russian", localOnly: false },
  { scryfallCode: "zhs", manapoolCode: "CS", label: "Chinese Simplified", localOnly: false },
  { scryfallCode: "zht", manapoolCode: "CT", label: "Chinese Traditional", localOnly: false },
  { scryfallCode: "he", manapoolCode: "HE", label: "Hebrew", localOnly: false },
  { scryfallCode: "la", manapoolCode: "LA", label: "Latin", localOnly: false },
  { scryfallCode: "grc", manapoolCode: "EL", label: "Ancient Greek", localOnly: false },
  { scryfallCode: "ar", manapoolCode: "AR", label: "Arabic", localOnly: false },
  { scryfallCode: "sa", manapoolCode: "SA", label: "Sanskrit", localOnly: false },
  { scryfallCode: "ph", manapoolCode: "PH", label: "Phyrexian", localOnly: false },
  { scryfallCode: "qya", manapoolCode: null, label: "Quenya (Elvish)", localOnly: true },
  { scryfallCode: "dw", manapoolCode: null, label: "Dwarvish", localOnly: true },
];

export const FINISH_TO_MANAPOOL: Record<string, string> = {
  NONFOIL: "NF",
  FOIL: "FO",
  ETCHED: "EF",
};

export const MANAPOOL_TO_FINISH: Record<string, "NONFOIL" | "FOIL" | "ETCHED"> = {
  NF: "NONFOIL",
  FO: "FOIL",
  EF: "ETCHED",
};

export const MANABOX_CONDITION_MAP: Record<string, "NM" | "LP" | "MP" | "HP" | "DMG"> = {
  mint: "NM",
  near_mint: "LP",
  excellent: "MP",
  good: "MP",
  light_played: "HP",
  played: "HP",
  poor: "DMG",
};

export function mapManaboxCondition(raw: string): "NM" | "LP" | "MP" | "HP" | "DMG" | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return MANABOX_CONDITION_MAP[key] ?? null;
}
