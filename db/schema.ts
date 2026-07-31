import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  tokens: integer("tokens").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const actions = sqliteTable("actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletId: text("wallet_id").notNull(),
  kind: text("kind", { enum: ["pet", "treat"] }).notNull(),
  cost: integer("cost").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payments = sqliteTable("payments", {
  sessionId: text("session_id").primaryKey(),
  walletId: text("wallet_id").notNull(),
  tokens: integer("tokens").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
