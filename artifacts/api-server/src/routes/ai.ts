import { Router, type IRouter, type Request } from "express";
import {
  AnalyzeFridgeImageBody,
  AnalyzeFridgeImageResponse,
  LookupRecipeBody,
  LookupRecipeResponse,
  GenerateMealTrayBody,
  GenerateMealTrayResponse,
  GenerateMealWeekBody,
  GenerateMealWeekResponse,
} from "@workspace/api-zod";
import { isLunarFirstOrFullMoonDay } from "../lib/lunar";

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

function familyProfileNote(familyProfile: { adults: number; elderly: number; kids: number; budgetPerMeal?: number }) {
  const members = [
    familyProfile.adults > 0 ? `${familyProfile.adults} người lớn` : null,
    familyProfile.elderly > 0 ? `${familyProfile.elderly} người lớn tuổi` : null,
    familyProfile.kids > 0 ? `${familyProfile.kids} trẻ nhỏ` : null,
  ].filter(Boolean).join(", ") || "1 người lớn";
  const budgetLine = familyProfile.budgetPerMeal
    ? `Ngân sách mong muốn cho mâm cơm này khoảng ${familyProfile.budgetPerMeal.toLocaleString("vi-VN")} đ — ưu tiên tối ưu chi phí quanh mức này, không vượt quá 20%.`
    : "Chưa có ngân sách cụ thể, hãy ước tính chi phí hợp lý theo giá chợ Việt Nam hiện tại.";
  return `Khẩu phần cho gia đình gồm ${members}. Định lượng nguyên liệu theo Quy tắc Bàn tay phải nhân đúng theo tổng số thành viên này (mỗi người 1 lòng bàn tay đạm, 2 cả bàn tay rau). ${budgetLine}`;
}

function bagIngredientsNote(bagIngredients?: { name: string; amount: string }[]) {
  if (!bagIngredients?.length) return "";
  const list = bagIngredients.map((item) => `${item.name} (${item.amount})`).join(", ");
  return `\n\nCHẾ ĐỘ TỰ NHẬP TÚI ĐỒ / DỌN TỦ: Người dùng đã có sẵn các nguyên liệu sau, BẮT BUỘC tận dụng tối đa để rải thành mâm cơm 3 món hoàn chỉnh, hạn chế thêm nguyên liệu mới ngoài danh sách trừ khi thật sự cần: ${list}. Đặt TÊN MÓN theo cách tả thực hấp dẫn (ví dụ: "Thịt ba chỉ luộc chấm mắm tôm chua"), TUYỆT ĐỐI KHÔNG viết tên món kiểu liệt kê nguyên liệu thô (ví dụ sai: "Thịt heo (Luộc)"). Nếu túi đồ thiếu rau, hãy tự động thêm 1 món canh bình dân dễ mua để bổ sung chất xơ.`;
}

function lunarNote(dateISO?: string) {
  const date = dateISO ? new Date(`${dateISO}T00:00:00Z`) : new Date();
  const { isSpecial, label } = isLunarFirstOrFullMoonDay(date);
  return isSpecial
    ? `\n\nLƯU Ý ĐẶC BIỆT: Hôm nay là ${label}. BẮT BUỘC gợi ý "Mâm Cơm Chay Thanh Tịnh Đủ Chất" — không dùng bất kỳ thịt, cá, hải sản hay trứng nào, chỉ dùng đạm thực vật (đậu hũ, nấm, các loại đậu...).`
    : "";
}

const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

// Checks the 7 real calendar days of the upcoming (or current, if today is Monday) Thứ 2 -> Chủ nhật
// week so the weekly generator can flag exactly which day(s) must be a vegetarian tray.
function weeklyLunarNote(dateISO?: string) {
  const today = dateISO ? new Date(`${dateISO}T00:00:00Z`) : new Date();
  const dow = today.getUTCDay(); // 0=Sun..6=Sat
  const daysUntilMonday = dow === 1 ? 0 : (8 - dow) % 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
  const specialDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const { isSpecial, label } = isLunarFirstOrFullMoonDay(d);
    if (isSpecial) specialDays.push(`${WEEKDAY_LABELS[i]} (${label})`);
  }
  return specialDays.length
    ? `\n\nLƯU Ý ĐẶC BIỆT CHO TUẦN NÀY: Các ngày sau rơi vào Mùng 1 hoặc Rằm âm lịch, BẮT BUỘC mâm cơm của đúng những ngày đó phải là "Mâm Cơm Chay Thanh Tịnh Đủ Chất" (không thịt/cá/hải sản/trứng): ${specialDays.join(", ")}.`
    : "";
}

