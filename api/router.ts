import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { dashboardRouter } from "./dashboard-router";
import { campaignRouter } from "./campaign-router";
import { contactRouter, contactListRouter } from "./contact-router";
import { templateRouter } from "./template-router";
import { sendLogRouter } from "./sendlog-router";
import { suppressionRouter } from "./suppression-router";
import { settingRouter } from "./setting-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  dashboard: dashboardRouter,
  campaign: campaignRouter,
  contact: contactRouter,
  contactList: contactListRouter,
  template: templateRouter,
  sendLog: sendLogRouter,
  suppression: suppressionRouter,
  setting: settingRouter,
});

export type AppRouter = typeof appRouter;
