"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ScryfallHit {
  id: string;
  name: string;
  set: string;
  collector_number: string;
}

interface InventorySearchFormProps {
  initialName?: string;
}

export function InventorySearchForm({ initialName = "" }: InventorySearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialName);
  const [suggestions, setSuggestions] = useState<ScryfallHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (params: { name: string; scryfallId?: string; set?: string; collectorNumber?: string }) => {
      const sp = new URLSearchParams();
      sp.set("name", params.name);
      if (params.scryfallId) sp.set("scryfallId", params.scryfallId);
      if (params.set) sp.set("set", params.set);
      if (params.collectorNumber) sp.set("cn", params.collectorNumber);
      router.push(`/inventory?${sp.toString()}`);
      setOpen(false);
    },
    [router],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { data?: ScryfallHit[] };
        setSuggestions(data.data ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <form
      className="relative max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        runSearch({ name: trimmed });
      }}
    >
      <label className="block text-sm text-zinc-400">
        Card name
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search by card name…"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          autoComplete="off"
        />
      </label>

      {loading && <p className="mt-1 text-xs text-zinc-500">Searching Scryfall…</p>}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
          {suggestions.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={() =>
                  runSearch({
                    name: card.name,
                    scryfallId: card.id,
                    set: card.set,
                    collectorNumber: card.collector_number,
                  })
                }
              >
                <span className="font-medium">{card.name}</span>
                <span className="ml-2 text-zinc-500">
                  {card.set.toUpperCase()} #{card.collector_number}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
