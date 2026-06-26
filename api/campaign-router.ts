import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { campaigns, templates, contactLists, contactListMembers, contacts, sendLogs, settings, suppressions } from "@db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import * as nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// ─── Send Engine State ───────────────────────────────────────────

interface SendJob {
  abortController: AbortController;
  campaignId: number;
}

const activeJobs = new Map<number, SendJob>();

// ─── Token Renderer ──────────────────────────────────────────────

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function renderTemplate(text: string, data: Record<string, string>): string {
  return text.replace(TOKEN_RE, (_, key) => data[key] || "");
}

function extractSampleData(templateVars: unknown): Record<string, string> {
  const vars = (templateVars as string[]) || [];
  const sample: Record<string, string> = {
    first_name: "John",
    email: "john@example.com",
    last_name: "Doe",
  };
  for (const v of vars) {
    if (!sample[v]) sample[v] = `[${v}]`;
  }
  return sample;
}

// ─── SMTP Sender ─────────────────────────────────────────────────

async function getSmtpTransporter() {
  const db = getDb();
  const rows = await db.select().from(settings).limit(1);
  if (rows.length === 0) throw new Error("SMTP settings not configured");
  const s = rows[0];

  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort,
    secure: s.smtpPort === 465,
    requireTLS: s.smtpPort !== 465,
    auth: { user: s.smtpUser, pass: s.smtpPass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
  });

  return { transporter, settings: s };
}

async function sendEmail(
  transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>,
  smtpSettings: typeof settings.$inferSelect,
  toEmail: string,
  toName: string | null,
  subject: string,
  textBody: string,
  htmlBody: string | null,
  unsubscribeUrl?: string
): Promise<void> {
  // Zoho (and most providers) only allow sending "From" the authenticated
  // mailbox or a verified alias. Mirror the console version, where SENDER_EMAIL
  // equals SMTP_USER: if no sender email is configured, fall back to the
  // authenticated user instead of producing an invalid empty From.
  const fromEmail = smtpSettings.senderEmail || smtpSettings.smtpUser;
  const fromName = smtpSettings.senderName || fromEmail;

  const message: nodemailer.SendMailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    replyTo: smtpSettings.replyTo || undefined,
    subject,
    text: textBody,
    html: htmlBody || undefined,
  };

  // Add List-Unsubscribe header
  const unsubTargets: string[] = [];
  if (unsubscribeUrl) {
    unsubTargets.push(`<${unsubscribeUrl}>`);
  }
  if (smtpSettings.unsubMailto) {
    unsubTargets.push(`<mailto:${smtpSettings.unsubMailto}?subject=unsubscribe>`);
  }
  if (unsubTargets.length > 0) {
    const headers: Record<string, string> = {};
    headers["List-Unsubscribe"] = unsubTargets.join(", ");
    if (unsubscribeUrl) {
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    message.headers = headers;
  }

  await transporter.sendMail(message);
}

// ─── Send Loop ───────────────────────────────────────────────────

