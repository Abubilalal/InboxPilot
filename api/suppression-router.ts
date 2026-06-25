import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { suppressions, contacts } from "@db/schema";
import { eq, like, desc, sql } from "drizzle-orm";

export const suppressionRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      let query;
      let countQuery;

      if (input.search) {
        query = db
          .select()
          .from(suppressions)
          .where(like(suppressions.email, `%${input.search}%`))
          .orderBy(desc(suppressions.createdAt))
          .limit(input.limit)
          .offset(offset);
        countQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(suppressions)
          .where(like(suppressions.email, `%${input.search}%`));
      } else {
        query = db
          .select()
          .from(suppressions)
          .orderBy(desc(suppressions.createdAt))
          .limit(input.limit)
          .offset(offset);
        countQuery = db.select({ count: sql<number>`count(*)` }).from(suppressions);
      }

      const [data, totalResult] = await Promise.all([query, countQuery]);

      return {
        suppressions: data,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  create: authedQuery
    .input(
      z.object({
        email: z.string().email(),
        reason: z.enum(["unsubscribed", "bounced", "manual"]).default("manual"),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Insert or update suppression
      await db
        .insert(suppressions)
        .values({
          email: input.email.toLowerCase(),
          reason: input.reason,
          source: input.source || null,
        })
        .onDuplicateKeyUpdate({
          set: {
            reason: input.reason,
            source: input.source || null,
          },
        });

      // Update contact status if exists
      await db
        .update(contacts)
        .set({ status: "suppressed" })
        .where(eq(contacts.email, input.email.toLowerCase()));

      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(suppressions).where(eq(suppressions.id, input.id)).limit(1);
      if (rows.length > 0) {
        const email = rows[0].email;
        await db.delete(suppressions).where(eq(suppressions.id, input.id));
        // Reactivate contact
        await db.update(contacts).set({ status: "active" }).where(eq(contacts.email, email));
      }
      return { success: true };
    }),

  importCsv: authedQuery
    .input(z.object({ data: z.array(z.object({ email: z.string() })).max(10000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const emails = input.data.map((row) => row.email.trim().toLowerCase()).filter(Boolean);

      const newEmails = [...new Set(emails)];
      if (newEmails.length === 0) return { imported: 0 };

      await db.insert(suppressions).values(
        newEmails.map((email) => ({
          email,
          reason: "manual" as const,
          source: "CSV import",
        }))
      ).onDuplicateKeyUpdate({
        set: { reason: "manual" },
      });

      // Update matching contacts
      await db
        .update(contacts)
        .set({ status: "suppressed" })
        .where(sql`${contacts.email} IN (${newEmails.join(",")})`);

      return { imported: newEmails.length };
    }),
});
