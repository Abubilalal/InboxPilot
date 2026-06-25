import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { contacts, contactLists, contactListMembers, suppressions } from "@db/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const contactRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
        search: z.string().optional(),
        listId: z.number().int().positive().optional(),
        sort: z.enum(["recent", "name_asc", "name_desc"]).default("recent"),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions = [];
      if (input.search) {
        conditions.push(
          sql`(${contacts.email} LIKE ${`%${input.search}%`} OR ${contacts.firstName} LIKE ${`%${input.search}%`})`
        );
      }

      let query;
      if (input.listId) {
        // Filter by list membership
        const memberSubquery = db
          .select({ contactId: contactListMembers.contactId })
          .from(contactListMembers)
          .where(eq(contactListMembers.listId, input.listId));

        if (conditions.length > 0) {
          query = db
            .select()
            .from(contacts)
            .where(and(conditions[0], inArray(contacts.id, memberSubquery)));
        } else {
          query = db.select().from(contacts).where(inArray(contacts.id, memberSubquery));
        }
      } else {
        if (conditions.length > 0) {
          query = db.select().from(contacts).where(conditions[0]);
        } else {
          query = db.select().from(contacts);
        }
      }

      // Sort
      if (input.sort === "name_asc") {
        query = query.orderBy(contacts.firstName);
      } else if (input.sort === "name_desc") {
        query = query.orderBy(desc(contacts.firstName));
      } else {
        query = query.orderBy(desc(contacts.createdAt));
      }

      // Get total count
      let countQuery;
      if (input.listId) {
        const memberSubquery = db
          .select({ contactId: contactListMembers.contactId })
          .from(contactListMembers)
          .where(eq(contactListMembers.listId, input.listId));
        if (conditions.length > 0) {
          countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(contacts)
            .where(and(conditions[0], inArray(contacts.id, memberSubquery)));
        } else {
          countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(contacts)
            .where(inArray(contacts.id, memberSubquery));
        }
      } else {
        if (conditions.length > 0) {
          countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(contacts)
            .where(conditions[0]);
        } else {
          countQuery = db.select({ count: sql<number>`count(*)` }).from(contacts);
        }
      }

      const [data, totalResult] = await Promise.all([
        query.limit(input.limit).offset(offset),
        countQuery,
      ]);

      // Get list memberships for each contact
      const contactIds = data.map((c) => c.id);
      let memberships: Array<{ contactId: number; listId: number; listName: string }> = [];
      if (contactIds.length > 0) {
        const memberRows = await db
          .select({
            contactId: contactListMembers.contactId,
            listId: contactListMembers.listId,
            listName: contactLists.name,
          })
          .from(contactListMembers)
          .innerJoin(contactLists, eq(contactListMembers.listId, contactLists.id))
          .where(inArray(contactListMembers.contactId, contactIds));
        memberships = memberRows as unknown as typeof memberships;
      }

      const contactsWithLists = data.map((c) => ({
        ...c,
        lists: memberships
          .filter((m) => m.contactId === c.id)
          .map((m) => ({ id: m.listId, name: m.listName })),
      }));

      return {
        contacts: contactsWithLists,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  getById: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(contacts).where(eq(contacts.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: authedQuery
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        listIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if suppressed
      const suppressed = await db
        .select()
        .from(suppressions)
        .where(eq(suppressions.email, input.email.toLowerCase()))
        .limit(1);

      const result = await db.insert(contacts).values({
        email: input.email.toLowerCase(),
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        status: suppressed.length > 0 ? "suppressed" : "active",
      });

      const contactId = Number(result[0].insertId);

      if (input.listIds && input.listIds.length > 0) {
        await db.insert(contactListMembers).values(
          input.listIds.map((listId) => ({ listId, contactId }))
        );
      }

      return { id: contactId };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        status: z.enum(["active", "suppressed"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(contacts).set(data).where(eq(contacts.id, id));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Remove from list memberships first
      await db.delete(contactListMembers).where(eq(contactListMembers.contactId, input.id));
      await db.delete(contacts).where(eq(contacts.id, input.id));
      return { success: true };
    }),

  importCsv: authedQuery
    .input(
      z.object({
        listId: z.number().int().positive().optional(),
        data: z.array(z.record(z.string(), z.string())).max(50000),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { data, listId } = input;

      let targetListId = listId;
      if (!targetListId) {
        // Create a new list
        const listResult = await db.insert(contactLists).values({
          name: `Imported ${new Date().toLocaleDateString()}`,
        });
        targetListId = Number(listResult[0].insertId);
      }

      const errors: Array<{ row: number; reason: string }> = [];
      let imported = 0;
      let skipped = 0;

      // Get existing emails to avoid duplicates
      const allEmails = data.map((row) => (row.email || "").trim().toLowerCase()).filter(Boolean);
      const existingContacts = allEmails.length > 0
        ? await db.select().from(contacts).where(inArray(contacts.email, allEmails))
        : [];
      const existingEmails = new Set(existingContacts.map((c) => c.email));

      // Get suppressed emails
      const suppressedEmails = allEmails.length > 0
        ? await db.select().from(suppressions).where(inArray(suppressions.email, allEmails))
        : [];
      const suppressedSet = new Set(suppressedEmails.map((s) => s.email));

      // Process each row
      const newContacts: Array<{
        email: string;
        firstName: string | null;
        customFields: Record<string, string>;
      }> = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const email = (row.email || "").trim().toLowerCase();

        if (!email || !EMAIL_RE.test(email)) {
          errors.push({ row: i + 1, reason: "Invalid email format" });
          skipped++;
          continue;
        }

        if (existingEmails.has(email)) {
          skipped++;
          continue;
        }

        const firstName = (row.first_name || row.firstName || "").trim() || null;
        const customFields: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          if (key !== "email" && key !== "first_name" && key !== "firstName") {
            customFields[key] = value;
          }
        }

        newContacts.push({ email, firstName, customFields });
        existingEmails.add(email); // Prevent duplicates within the same import
      }

      // Batch insert contacts
      if (newContacts.length > 0) {
        const chunks = chunkArray(newContacts, 500);
        for (const chunk of chunks) {
          await db.insert(contacts).values(
            chunk.map((c) => ({
              email: c.email,
              firstName: c.firstName,
              customFields: Object.keys(c.customFields).length > 0 ? c.customFields : null,
              status: suppressedSet.has(c.email) ? ("suppressed" as const) : ("active" as const),
            }))
          );
          imported += chunk.length;
        }

        // Re-fetch the inserted contacts to get their IDs
        const insertedEmails = newContacts.map((c) => c.email);
        const insertedContacts = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.email, insertedEmails));

        // Add to list members
        await db.insert(contactListMembers).values(
          insertedContacts.map((c) => ({
            listId: targetListId!,
            contactId: c.id,
          }))
        );
      }

      return { imported, skipped, errors, listId: targetListId };
    }),
});

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export const contactListRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    const lists = await db.select().from(contactLists).orderBy(desc(contactLists.createdAt));

    // Get member counts
    const counts = await db
      .select({
        listId: contactListMembers.listId,
        count: sql<number>`count(*)`,
      })
      .from(contactListMembers)
      .groupBy(contactListMembers.listId);

    const countMap = new Map(counts.map((c) => [c.listId, c.count]));

    return lists.map((list) => ({
      ...list,
      contactCount: countMap.get(list.id) || 0,
    }));
  }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(contactLists).values({
        name: input.name,
        description: input.description || null,
      });
      return { id: Number(result[0].insertId) };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(contactLists).set(data).where(eq(contactLists.id, id));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Remove all members first
      await db.delete(contactListMembers).where(eq(contactListMembers.listId, input.id));
      await db.delete(contactLists).where(eq(contactLists.id, input.id));
      return { success: true };
    }),

  getMembers: authedQuery
    .input(z.object({ listId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const members = await db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
          status: contacts.status,
        })
        .from(contactListMembers)
        .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
        .where(eq(contactListMembers.listId, input.listId));
      return members;
    }),
});
