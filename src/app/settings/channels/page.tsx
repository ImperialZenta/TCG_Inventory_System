import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ensureDefaultManaPoolChannel, listChannels } from "@/lib/channels/config";
import { ChannelSettingsForm } from "./channel-settings-form";

export const dynamic = "force-dynamic";

export default async function ChannelSettingsPage() {
  await ensureDefaultManaPoolChannel();
  const channels = await listChannels();

  return (
    <>
      <PageHeader
        title="Sales channels"
        description="Configure marketplace sync settings and per-channel reserve buffers."
      />

      <Link href="/settings" className="mb-6 inline-block text-sm text-amber-400 hover:text-amber-300">
        ← Back to settings
      </Link>

      <div className="space-y-6">
        {channels.map((channel) => (
          <section
            key={channel.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium text-zinc-100">{channel.name}</h2>
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                {channel.type} · {channel.syncMode}
                {channel.paused ? " · paused" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Channels are offered available quantity minus any active reservations, never raw on-hand.
            </p>
            <ChannelSettingsForm channel={channel} />
          </section>
        ))}
      </div>
    </>
  );
}
