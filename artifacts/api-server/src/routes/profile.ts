import { Router, type IRouter } from "express";
import { db, profilesTable, profilePayloadSchema } from "@workspace/db";

const router: IRouter = Router();

router.get("/profile/:deviceId", async (req, res) => {
  if (!db) {
    res.status(503).json({ error: "Database chưa được cấu hình." });
    return;
  }

  const profile = await db.query.profilesTable.findFirst({
    where: (table, { eq }) => eq(table.deviceId, req.params.deviceId),
  });
  res.json(profile ?? null);
});

router.put("/profile", async (req, res) => {
  if (!db) {
    res.status(503).json({ error: "Database chưa được cấu hình." });
    return;
  }

  const parsed = profilePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Thông tin hồ sơ không hợp lệ." });
    return;
  }

  const profile = await db.insert(profilesTable).values(parsed.data).onConflictDoUpdate({
    target: profilesTable.deviceId,
    set: {
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      preferences: parsed.data.preferences,
      updatedAt: new Date(),
    },
  }).returning();

  res.json(profile[0]);
});

export default router;