// Shared persona + rule sections (1-3 of the spec) reused by both the single-tray and the
// 7-day weekly generator — only the intro line and the output-format section differ.
function mealTrayRulesText() {
  return `1. TIÊU CHUẨN DINH DƯỠNG & SỨC KHỎE (BẮT BUỘC TUÂN THỦ):
- Tiêu chuẩn WHO: Kiểm soát muối (<5g/ngày), giảm đường tinh luyện, ưu tiên chế biến thanh nhẹ (hấp, luộc, canh thanh, áp chảo ít dầu).
- Quy tắc Bàn tay: 1 Lòng bàn tay Đạm (~120-150g/người), 2 Cả bàn tay Chất xơ/Rau củ (~250-300g/người), 1 Nắm tay Tinh bột chậm.
- Chăm sóc U40 & Nội tiết tố: Ưu tiên nguyên liệu giàu Phytoestrogen và Omega-3 (đậu hũ, nấm, hạt mè, cá, bơ) giúp chống lão hóa và nhẹ bụng.
- Đảm bảo An toàn Dị ứng: KHÔNG ĐƯỢC chứa bất kỳ nguyên liệu nào nằm trong danh sách dị ứng/kiêng khem của người dùng.

2. KHO ẨM THỰC ĐA DẠNG & PHONG PHÚ:
Hãy linh hoạt biến tấu mâm cơm theo các phong cách: Truyền Thống 3 Miền Việt Nam (canh sấu thịt bằm, cá bống kho tiêu, canh chua bông điền điển, kho quẹt rau luộc...), Ẩm Thực Lễ/Tết/Mùa Vụ, Món Á Đông Hàn Quốc & Nhật Bản (canh kim chi đậu hũ, thịt xào bulgogi, canh rong biển miso, cá hồi sốt teriyaki...), Món Âu-Mỹ Tinh Gọn (mì Ý sốt cà thịt bằm, salad ức gà sốt mè, súp kem bí đỏ, bò lúc lắc ớt chuông), Món Trend TikTok phiên bản Healthy (ít dầu mỡ, chuẩn dinh dưỡng gia đình).

3. TỰ ĐỘNG HÓA THEO BỐI CẢNH:
Nếu gia đình có trẻ nhỏ, ưu tiên món mềm, dễ tiêu hóa, cắt thái nhỏ gọn nhưng vẫn kích thích thị giác cho bé.`;
}

router.post("/ai/meal-tray", async (req, res): Promise<void> => {
  const parsed = GenerateMealTrayBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues.length }, "Invalid meal tray request");
    res.status(400).json({ error: "Thông tin gia đình chưa hợp lệ." });
    return;
  }

  const { familyProfile, safety, bagIngredients, dateISO } = parsed.data;
  try {
    const result = await generateJson([
      {
        role: "user",
        parts: [{
          text: `Bạn là "Đầu Bếp Vén Khéo & Chuyên Gia Dinh Dưỡng AI" của ứng dụng "30 Phút Yêu Thương".

NHIỆM VỤ CỐT LÕI:
Dựa trên thông tin cài đặt của gia đình và ngân sách người dùng cung cấp, hãy tạo ra MÂM CƠM 3 MÓN HOÀN CHỈNH (1 Món Đạm - 1 Món Rau/Xào - 1 Món Canh) với tiêu chí: Nấu nhanh ≤ 30 phút, Chuẩn dinh dưỡng y khoa, Đa dạng hương vị và Tối ưu chi phí.

${mealTrayRulesText()}

${familyProfileNote(familyProfile)}${bagIngredientsNote(bagIngredients)}${lunarNote(dateISO)}

${safetyInstructions(safety)}

4. CẤU TRÚC ĐẦU RA (OUTPUT FORMAT - BẮT BUỘC JSON CHUẨN, không thêm lời dẫn, không markdown):
{
  "meal_title": "Tên mâm cơm truyền cảm hứng",
  "total_estimated_cost": 55000,
  "cooking_time_minutes": 25,
  "health_benefits_note": "1 câu giải thích lợi ích dinh dưỡng (VD: Chuẩn WHO, giàu phytoestrogen cho U40)",
  "dishes": [
    {"category": "Món Đạm", "name": "Tên món đạm hấp dẫn", "portion_hand_rule": "1 lòng bàn tay (~150g)", "ingredients": [{"item": "Tên nguyên liệu", "amount": "150g", "cost": 25000}]},
    {"category": "Món Rau", "name": "Tên món rau/xào hấp dẫn", "portion_hand_rule": "2 cả bàn tay (~250g)", "ingredients": [{"item": "Tên rau củ", "amount": "250g", "cost": 10000}]},
    {"category": "Món Canh", "name": "Tên món canh thanh mát", "portion_hand_rule": "1 bát canh thanh", "ingredients": [{"item": "Tên nguyên liệu canh", "amount": "100g", "cost": 8000}]}
  ],
  "tags": ["🖐️ Chuẩn Bàn Tay", "🌸 U40 Estrogen", "🇰🇷 Đổi vị Hàn Quốc"]
}
total_estimated_cost phải bằng đúng tổng của mọi "cost" trong ingredients (VNĐ nguyên, không thập phân). dishes phải có đúng 3 phần tử, đúng thứ tự Món Đạm, Món Rau, Món Canh. tags gồm 2-4 nhãn ngắn gọn kèm 1 emoji mỗi nhãn.`,
        }],
      },
    ], req);
    res.json(GenerateMealTrayResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Meal tray generation failed");
    res.status(502).json({ error: "Mình chưa lên được mâm cơm lúc này. Bạn thử lại sau ít giây nhé." });
  }
});

