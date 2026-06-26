import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { settings } from "@db/schema";
import { eq } from "drizzle-orm";
import * as nodemailer from "nodemailer";

export const settingRouter = createRouter({
  get: authedQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(settings).limit(1);
    if (rows.length === 0) {
      // Return default settings structure
      return {
        id: null,
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPass: null as string | null,
        senderName: "",
        senderEmail: "",
        replyTo: "",
        unsubMailto: "",
        unsubBaseUrl: "",
        unsubSecret: null as string | null,
        defaultDelay: 6,
        defaultLimit: 0,
      };
    }
    const row = rows[0];
    return {
      ...row,
      smtpPass: null,
      unsubSecret: null,
    };
  }),

  update: authedQuery
    .input(
      z.object({
        smtpHost: z.string().min(1).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        senderName: z.string().optional(),
        senderEmail: z.string().email().optional().or(z.literal("")),
        replyTo: z.string().email().optional().or(z.literal("")).nullable(),
        unsubMailto: z.string().email().optional().or(z.literal("")).nullable(),
        unsubBaseUrl: z.string().url().optional().or(z.literal("")).nullable(),
        unsubSecret: z.string().optional(),
        defaultDelay: z.number().int().min(1).max(300).optional(),
        defaultLimit: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(settings).limit(1);

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          // Map camelCase to snake_case for DB columns
          const dbKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
          updateData[dbKey] = value;
        }
      }

      if (rows.length === 0) {
        // Insert new settings
        const insertData = {
          smtpHost: input.smtpHost || "",
          smtpPort: input.smtpPort || 587,
          smtpUser: input.smtpUser || "",
          smtpPass: input.smtpPass || "",
          senderName: input.senderName || "",
          senderEmail: input.senderEmail || "",
          replyTo: input.replyTo || null,
          unsubMailto: input.unsubMailto || null,
          unsubBaseUrl: input.unsubBaseUrl || null,
          unsubSecret: input.unsubSecret || null,
          defaultDelay: input.defaultDelay || 6,
          defaultLimit: input.defaultLimit || 0,
        };
        await db.insert(settings).values(insertData);
      } else {
        // Update existing - only include fields that were provided
        if (Object.keys(updateData).length > 0) {
          await db.update(settings).set(updateData).where(eq(settings.id, rows[0].id));
        }
      }

      return { success: true };
    }),

  testConnection: authedQuery
    .input(
      z
        .object({
          smtpHost: z.string().optional(),
          smtpPort: z.number().int().min(1).max(65535).optional(),
          smtpUser: z.string().optional(),
          smtpPass: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(settings).limit(1);
      const saved = rows[0];

      // Prefer the values currently in the form; fall back to whatever is saved.
      const host = input?.smtpHost || saved?.smtpHost || "";
      const port = input?.smtpPort || saved?.smtpPort || 587;
      const user = input?.smtpUser || saved?.smtpUser || "";
      const pass = input?.smtpPass || saved?.smtpPass || "";

      if (!host || !user || !pass) {
        return {
          success: false,
          message:
            "Missing SMTP host, username, or password. Fill them in (or Save settings) and try again.",
        };
      }

      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          requireTLS: port !== 465,
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        });

        await transporter.verify();
        return { success: true, message: "SMTP connection successful" };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return { success: false, message: `SMTP connection failed: ${msg}` };
      }
    }),
});
