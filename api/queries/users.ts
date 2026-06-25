import { eq, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function countUsers(): Promise<number> {
  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.users);
  return Number(rows.at(0)?.count ?? 0);
}

export async function createUser(data: InsertUser) {
  await getDb().insert(schema.users).values(data);
  return findUserByUnionId(data.unionId);
}
