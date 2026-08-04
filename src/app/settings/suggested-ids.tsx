"use client";

import { useState } from "react";

interface Shelf {
  code: string;
}

interface SuggestedIdsProps {
  shelves: Shelf[];
}

export function SuggestedIds({ shelves }: SuggestedIdsProps) {
  const [suggestion, setSuggestion] = useState<{ nextShelf: string; nextBin: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  async function fetchSuggestions() {
    setLoading(true);
    try {
      const shelfCode = shelves.length > 0 ? shelves[shelves.length - 1].code : undefined;
      const params = shelfCode ? `?shelf=${encodeURIComponent(shelfCode)}` : "";
      const res = await fetch(`/api/settings/suggest-ids${params}`);
      const data = (await res.json()) as { nextShelf: string; nextBin: string };
      setSuggestion(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">Suggested next IDs</p>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading}
          className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
        >
          {loading ? "…" : "Suggest"}
        </button>
      </div>
      {suggestion && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-zinc-500">Next shelf</dt>
            <dd className="font-mono text-zinc-100">{suggestion.nextShelf}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Next bin</dt>
            <dd className="font-mono text-zinc-100">{suggestion.nextBin}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
