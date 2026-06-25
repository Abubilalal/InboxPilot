import { relations } from "drizzle-orm";
import {
  contacts,
  contactLists,
  contactListMembers,
  templates,
  campaigns,
  sendLogs,
  suppressions,
} from "./schema";

export const contactsRelations = relations(contacts, ({ many }) => ({
  listMembers: many(contactListMembers),
}));

export const contactListsRelations = relations(contactLists, ({ many }) => ({
  members: many(contactListMembers),
}));

export const contactListMembersRelations = relations(contactListMembers, ({ one }) => ({
  list: one(contactLists, {
    fields: [contactListMembers.listId],
    references: [contactLists.id],
  }),
  contact: one(contacts, {
    fields: [contactListMembers.contactId],
    references: [contacts.id],
  }),
}));

export const templatesRelations = relations(templates, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(templates, {
    fields: [campaigns.templateId],
    references: [templates.id],
  }),
  list: one(contactLists, {
    fields: [campaigns.listId],
    references: [contactLists.id],
  }),
  logs: many(sendLogs),
}));

export const sendLogsRelations = relations(sendLogs, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [sendLogs.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [sendLogs.contactId],
    references: [contacts.id],
  }),
}));

export const suppressionsRelations = relations(suppressions, () => ({}));
