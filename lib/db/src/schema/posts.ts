import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blogPostsTable = pgTable("blog_posts", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  contentHtml: text("content_html").notNull(),
  coverImageUrl: text("cover_image_url"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({ createdAt: true, updatedAt: true, publishedAt: true });
export const blogPostPayloadSchema = z.object({
  slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(400).default(""),
  contentHtml: z.string().min(1),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  published: z.boolean().default(false),
});

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type BlogPostPayload = z.infer<typeof blogPostPayloadSchema>;
