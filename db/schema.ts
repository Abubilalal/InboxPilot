import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  varchar,
  text,
  int,
  json,
  timestamp,
} from "drizzle-orm/mysql-core";

// ─── Users (OAuth) ───────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Contacts ────────────────────────────────────────────────────

export const contacts = mysqlTable("contacts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  customFields: json("custom_fields"),
  status: mysqlEnum("status", ["active", "suppressed"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Contact Lists ───────────────────────────────────────────────

export const contactLists = mysqlTable("contact_lists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ContactList = typeof contactLists.$inferSelect;
export type InsertContactList = typeof contactLists.$inferInsert;

// ─── Contact List Members ────────────────────────────────────────

export const contactListMembers = mysqlTable("contact_list_members", {
  id: serial("id").primaryKey(),
  listId: bigint("list_id", { mode: "number", unsigned: true }).notNull(),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactListMember = typeof contactListMembers.$inferSelect;
export type InsertContactListMember = typeof contactListMembers.$inferInsert;

// ─── Templates ───────────────────────────────────────────────────

export const templates = mysqlTable("templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  htmlBody: text("html_body"),
  textBody: text("text_body").notNull(),
  variables: json("variables"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// ─── Campaigns ───────────────────────────────────────────────────

export const campaigns = mysqlTable("campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  templateId: bigint("template_id", { mode: "number", unsigned: true }),
  listId: bigint("list_id", { mode: "number", unsigned: true }),
  status: mysqlEnum("status", ["draft", "sending", "paused", "completed", "failed"])
    .default("draft")
    .notNull(),
  delay: int("delay").default(6).notNull(),
  sendLimit: int("send_limit").default(0).notNull(),
  testEmail: varchar("test_email", { length: 255 }),
  totalRecipients: int("total_recipients").default(0).notNull(),
  sentCount: int("sent_count").default(0).notNull(),
  failedCount: int("failed_count").default(0).notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Send Logs ───────────────────────────────────────────────────

export const sendLogs = mysqlTable("send_logs", {
  id: serial("id").primaryKey(),
  campaignId: bigint("campaign_id", { mode: "number", unsigned: true }).notNull(),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }),
  email: varchar("email", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["sent", "failed"]).notNull(),
  detail: text("detail"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type SendLog = typeof sendLogs.$inferSelect;
export type InsertSendLog = typeof sendLogs.$inferInsert;

// ─── Suppressions ────────────────────────────────────────────────

export const suppressions = mysqlTable("suppressions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  reason: mysqlEnum("reason", ["unsubscribed", "bounced", "manual"]).default("manual").notNull(),
  source: varchar("source", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Suppression = typeof suppressions.$inferSelect;
export type InsertSuppression = typeof suppressions.$inferInsert;

// ─── Settings ────────────────────────────────────────────────────

export const settings = mysqlTable("settings", {
  id: serial("id").primaryKey(),
  smtpHost: varchar("smtp_host", { length: 255 }).notNull(),
  smtpPort: int("smtp_port").default(587).notNull(),
  smtpUser: varchar("smtp_user", { length: 255 }).notNull(),
  smtpPass: varchar("smtp_pass", { length: 255 }).notNull(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }).notNull(),
  replyTo: varchar("reply_to", { length: 255 }),
  unsubMailto: varchar("unsub_mailto", { length: 255 }),
  unsubBaseUrl: varchar("unsub_base_url", { length: 500 }),
  unsubSecret: varchar("unsub_secret", { length: 255 }),
  defaultDelay: int("default_delay").default(6).notNull(),
  defaultLimit: int("default_limit").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