// Powers "⚡ AI Ghép Mâm Cơm Tuần Mới" (chế độ Tự Nhập Túi Đồ / Tủ Lạnh trên tab Đi Chợ): one Gemini
// call returns all 7 ngày thay vì gọi 7 lần riêng lẻ, vừa nhanh vừa không đốt hết lượt AI miễn phí.
router.post("/ai/meal-week", async (req, res): Promise<void> => {
  const parsed = GenerateMealWeekBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.issues.length }, "Invalid meal week request");
    res.status(400).json({ error: "Thông tin gia đình chưa hợp lệ." });
    return;
  }

  const { familyProfile, safety, bagIngredients, dateISO } = parsed.data;
  try {
    const result = await generateJson([
      {
        role: "user",
        parts: [{
          text: `Bạn là "Đầu Bếp Vén Khéo & Chuyên Gia Dinh Dưỡng AI" của ứng dụng "30 Phút Yêu Thương".

NHIỆM VỤ CỐT LÕI:
Dựa trên thông tin cài đặt của gia đình, hãy tạo ra LỊCH 7 MÂM CƠM 3 MÓN HOÀN CHỈNH cho 7 ngày liên tiếp từ Thứ 2 đến Chủ nhật (mỗi mâm gồm 1 Món Đạm - 1 Món Rau/Xào - 1 Món Canh), tiêu chí cho từng mâm: Nấu nhanh ≤ 30 phút, Chuẩn dinh dưỡng y khoa, Đa dạng hương vị giữa các ngày và Tối ưu chi phí.

${mealTrayRulesText()}

${familyProfileNote(familyProfile)}${bagIngredientsNote(bagIngredients)}${weeklyLunarNote(dateISO)}

${safetyInstructions(safety)}

YÊU CẦU RIÊNG CHO CẢ TUẦN:
- Tạo đúng 7 mâm cơm theo đúng thứ tự Thứ 2, Thứ 3, Thứ 4, Thứ 5, Thứ 6, Thứ 7, Chủ nhật.
- Đa dạng hoá món Đạm: KHÔNG dùng cùng 1 loại đạm chính (thịt heo/gà/bò/cá/tôm/đậu hũ...) ở 2 ngày liên tiếp.
- Nếu có nguyên liệu túi đồ ở trên, hãy rải và tận dụng toàn bộ số lượng đã cho trải đều 7 ngày, không vượt quá khối lượng thực có, ưu tiên dùng hết trước khi thêm nguyên liệu mới.
- Ngày nào được ghi chú Mùng 1/Rằm ở trên thì mâm cơm ngày đó bắt buộc là mâm chay.

CẤU TRÚC ĐẦU RA (OUTPUT FORMAT - BẮT BUỘC JSON CHUẨN, không thêm lời dẫn, không markdown):
{
  "week": [
    {"day_label": "Thứ 2", "meal_title": "Tên mâm cơm truyền cảm hứng", "total_estimated_cost": 55000, "cooking_time_minutes": 25, "health_benefits_note": "1 câu giải thích lợi ích dinh dưỡng", "dishes": [{"category": "Món Đạm", "name": "string", "portion_hand_rule": "1 lòng bàn tay (~150g)", "ingredients": [{"item": "string", "amount": "150g", "cost": 25000}]}, {"category": "Món Rau", "name": "string", "portion_hand_rule": "2 cả bàn tay (~250g)", "ingredients": [{"item": "string", "amount": "250g", "cost": 10000}]}, {"category": "Món Canh", "name": "string", "portion_hand_rule": "1 bát canh thanh", "ingredients": [{"item": "string", "amount": "100g", "cost": 8000}]}], "tags": ["🖐️ Chuẩn Bàn Tay"]},
    ... đủ 7 phần tử theo đúng thứ tự Thứ 2 -> Chủ nhật ...
  ]
}
Mỗi phần tử của "week" phải có đúng 3 dishes theo đúng thứ tự Món Đạm, Món Rau, Món Canh. total_estimated_cost của mỗi ngày phải bằng đúng tổng "cost" trong ingredients ngày đó (VNĐ nguyên, không thập phân). tags mỗi ngày gồm 2-4 nhãn ngắn gọn kèm 1 emoji.`,
        }],
      },
    ], req);
    res.json(GenerateMealWeekResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Meal week generation failed");
    res.status(502).json({ error: "Mình chưa lên được thực đơn tuần này. Bạn thử lại sau ít giây nhé." });
  }
});

export default router;