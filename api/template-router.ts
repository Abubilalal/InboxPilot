import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { templates } from "@db/schema";
import { eq, like, desc } from "drizzle-orm";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function extractVariables(subject: string, textBody: string, htmlBody?: string | null): string[] {
  const vars = new Set<string>();
  const extract = (text: string) => {
    let m;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      vars.add(m[1]);
    }
  };
  extract(subject);
  extract(textBody);
  if (htmlBody) extract(htmlBody);
  return Array.from(vars);
}

export const templateRouter = createRouter({
  list: authedQuery
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      let query = db.select().from(templates).orderBy(desc(templates.createdAt));
      if (input?.search) {
        return db
          .select()
          .from(templates)
          .where(like(templates.name, `%${input.search}%`))
          .orderBy(desc(templates.createdAt));
      }
      return query;
    }),

  getById: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(templates).where(eq(templates.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        subject: z.string().min(1).max(500),
        htmlBody: z.string().optional(),
        textBody: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const variables = extractVariables(input.subject, input.textBody, input.htmlBody);
      const result = await db.insert(templates).values({
        name: input.name,
        subject: input.subject,
        htmlBody: input.htmlBody || null,
        textBody: input.textBody,
        variables,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        subject: z.string().min(1).max(500).optional(),
        htmlBody: z.string().optional(),
        textBody: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...rest } = input;

      const updateData: Record<string, unknown> = {};
      if (rest.name !== undefined) updateData.name = rest.name;
      if (rest.subject !== undefined) updateData.subject = rest.subject;
      if (rest.htmlBody !== undefined) updateData.htmlBody = rest.htmlBody || null;
      if (rest.textBody !== undefined) updateData.textBody = rest.textBody;

      // Re-extract variables if subject or body changed
      if (rest.subject !== undefined || rest.textBody !== undefined || rest.htmlBody !== undefined) {
        const existing = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
        if (existing.length > 0) {
          const t = existing[0];
          const sub = rest.subject ?? t.subject;
          const txt = rest.textBody ?? t.textBody;
          const html = rest.htmlBody !== undefined ? rest.htmlBody : t.htmlBody;
          updateData.variables = extractVariables(sub, txt, html);
        }
      }

      await db.update(templates).set(updateData).where(eq(templates.id, id));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(templates).where(eq(templates.id, input.id));
      return { success: true };
    }),
});
