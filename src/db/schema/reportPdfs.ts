import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const reportPdfs = pgTable(
  "report_pdfs",
  {
    scanId: integer("scan_id").notNull(),
    variant: text("variant").notNull(), // audit | full
    contentBase64: text("content_base64").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.scanId, table.variant] })],
);
