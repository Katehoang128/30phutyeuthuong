import { Router, type IRouter, type Request, type Response } from "express";
import { db, blogPostsTable, blogPostPayloadSchema } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

// Single-admin (Kate) write protection: no user accounts exist in this app, so a shared bearer
// token (set once as BLOG_ADMIN_TOKEN on the server) gates create/update/delete/draft-preview.
// Public GETs never need it. If the token isn't configured, admin routes stay closed (503), same
// as the existing `db` null-check pattern in routes/profile.ts.
function isAdmin(req: Request): boolean {
  const token = process.env.BLOG_ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${token}`;
}

function requireDb(res: Response): boolean {
  if (!db) {
    res.status(503).json({ error: "Database chưa được cấu hình." });
    return false;
  }
  return true;
}

router.get("/blog/posts", async (req, res): Promise<void> => {
  if (!requireDb(res)) return;
  const posts = await db!.query.blogPostsTable.findMany({
    where: (table, { eq: equals }) => equals(table.published, true),
    orderBy: (table, { desc: descending }) => [descending(table.publishedAt)],
    columns: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
  });
  res.json(posts);
});

router.get("/blog/admin/posts", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Cần token quản trị để xem danh sách bài viết." });
    return;
  }
  if (!requireDb(res)) return;
  const posts = await db!.query.blogPostsTable.findMany({
    orderBy: (table, { desc: descending }) => [descending(table.updatedAt)],
  });
  res.json(posts);
});

router.get("/blog/posts/:slug", async (req, res): Promise<void> => {
  if (!requireDb(res)) return;
  const post = await db!.query.blogPostsTable.findFirst({
    where: (table, { eq: equals }) => equals(table.slug, req.params.slug),
  });
  if (!post || (!post.published && !isAdmin(req))) {
    res.status(404).json({ error: "Không tìm thấy bài viết." });
    return;
  }
  res.json(post);
});

router.post("/blog/posts", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Cần token quản trị để đăng bài." });
    return;
  }
  if (!requireDb(res)) return;

  const parsed = blogPostPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Thông tin bài viết chưa hợp lệ." });
    return;
  }

  const existing = await db!.query.blogPostsTable.findFirst({ where: (table, { eq: equals }) => equals(table.slug, parsed.data.slug) });
  if (existing) {
    res.status(409).json({ error: "Đường dẫn (slug) này đã được dùng cho bài viết khác." });
    return;
  }

  const [post] = await db!.insert(blogPostsTable).values({
    slug: parsed.data.slug,
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    contentHtml: parsed.data.contentHtml,
    coverImageUrl: parsed.data.coverImageUrl || null,
    published: parsed.data.published,
    publishedAt: parsed.data.published ? new Date() : null,
  }).returning();
  res.json(post);
});

router.put("/blog/posts/:slug", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Cần token quản trị để sửa bài." });
    return;
  }
  if (!requireDb(res)) return;

  const parsed = blogPostPayloadSchema.omit({ slug: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Thông tin bài viết chưa hợp lệ." });
    return;
  }

  const existing = await db!.query.blogPostsTable.findFirst({ where: (table, { eq: equals }) => equals(table.slug, req.params.slug) });
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy bài viết." });
    return;
  }

  const [post] = await db!.update(blogPostsTable).set({
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    contentHtml: parsed.data.contentHtml,
    coverImageUrl: parsed.data.coverImageUrl || null,
    published: parsed.data.published,
    publishedAt: parsed.data.published ? existing.publishedAt || new Date() : existing.publishedAt,
    updatedAt: new Date(),
  }).where(eq(blogPostsTable.slug, req.params.slug)).returning();
  res.json(post);
});

router.delete("/blog/posts/:slug", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Cần token quản trị để xoá bài." });
    return;
  }
  if (!requireDb(res)) return;

  await db!.delete(blogPostsTable).where(eq(blogPostsTable.slug, req.params.slug));
  res.json({ ok: true });
});

export default router;
