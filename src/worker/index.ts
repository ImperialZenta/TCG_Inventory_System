import { createJobBoss, registerJobs } from "@/lib/jobs/register";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const boss = await createJobBoss(connectionString);
  await registerJobs(boss);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down worker...`);
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  console.log("Worker started (pg-boss)");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
