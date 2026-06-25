import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { sendLogs, campaigns } from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export const sendLogRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
        campaignId: z.number().int().positive().optional(),
        status: z.enum(["sent", "failed"]).optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const conditions = [];

      if (input.campaignId) {
        conditions.push(eq(sendLogs.campaignId, input.campaignId));
      }
      if (input.status) {
        conditions.push(eq(sendLogs.status, input.status));
      }
      if (input.search) {
        conditions.push(
          sql`(${sendLogs.email} LIKE ${`%${input.search}%`} OR ${sendLogs.detail} LIKE ${`%${input.search}%`})`
        );
      }
      if (input.dateFrom) {
        conditions.push(gte(sendLogs.sentAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(sendLogs.sentAt, new Date(input.dateTo)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const query = db
        .select({
          id: sendLogs.id,
          campaignId: sendLogs.campaignId,
          email: sendLogs.email,
          status: sendLogs.status,
          detail: sendLogs.detail,
          sentAt: sendLogs.sentAt,
          campaignName: campaigns.name,
        })
        .from(sendLogs)
        .leftJoin(campaigns, eq(sendLogs.campaignId, campaigns.id))
        .where(whereClause)
        .orderBy(desc(sendLogs.sentAt))
        .limit(input.limit)
        .offset(offset);

      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(sendLogs)
        .leftJoin(campaigns, eq(sendLogs.campaignId, campaigns.id))
        .where(whereClause);

      const [data, totalResult] = await Promise.all([query, countQuery]);

      return {
        logs: data,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  getById: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: sendLogs.id,
          campaignId: sendLogs.campaignId,
          email: sendLogs.email,
          status: sendLogs.status,
          detail: sendLogs.detail,
          sentAt: sendLogs.sentAt,
          campaignName: campaigns.name,
        })
        .from(sendLogs)
        .leftJoin(campaigns, eq(sendLogs.campaignId, campaigns.id))
        .where(eq(sendLogs.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  exportCsv: authedQuery
    .input(
      z.object({
        campaignId: z.number().int().positive().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input.campaignId) {
        conditions.push(eq(sendLogs.campaignId, input.campaignId));
      }
      if (input.dateFrom) {
        conditions.push(gte(sendLogs.sentAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(sendLogs.sentAt, new Date(input.dateTo)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select()
        .from(sendLogs)
        .where(whereClause)
        .orderBy(desc(sendLogs.sentAt));

      // Generate CSV
      const headers = ["Timestamp", "Email", "Status", "Detail"];
      const rows = logs.map((log) => [
        log.sentAt.toISOString(),
        log.email,
        log.status,
        log.detail || "",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");

      return { csv };
    }),
});

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
