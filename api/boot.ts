import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // The send loop runs in-memory and does NOT survive a process restart or
  // spin-down (common on hosts like Render). Any campaign left in "sending"
  // from a previous process is orphaned, so flip it to "paused" on boot —
  // that makes it resumable instead of frozen forever.
  try {
    const { getDb } = await import("./queries/connection");
    const { campaigns } = await import("@db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db
      .update(campaigns)
      .set({ status: "paused" })
      .where(eq(campaigns.status, "sending"));
  } catch (err) {
    console.error("Failed to recover stuck campaigns on boot:", err);
  }

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
