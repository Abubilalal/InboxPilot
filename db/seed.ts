import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const urlStr = process.env.DATABASE_URL!;
const parsed = new URL(urlStr);
const pool = mysql.createPool({
  host: parsed.hostname,
  port: parseInt(parsed.port) || 3306,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool, { schema, mode: "planetscale" });

async function seed() {
  console.log("Seeding database...");

  // 1. Default settings
  const existingSettings = await db.select().from(schema.settings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(schema.settings).values({
      smtpHost: "smtp.zoho.com",
      smtpPort: 587,
      smtpUser: "info@lexilab.in",
      smtpPass: "your-app-password-here",
      senderName: "Lexi Translation Lab",
      senderEmail: "info@lexilab.in",
      replyTo: null,
      unsubMailto: "info@lexilab.in",
      unsubBaseUrl: "https://www.lexilab.in/unsubscribe",
      unsubSecret: null,
      defaultDelay: 6,
      defaultLimit: 0,
    });
    console.log("Default settings created");
  }

  // 2. Create a default contact list
  const existingLists = await db.select().from(schema.contactLists).limit(1);
  let defaultListId: number;
  if (existingLists.length === 0) {
    const result = await db.insert(schema.contactLists).values({
      name: "Default List",
      description: "Default contact list for Lexi Translation Lab campaigns",
    });
    defaultListId = Number(result[0].insertId);
    console.log("Default contact list created");
  } else {
    defaultListId = existingLists[0].id;
  }

  // 3. Create the Lexi Translation Lab email template
  const existingTemplates = await db.select().from(schema.templates).limit(1);
  if (existingTemplates.length === 0) {
    await db.insert(schema.templates).values({
      name: "Lexi Translation Lab - Outreach",
      subject: "Professional Hindi-English Translation Services — {{first_name}}",
      htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Lexi Translation Lab</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td style="background-color:#1a3a5c;padding:28px 36px 24px;">
          <p style="margin:0 0 2px 0;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#ffffff;letter-spacing:0.5px;">Lexi Translation Lab</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#8bafd4;letter-spacing:1.5px;text-transform:uppercase;">Legal Translation &amp; Documentation Services</p>
        </td></tr>
        <tr><td style="background-color:#c9a84c;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 8px;color:#222222;font-family:Georgia,serif;font-size:16px;line-height:1.75;">
          <p style="margin:0 0 20px;">Dear {{first_name}},</p>
          <p style="margin:0 0 20px;">Greetings from <strong>Lexi Translation Lab</strong>.</p>
          <p style="margin:0 0 20px;">We specialize in professional <strong>Hindi to English document translation and typing services</strong> for advocates, law firms, and legal professionals — ensuring accuracy, confidentiality, and timely delivery.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="background-color:#f4f7fb;border-left:4px solid #1a3a5c;border-radius:0 4px 4px 0;padding:20px 24px;">
            <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#1a3a5c;font-weight:bold;">Our Services</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.5;">&rsaquo;&nbsp; Hindi to English legal document translation</td></tr>
              <tr><td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.5;">&rsaquo;&nbsp; Typing and digitization from scanned or handwritten documents</td></tr>
              <tr><td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.5;">&rsaquo;&nbsp; Audio/video transcription for legal records</td></tr>
              <tr><td style="padding:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.5;">&rsaquo;&nbsp; Litigation and case documentation support</td></tr>
            </table>
          </td></tr></table>
          <p style="margin:0 0 20px;">We are committed to supporting legal workflows with reliable and efficient documentation services.</p>
          <p style="margin:0 0 28px;">If your office requires assistance with translation, typing, or document processing, we would be pleased to connect and understand your requirements.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;padding:16px 0;"><tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#444444;line-height:1.8;">
            <span style="color:#1a3a5c;font-weight:bold;">Website:</span> <a href="https://www.lexilab.in" style="color:#1a3a5c;text-decoration:none;border-bottom:1px solid #c9a84c;">www.lexilab.in</a><br>
            <span style="color:#1a3a5c;font-weight:bold;">Phone / WhatsApp:</span> <a href="https://wa.me/918368699442" style="color:#333333;text-decoration:none;">+91 83686 99442</a>
          </td></tr></table>
          <p style="margin:0 0 6px;">We look forward to working with you.</p>
          <p style="margin:0 0 28px;">Warm regards,</p>
          <p style="margin:0 0 4px;font-weight:bold;color:#1a3a5c;">Team Lexi Translation Lab</p>
          <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:12px;color:#888888;">info@lexilab.in &nbsp;|&nbsp; www.lexilab.in</p>
        </td></tr>
        <tr><td style="background-color:#f4f7fb;padding:16px 36px;border-top:1px solid #e0e0e0;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">You are receiving this because your contact details were obtained from professional directories or public records. <a href="{{unsubscribe_url}}" style="color:#aaaaaa;">Unsubscribe</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      textBody: `Dear Counsel,

Lexi Translation Lab provides language and documentation support for advocates and law firms:

Hindi <-> English legal translation — from Rs.60/page
Typing of scanned and handwritten files — from Rs.20/page
Audio & video transcription — Rs.100/minute
Delhi High Court e-filing support

Every document is human-reviewed for accuracy and handled in strict confidence.

Whenever your office needs a reliable hand, send a single file on WhatsApp or by email and we will take it from there.

Regards,
Team Lexi Translation Lab
Contact / WhatsApp: +91 83686 99442
Email: info@lexilab.in
Website: www.lexilab.in

Unsubscribe: {{unsubscribe_url}}`,
      variables: ["first_name", "unsubscribe_url"],
    });
    console.log("Default template created");
  }

  // 4. Import sample contacts
  const existingContacts = await db.select().from(schema.contacts).limit(1);
  if (existingContacts.length === 0) {
    const sampleContacts = [
      { email: "alice@example.com", first_name: "Alice" },
      { email: "bob@example.com", first_name: "Bob" },
      { email: "carol@example.com", first_name: "Carol" },
      { email: "dave@example.com", first_name: "Dave" },
      { email: "eve@example.com", first_name: "Eve" },
    ];

    for (const contact of sampleContacts) {
      const result = await db.insert(schema.contacts).values({
        email: contact.email,
        firstName: contact.first_name,
        status: "active",
      });
      const contactId = Number(result[0].insertId);
      await db.insert(schema.contactListMembers).values({
        listId: defaultListId,
        contactId,
      });
    }
    console.log("Sample contacts created");
  }

  // 5. Import send log data from the original system
  const existingLogs = await db.select().from(schema.sendLogs).limit(1);
  if (existingLogs.length === 0) {
    // Import from send_log.csv
    const fs = await import("fs");
    const path = "/mnt/agents/upload/send_log.csv";
    if (fs.existsSync(path)) {
      const Papa = (await import("papaparse")).default;
      const csv = fs.readFileSync(path, "utf-8");
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

      // Create a sample campaign for the logs
      const campaignResult = await db.insert(schema.campaigns).values({
        name: "Legacy Campaign",
        subject: "Hello {{first_name}}",
        templateId: null,
        listId: defaultListId,
        status: "completed",
        totalRecipients: parsed.data.length,
        sentCount: (parsed.data as any[]).filter((r: any) => r.status === "sent").length,
        failedCount: (parsed.data as any[]).filter((r: any) => r.status === "failed").length,
        completedAt: new Date(),
      });
      const campaignId = Number(campaignResult[0].insertId);

      // Insert logs
      for (const row of parsed.data as any[]) {
        if (!row.email) continue;
        await db.insert(schema.sendLogs).values({
          campaignId,
          email: row.email,
          status: row.status === "sent" ? "sent" : "failed",
          detail: row.detail || null,
          sentAt: row.timestamp ? new Date(row.timestamp) : new Date(),
        });
      }
      console.log(`Imported ${parsed.data.length} send logs`);
    }
  }

  // 6. Import suppression data
  const existingSupp = await db.select().from(schema.suppressions).limit(1);
  if (existingSupp.length === 0) {
    const fs = await import("fs");
    const path = "/mnt/agents/upload/suppression.csv";
    if (fs.existsSync(path)) {
      const Papa = (await import("papaparse")).default;
      const csv = fs.readFileSync(path, "utf-8");
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
      for (const row of parsed.data as any[]) {
        if (!row.email) continue;
        await db.insert(schema.suppressions).values({
          email: row.email,
          reason: "manual",
          source: "CSV import",
        });
      }
      console.log(`Imported ${parsed.data.length} suppressions`);
    }
  }

  await pool.end();
  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