async function runSendLoop(campaignId: number) {
  const db = getDb();
  const abortController = new AbortController();
  activeJobs.set(campaignId, { abortController, campaignId });

  try {
    // Get campaign with template
    const campaignRows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (campaignRows.length === 0) return;
    const campaign = campaignRows[0];

    // Get template
    const templateRows = await db
      .select()
      .from(templates)
      .where(eq(templates.id, campaign.templateId!))
      .limit(1);
    if (templateRows.length === 0) {
      await db.update(campaigns).set({ status: "failed" }).where(eq(campaigns.id, campaignId));
      return;
    }
    const template = templateRows[0];

    // Get suppressed emails
    const suppressedRows = await db.select().from(suppressions);
    const suppressedSet = new Set(suppressedRows.map((s) => s.email));

    // Get contacts from list
    const contactRows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        customFields: contacts.customFields,
      })
      .from(contactListMembers)
      .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
      .where(eq(contactListMembers.listId, campaign.listId!));

    // Filter valid, non-suppressed contacts
    const validContacts = contactRows.filter((c) => {
      if (!c.email || suppressedSet.has(c.email)) return false;
      return true;
    });

    // Get already sent emails
    const sentRows = await db
      .select({ email: sendLogs.email })
      .from(sendLogs)
      .where(and(eq(sendLogs.campaignId, campaignId), eq(sendLogs.status, "sent")));
    const sentEmails = new Set(sentRows.map((s) => s.email));

    // Build queue (skip already sent)
    const queue = validContacts.filter((c) => !sentEmails.has(c.email));
    const limit = campaign.sendLimit > 0 ? Math.min(queue.length, campaign.sendLimit) : queue.length;
    const sendQueue = queue.slice(0, limit);

    // Update total recipients
    await db
      .update(campaigns)
      .set({ totalRecipients: sendQueue.length })
      .where(eq(campaigns.id, campaignId));

    if (sendQueue.length === 0) {
      await db
        .update(campaigns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
      return;
    }

    // Get SMTP settings
    const { transporter, settings: smtpSettings } = await getSmtpTransporter();

    let sent = campaign.sentCount;
    let failed = campaign.failedCount;

    for (let i = 0; i < sendQueue.length; i++) {
      // Check if aborted (paused)
      if (abortController.signal.aborted) {
        await db
          .update(campaigns)
          .set({ status: "paused", sentCount: sent, failedCount: failed })
          .where(eq(campaigns.id, campaignId));
        return;
      }

      // Check if status changed externally
      const statusCheck = await db
        .select({ status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);
      if (statusCheck[0]?.status === "paused") {
        await db
          .update(campaigns)
          .set({ sentCount: sent, failedCount: failed })
          .where(eq(campaigns.id, campaignId));
        return;
      }

      const contact = sendQueue[i];

      // Prepare data
      const customFields = (contact.customFields as Record<string, string>) || {};
      const data: Record<string, string> = {
        email: contact.email,
        first_name: contact.firstName || "",
        last_name: contact.lastName || "",
        unsubscribe_url: smtpSettings.unsubBaseUrl
          ? `${smtpSettings.unsubBaseUrl}?e=${encodeURIComponent(contact.email)}`
          : ``,
        ...customFields,
      };

      const subject = renderTemplate(campaign.subject, data);
      const textBody = renderTemplate(template.textBody, data);
      const htmlBody = template.htmlBody ? renderTemplate(template.htmlBody, data) : null;

      // Send with retry
      let success = false;
      let errorDetail = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendEmail(
            transporter,
            smtpSettings,
            contact.email,
            contact.firstName,
            subject,
            textBody,
            htmlBody,
            data.unsubscribe_url
          );
          success = true;
          break;
        } catch (err: unknown) {
          errorDetail = err instanceof Error ? err.message : "Unknown error";
          if (attempt < 3) {
            await sleep(2000 * attempt);
            // Try to reconnect
            try {
              await transporter.verify();
            } catch {
              // Re-create transporter
              const newSmtp = await getSmtpTransporter();
              Object.assign(transporter, newSmtp.transporter);
            }
          }
        }
      }

      // Log result
      await db.insert(sendLogs).values({
        campaignId,
        contactId: contact.id,
        email: contact.email,
        status: success ? "sent" : "failed",
        detail: success ? null : errorDetail,
        sentAt: new Date(),
      });

      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Update campaign progress
      await db
        .update(campaigns)
        .set({ sentCount: sent, failedCount: failed })
        .where(eq(campaigns.id, campaignId));

      // Throttle
      if (i < sendQueue.length - 1) {
        await sleep(campaign.delay * 1000);
      }
    }

    // Close SMTP connection
    try {
      transporter.close();
    } catch {
      // ignore
    }

    // Mark completed
    await db
      .update(campaigns)
      .set({ status: "completed", completedAt: new Date(), sentCount: sent, failedCount: failed })
      .where(eq(campaigns.id, campaignId));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(campaigns)
      .set({ status: "failed" })
      .where(eq(campaigns.id, campaignId));
    console.error(`Campaign ${campaignId} failed:`, msg);
  } finally {
    activeJobs.delete(campaignId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Router ──────────────────────────────────────────────────────

export const campaignRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
        search: z.string().optional(),
        status: z.enum(["draft", "sending", "paused", "completed", "failed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      const conditions = [];
      if (input.status) {
        conditions.push(eq(campaigns.status, input.status));
      }

      let whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Handle search across campaign name
      let query;
      let countQuery;
      if (input.search) {
        const searchCondition = sql`${campaigns.name} LIKE ${`%${input.search}%`}`;
        whereClause = whereClause ? and(whereClause, searchCondition) : searchCondition;
      }

      query = db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          subject: campaigns.subject,
          templateId: campaigns.templateId,
          listId: campaigns.listId,
          status: campaigns.status,
          delay: campaigns.delay,
          sendLimit: campaigns.sendLimit,
          totalRecipients: campaigns.totalRecipients,
          sentCount: campaigns.sentCount,
          failedCount: campaigns.failedCount,
          startedAt: campaigns.startedAt,
          completedAt: campaigns.completedAt,
          createdAt: campaigns.createdAt,
          templateName: templates.name,
          listName: contactLists.name,
        })
        .from(campaigns)
        .leftJoin(templates, eq(campaigns.templateId, templates.id))
        .leftJoin(contactLists, eq(campaigns.listId, contactLists.id))
        .where(whereClause)
        .orderBy(desc(campaigns.createdAt))
        .limit(input.limit)
        .offset(offset);

      countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(whereClause);

      const [data, totalResult] = await Promise.all([query, countQuery]);

      return {
        campaigns: data,
        total: totalResult[0]?.count ?? 0,
      };
    }),

  getById: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const campaignRows = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          subject: campaigns.subject,
          templateId: campaigns.templateId,
          listId: campaigns.listId,
          status: campaigns.status,
          delay: campaigns.delay,
          sendLimit: campaigns.sendLimit,
          testEmail: campaigns.testEmail,
          totalRecipients: campaigns.totalRecipients,
          sentCount: campaigns.sentCount,
          failedCount: campaigns.failedCount,
          startedAt: campaigns.startedAt,
          completedAt: campaigns.completedAt,
          createdAt: campaigns.createdAt,
          templateName: templates.name,
          templateTextBody: templates.textBody,
          templateHtmlBody: templates.htmlBody,
          templateVariables: templates.variables,
          listName: contactLists.name,
        })
        .from(campaigns)
        .leftJoin(templates, eq(campaigns.templateId, templates.id))
        .leftJoin(contactLists, eq(campaigns.listId, contactLists.id))
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (campaignRows.length === 0) return null;

      // Get recent logs
      const logs = await db
        .select()
        .from(sendLogs)
        .where(eq(sendLogs.campaignId, input.id))
        .orderBy(desc(sendLogs.sentAt))
        .limit(50);

      return {
        ...campaignRows[0],
        recentLogs: logs,
      };
    }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        subject: z.string().min(1).max(500),
        templateId: z.number().int().positive(),
        listId: z.number().int().positive(),
        delay: z.number().int().min(1).max(300).default(6),
        limit: z.number().int().min(0).default(0),
        testEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Validate template exists
      const templateRows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, input.templateId))
        .limit(1);
      if (templateRows.length === 0) throw new Error("Template not found");

      // Validate list exists
      const listRows = await db
        .select()
        .from(contactLists)
        .where(eq(contactLists.id, input.listId))
        .limit(1);
      if (listRows.length === 0) throw new Error("Contact list not found");

      // Count valid recipients (excluding suppressed)
      const suppressedRows = await db.select().from(suppressions);
      const suppressedSet = new Set(suppressedRows.map((s) => s.email));

      const contactRows = await db
        .select({ email: contacts.email })
        .from(contactListMembers)
        .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
        .where(eq(contactListMembers.listId, input.listId));

      const validCount = contactRows.filter((c) => c.email && !suppressedSet.has(c.email)).length;

      const result = await db.insert(campaigns).values({
        name: input.name,
        subject: input.subject,
        templateId: input.templateId,
        listId: input.listId,
        delay: input.delay,
        sendLimit: input.limit,
        testEmail: input.testEmail || null,
        totalRecipients: validCount,
      });

      return { id: Number(result[0].insertId) };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        subject: z.string().min(1).max(500).optional(),
        delay: z.number().int().min(1).max(300).optional(),
        limit: z.number().int().min(0).optional(),
        testEmail: z.string().email().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, limit, testEmail, ...rest } = input;

      const updateData: Record<string, unknown> = {};
      if (rest.name !== undefined) updateData.name = rest.name;
      if (rest.subject !== undefined) updateData.subject = rest.subject;
      if (rest.delay !== undefined) updateData.delay = rest.delay;
      if (limit !== undefined) updateData.sendLimit = limit;
      if (testEmail !== undefined) updateData.testEmail = testEmail || null;

      await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Abort active job
      const job = activeJobs.get(input.id);
      if (job) {
        job.abortController.abort();
        activeJobs.delete(input.id);
      }
      // Delete logs first
      await db.delete(sendLogs).where(eq(sendLogs.campaignId, input.id));
      await db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { success: true };
    }),

  send: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      if (rows.length === 0) throw new Error("Campaign not found");

      const campaign = rows[0];
      if (campaign.status === "sending") {
        throw new Error("Campaign is already sending");
      }

      // Update status
      await db
        .update(campaigns)
        .set({ status: "sending", startedAt: new Date() })
        .where(eq(campaigns.id, input.id));

      // Start send loop in background
      runSendLoop(input.id);

      return { status: "sending" };
    }),

  test: authedQuery
    .input(z.object({ id: z.number().int().positive(), testEmail: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get campaign and template
      const campaignRows = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      if (campaignRows.length === 0) throw new Error("Campaign not found");

      const templateRows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, campaignRows[0].templateId!))
        .limit(1);
      if (templateRows.length === 0) throw new Error("Template not found");

      const campaign = campaignRows[0];
      const template = templateRows[0];

      // Get SMTP
      const { transporter, settings: smtpSettings } = await getSmtpTransporter();

      // Render with sample data
      const sampleData = extractSampleData(template.variables);
      const subject = renderTemplate(campaign.subject, sampleData);
      const textBody = renderTemplate(template.textBody, sampleData);
      const htmlBody = template.htmlBody ? renderTemplate(template.htmlBody, sampleData) : null;

      // Send test
      await sendEmail(
        transporter,
        smtpSettings,
        input.testEmail,
        "Test",
        subject,
        textBody,
        htmlBody,
        sampleData.unsubscribe_url
      );

      transporter.close();

      return { status: "sent" };
    }),

  dryRun: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const campaignRows = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      if (campaignRows.length === 0) throw new Error("Campaign not found");

      const templateRows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, campaignRows[0].templateId!))
        .limit(1);
      if (templateRows.length === 0) throw new Error("Template not found");

      const campaign = campaignRows[0];
      const template = templateRows[0];

      // Get suppressed emails
      const suppressedRows = await db.select().from(suppressions);
      const suppressedSet = new Set(suppressedRows.map((s) => s.email));

      // Get contacts from list
      const contactRows = await db
        .select({
          id: contacts.id,
          email: contacts.email,
          firstName: contacts.firstName,
        })
        .from(contactListMembers)
        .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
        .where(eq(contactListMembers.listId, campaign.listId!));

      const validContacts = contactRows.filter((c) => c.email && !suppressedSet.has(c.email));

      // Get already sent
      const sentRows = await db
        .select({ email: sendLogs.email })
        .from(sendLogs)
        .where(and(eq(sendLogs.campaignId, input.id), eq(sendLogs.status, "sent")));
      const sentEmails = new Set(sentRows.map((s) => s.email));
      const queue = validContacts.filter((c) => !sentEmails.has(c.email));

      // Render preview with first contact
      const sampleData: Record<string, string> = {
        first_name: validContacts[0]?.firstName || "Test",
        email: validContacts[0]?.email || "test@example.com",
        unsubscribe_url: "https://example.com/unsubscribe",
      };

      const previewSubject = renderTemplate(campaign.subject, sampleData);
      const previewText = renderTemplate(template.textBody, sampleData);

      return {
        valid: true,
        recipientCount: queue.length,
        preview: {
          subject: previewSubject,
          textBody: previewText,
        },
      };
    }),

  pause: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const job = activeJobs.get(input.id);
      if (job) {
        job.abortController.abort();
        activeJobs.delete(input.id);
      }
      await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, input.id));
      return { status: "paused" };
    }),

  resume: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(campaigns)
        .set({ status: "sending" })
        .where(eq(campaigns.id, input.id));
      runSendLoop(input.id);
      return { status: "sending" };
    }),
});
