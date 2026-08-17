"use client";

import { useActionState } from "react";
import type { Channel } from "@prisma/client";
import { updateChannelBufferAction } from "@/app/settings/channels/actions";

interface ChannelSettingsFormProps {
  channel: Channel;
}

export function ChannelSettingsForm({ channel }: ChannelSettingsFormProps) {
  const [result, formAction] = useActionState(
    async (_prev: { ok: boolean; message: string } | null, formData: FormData) =>
      updateChannelBufferAction(formData),
    null,
  );

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-4">
      <input type="hidden" name="channelId" value={channel.id} />
      <div>
        <label htmlFor={`buffer-${channel.id}`} className="block text-sm text-zinc-400">
          Reserve buffer (units held back from this channel)
        </label>
        <input
          id={`buffer-${channel.id}`}
          name="reserveBufferQty"
          type="number"
          min={0}
          defaultValue={channel.reserveBufferQty}
          className="mt-1 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
      >
        Save
      </button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.message}</p>
      )}
    </form>
  );
}
