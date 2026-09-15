import { Router, type IRouter, type Request } from "express";
import {
  AnalyzeFridgeImageBody,
  AnalyzeFridgeImageResponse,
  LookupRecipeBody,
  LookupRecipeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const GEMINI_MODEL = "gemini-3.6-flash";
const MAX_IMAGE_DATA_LENGTH = 11_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiPayload = { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> };

function safetyInstructions(safety: { kids: number; allergies: string[]; allergyOther: string }) {
  const blocked = [...safety.allergies, ...safety.allergyOther.split(",").map((item) => item.trim()).filter(Boolean)];
  const expandedBlocked = blocked.flatMap((item) => item === "Tôm tươi" ? [item, "toàn bộ hải sản như tôm, cá, mực, cua"] : [item]);
  const lines = [
    "Đây là các quy tắc an toàn bắt buộc, không được bỏ qua.",
    blocked.length
      ? `Tuyệt đối không dùng hoặc gợi ý các nguyên liệu dị ứng sau: ${expandedBlocked.join(", ")}.`
      : "Gia đình chưa khai báo dị ứng.",
    safety.kids > 0
      ? "Gia đình có trẻ nhỏ. Hãy loại bỏ mật ong khỏi toàn bộ gợi ý vì không được dùng mật ong cho trẻ dưới 12 tháng; ghi chú quy tắc này trong safetyNotes."
      : "Không đưa mật ong vào công thức trừ khi thật sự cần; nếu có thể, ưu tiên chất tạo ngọt tự nhiên khác.",
    "Ưu tiên vị nhạt, ít muối, ít dầu mỡ và cảnh báo nếu món không phù hợp cho trẻ nhỏ.",
  ];
  return lines.join("\n");
}

function extractGeminiText(payload: GeminiPayload) {
  return (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function parseJsonText(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as unknown;
}

async function generateJson(contents: Array<{ role: "user"; parts: GeminiPart[] }>, req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    req.log.error("GEMINI_API_KEY is not configured");
    throw new Error("Gemini API key is not configured");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
      },
    }),
  });
  const payload = (await response.json()) as GeminiPayload & { error?: { message?: string } };
  if (!response.ok) {
    req.log.warn({ status: response.status }, "Gemini request failed");
    throw new Error(payload.error?.message || `Gemini returned ${response.status}`);
  }
  return parseJsonText(extractGeminiText(payload));
}

router.post("/ai/fridge", async (req, res): Promise<void> => {
  const parsed = AnalyzeFridgeImageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues.length }, "Invalid fridge image request");
    res.status(400).json({ error: "Ảnh hoặc thông tin an toàn chưa hợp lệ." });
    return;
  }

  const { imageData, mimeType, safety } = parsed.data;
  if (!ALLOWED_IMAGE_TYPES.has(mimeType) || imageData.length > MAX_IMAGE_DATA_LENGTH || !imageData.startsWith("data:")) {
    res.status(400).json({ error: "Ảnh cần là JPEG, PNG, WebP hoặc HEIC và không vượt quá 8 MB." });
    return;
  }
  const encoded = imageData.slice(imageData.indexOf(",") + 1);

  try {
    const result = await generateJson([
      {
        role: "user",
        parts: [
          {
            text: `Bạn là chuyên gia dinh dưỡng gia đình Việt Nam. Hãy nhìn ảnh nguyên liệu/tủ lạnh, nhận diện những nguyên liệu có thể nhìn thấy và đề xuất đúng 3 món healthy biến tấu, nấu trong tối đa 30 phút. Chỉ trả về JSON hợp lệ theo cấu trúc:
{
  "ingredients": [{"name": "string", "confidence": 0.0}],
  "dishes": [{"name": "string", "why": "string", "ingredients": ["string"], "steps": ["string"], "nutrition": {"calories": 0, "protein": 0, "fat": 0}}],
  "safetyNotes": ["string"]
}
confidence là số từ 0 đến 1. Dinh dưỡng là ước tính cho 1 khẩu phần; protein và fat tính bằng gram. Không đoán các nguyên liệu không nhìn thấy là chắc chắn có, hãy ghi confidence thấp nếu không rõ.

${safetyInstructions(safety)}`,
          },
          { inlineData: { mimeType, data: encoded } },
        ],
      },
    ], req);
    res.json(AnalyzeFridgeImageResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Fridge analysis failed");
    res.status(502).json({ error: "Mình chưa đọc được ảnh lúc này. Bạn thử ảnh rõ hơn hoặc nhập tên món trực tiếp nhé." });
  }
});

router.post("/ai/recipe", async (req, res): Promise<void> => {
  const parsed = LookupRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues.length }, "Invalid recipe lookup request");
    res.status(400).json({ error: "Vui lòng nhập tên món ăn." });
    return;
  }

  const { dishName, safety } = parsed.data;
  try {
    const result = await generateJson([
      {
        role: "user",
        parts: [{
          text: `Bạn là đầu bếp gia đình Việt Nam và chuyên gia dinh dưỡng. Hãy tra cách nấu món "${dishName}" cho đúng 1 khẩu phần, theo hướng vị nhạt, ít dầu mỡ, dễ làm trong khoảng 30 phút. Chỉ trả về JSON hợp lệ theo cấu trúc:
{
  "dishName": "string",
  "servings": 1,
  "ingredients": [{"name": "string", "amount": "string"}],
  "steps": ["string"],
  "nutrition": {"calories": 0, "protein": 0, "fat": 0},
  "safetyNotes": ["string"]
}
calories là kcal, protein và fat tính bằng gram. Định lượng phải cụ thể cho 1 khẩu phần. ${safetyInstructions(safety)}`,
        }],
      },
    ], req);
    res.json(LookupRecipeResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Recipe lookup failed");
    res.status(502).json({ error: "Mình chưa tra được món này lúc này. Bạn thử lại sau ít giây nhé." });
  }
});

export default router;