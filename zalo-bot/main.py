"""Zalo Bot webhook that answers customers as the virtual kitchen assistant of 30 Phút Yêu Thương, powered by Gemini."""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
from collections import deque
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

load_dotenv()

logger = logging.getLogger("zalo-bot")
logging.basicConfig(level=logging.INFO)
# httpx logs every request URL at INFO, and the Zalo bot token is part of that URL.
logging.getLogger("httpx").setLevel(logging.WARNING)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Same model family the web app's api-server already uses. gemini-1.5-* has been retired by Google.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
# Token that Zalo Bot Manager sends to your Zalo account when you create the bot.
ZALO_BOT_TOKEN = os.getenv("ZALO_BOT_TOKEN", "")
# 8-256 chars of your choosing; Zalo echoes it back in the X-Bot-Api-Secret-Token header on every webhook call.
ZALO_WEBHOOK_SECRET = os.getenv("ZALO_WEBHOOK_SECRET", "")
ZALO_BOT_API_BASE = os.getenv("ZALO_BOT_API_BASE", "https://bot-api.zapps.me").rstrip("/")
# Render exposes the service URL as RENDER_EXTERNAL_URL; PUBLIC_URL overrides it (e.g. for a tunnel).
PUBLIC_URL = (os.getenv("PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")

# The assistant's name shown to customers; change it in .env, no code edit needed.
BOT_NAME = os.getenv("BOT_NAME", "Mai")
WEB_APP_URL = "https://three0phut-web.onrender.com"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
ZALO_TEXT_LIMIT = 1900  # Stay under Zalo's 2000-character text limit.
GEMINI_MAX_ATTEMPTS = 3
MAX_HISTORY_MESSAGES = 12  # 6 user/assistant turns kept per Zalo user.
FALLBACK_REPLY = "Em đang hơi bận một chút, chị nhắn lại sau ít phút giúp em nhé 💚"

SYSTEM_PROMPT = f"""Bạn tên là {BOT_NAME}, trợ lý bếp "Vén Khéo & Tích Sản 2036" của dự án 30 Phút Yêu Thương, đồng hành cùng các mẹ, các chị nội trợ Việt Nam. Hãy nói chuyện như một cô em/người bạn thân am hiểu bếp núc, không như một cỗ máy trả lời.

CÁCH SUY NGHĨ TRƯỚC KHI TRẢ LỜI
- Đọc kỹ điều khách vừa nói và cả những gì họ đã kể trước đó trong cuộc trò chuyện; nhắc lại chi tiết đó (số người ăn, dị ứng, ngân sách, nguyên liệu đang có) để khách thấy mình được lắng nghe. Không hỏi lại điều khách đã nói.
- Nếu khách đang mệt, stress, hay lo tiền chợ, hãy đồng cảm một câu ngắn trước, rồi mới đưa giải pháp.
- Tự cân nhắc số người ăn, ngân sách, dị ứng, thời gian nấu, rồi đưa ra một lời khuyên rõ ràng kèm lý do ngắn gọn, thay vì liệt kê chung chung.
- Chỉ hỏi lại tối đa 1 câu khi thật sự thiếu thông tin quan trọng. Nếu đoán được hợp lý thì cứ gợi ý luôn và nói rõ mình đang giả định điều gì.
- Đổi cách diễn đạt giữa các tin nhắn, không lặp lại cùng một câu mở đầu.

DANH TÍNH VÀ SỰ TRUNG THỰC
- Bạn là trợ lý ảo tên {BOT_NAME}. Nếu khách hỏi bạn là người thật hay máy, hãy trả lời thẳng và nhẹ nhàng rằng bạn là trợ lý ảo của 30 Phút Yêu Thương, rồi tiếp tục giúp họ.
- Đừng bịa trải nghiệm đời thật (đã nấu món gì hôm qua, gia đình, con cái, đã đi chợ ở đâu). Có thể nói "nhiều nhà thường làm vậy", "cách này khá được các mẹ ưa chuộng".

GIỌNG ĐIỆU
- Thân thiện, thấu hiểu, chân thành, không giáo điều, không phán xét.
- Mặc định xưng "em" và gọi khách là "chị" (hoặc "bạn" nếu khách trẻ hoặc xưng "mình"). Nếu khách đề nghị cách xưng hô khác thì làm theo. Luôn giữ nhất quán một cách xưng hô cho cả cuộc trò chuyện.
- Trả lời ngắn gọn, đúng trọng tâm, tối đa khoảng 150 từ, dùng tối đa 2-3 emoji. Đây là tin nhắn Zalo nên KHÔNG dùng Markdown (không **đậm**, không #, không bảng); chỉ dùng chữ thường và gạch đầu dòng "-".
- Người dùng hỏi mơ hồ (ví dụ "hôm nay ăn gì") thì hỏi lại 1 câu ngắn (mấy người ăn, có ai dị ứng không, ngân sách bao nhiêu) hoặc gợi ý luôn 2-3 món kèm lý do.

BẠN GIÚP VỀ
1. Thực đơn 30 phút: gợi ý mâm cơm 3 món (1 món đạm, 1 món rau, 1 món canh) nấu xong trong tối đa 30 phút, ưu tiên hấp, luộc, canh thanh, áp chảo ít dầu.
2. Quy tắc Bàn tay (chuẩn dinh dưỡng WHO), mỗi người mỗi bữa: 1 lòng bàn tay đạm (khoảng 120-150g), 2 cả bàn tay rau củ (khoảng 250-300g), 1 nắm tay tinh bột chậm. Kiểm soát muối dưới 5g/ngày, giảm đường tinh luyện.
3. Mẹo dọn tủ 0 đồng: dùng hết rau củ, thịt cá còn trong tủ lạnh trước khi đi chợ tuần mới. Hỏi người dùng đang có nguyên liệu gì rồi gợi ý 2-3 món nấu từ đúng những thứ đó, không bắt mua thêm.
4. Bài toán tích sản: tiền chợ thừa mỗi tháng nhờ đi chợ khéo mà đem tích lũy dài hạn. Ví dụ minh họa: góp đều 500.000đ mỗi tháng, giả định lãi 8%/năm, sau 10 năm được khoảng 91 triệu, sau 12 năm được khoảng 120 triệu. Đây chỉ là tính toán minh họa với lãi suất giả định, KHÔNG phải cam kết lợi nhuận, và không phải lời khuyên đầu tư. Khi người dùng hỏi, hãy nói rõ giả định (số tiền, lãi suất, số năm) và không hứa hẹn chắc chắn.
5. Hướng dẫn dùng Web App {WEB_APP_URL}: mở tab Thực Đơn để xem thực đơn cả tuần, chọn bữa sáng/trưa/tối, bấm "Đổi" để đổi ngẫu nhiên hoặc chạm vào tên món để chọn đúng món mình muốn; card "Gợi ý hôm nay" gợi ý món theo mùa, món đang hot; "Thiết lập nhà mình" ở đầu trang để nhập số người, ngân sách, dị ứng; tab Đi Chợ cho danh sách đi chợ; tab Chi Phí theo dõi tiền chợ; tab Bếp AI để hỏi đáp thêm. Chỉ gửi link khi thật sự hữu ích, không lặp lại link ở mọi tin nhắn.

NGUYÊN TẮC
- Chỉ nói về nấu ăn, dinh dưỡng gia đình, đi chợ tiết kiệm, tích sản từ tiền chợ và cách dùng Web App. Câu hỏi ngoài lề thì từ chối nhẹ nhàng và dẫn về chủ đề bếp.
- Không chẩn đoán bệnh hay thay thế bác sĩ. Với trẻ nhỏ, người bệnh, phụ nữ mang thai hoặc dị ứng nghiêm trọng, nhắc tham khảo bác sĩ hoặc chuyên gia dinh dưỡng.
- Không bịa số liệu, giá cả, tên sản phẩm hay đường link. Không biết thì nói thẳng là không chắc.
- Nếu có URL hình ảnh công khai do chính người dùng cung cấp mà cần gửi lại, ghi trên một dòng riêng dạng [[IMAGE:url]]. Tuyệt đối không tự tạo URL hình.
"""

_client: httpx.AsyncClient | None = None
# Conversation memory per Zalo chat id. In-memory only: it resets when the service restarts or sleeps.
_histories: dict[str, list[dict]] = {}
_seen_message_ids: deque[str] = deque(maxlen=500)


def _bot_url(method: str) -> str:
    return f"{ZALO_BOT_API_BASE}/bot{ZALO_BOT_TOKEN}/{method}"


def _secret_token() -> str:
    # Zalo only accepts 8-256 chars of A-Z a-z 0-9 _ - for secret_token, but ZALO_WEBHOOK_SECRET can be
    # any string (Render's generated values contain + / =), so register and check its SHA-256 hex digest.
    return hashlib.sha256(ZALO_WEBHOOK_SECRET.encode("utf-8")).hexdigest()


async def _register_webhook() -> None:
    """Point Zalo at this service so nobody has to call setWebhook by hand."""
    if not (ZALO_BOT_TOKEN and ZALO_WEBHOOK_SECRET and PUBLIC_URL):
        logger.warning("Webhook not registered: set ZALO_BOT_TOKEN, ZALO_WEBHOOK_SECRET and PUBLIC_URL/RENDER_EXTERNAL_URL.")
        return
    try:
        response = await _http().post(_bot_url("setWebhook"), json={"url": f"{PUBLIC_URL}/zalo-webhook", "secret_token": _secret_token()})
        logger.info("setWebhook -> %s %s", response.status_code, response.text[:200])
    except httpx.HTTPError:
        logger.exception("setWebhook failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _client
    _client = httpx.AsyncClient(timeout=httpx.Timeout(25.0))
    await _register_webhook()
    yield
    await _client.aclose()


app = FastAPI(title="30 Phút Yêu Thương - Zalo Bot", lifespan=lifespan)


def _http() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client is not initialised")
    return _client


async def generate_ai_response(user_message: str, history: list[dict] | None = None) -> str:
    """Ask Gemini for a reply. `history` is a list of {"role": "user" | "model", "text": str}, oldest first."""
    contents = [{"role": item["role"], "parts": [{"text": item["text"]}]} for item in (history or [])]
    contents.append({"role": "user", "parts": [{"text": user_message}]})
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        # Generous cap: on thinking models the reasoning tokens count against it, and a small value
        # truncates the visible answer mid-sentence. Reply length is steered by the system prompt instead.
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096},
    }
    for attempt in range(GEMINI_MAX_ATTEMPTS):
        try:
            response = await _http().post(GEMINI_URL, headers={"x-goog-api-key": GEMINI_API_KEY}, json=payload)
            if response.status_code in (429, 500, 502, 503, 504) and attempt < GEMINI_MAX_ATTEMPTS - 1:
                await asyncio.sleep(1.5 * (attempt + 1))  # Gemini overload is usually momentary
                continue
            response.raise_for_status()
            candidate = response.json()["candidates"][0]
            if candidate.get("finishReason") == "MAX_TOKENS":
                logger.warning("Gemini reply hit the token cap and may be truncated")
            text = "".join(part.get("text", "") for part in candidate["content"]["parts"]).strip()
            return text or FALLBACK_REPLY
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            logger.exception("Gemini request failed")
            # An HTTP error status here is final (bad key, bad request, retries already used up);
            # only network hiccups are worth another attempt.
            if isinstance(exc, httpx.HTTPStatusError) or attempt == GEMINI_MAX_ATTEMPTS - 1:
                break
            await asyncio.sleep(1.5 * (attempt + 1))
    return FALLBACK_REPLY


def _split_text(text: str, limit: int = ZALO_TEXT_LIMIT) -> list[str]:
    chunks: list[str] = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut < limit // 2:
            cut = limit
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()
    if text:
        chunks.append(text)
    return chunks


async def _zalo_call(method: str, payload: dict) -> None:
    try:
        response = await _http().post(_bot_url(method), json=payload)
        body = response.json() if response.content else {}
        if response.status_code != 200 or body.get("ok") is False:
            logger.error("Zalo %s failed: %s %s", method, response.status_code, body)
    except (httpx.HTTPError, ValueError):
        logger.exception("Zalo %s request failed", method)


async def send_zalo_text(chat_id: str, text: str) -> None:
    for chunk in _split_text(text):
        await _zalo_call("sendMessage", {"chat_id": chat_id, "text": chunk})


async def send_zalo_image(chat_id: str, image_url: str, caption: str = "") -> None:
    await _zalo_call("sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": caption[:ZALO_TEXT_LIMIT]})


_IMAGE_TAG = re.compile(r"\[\[IMAGE:\s*(https?://\S+?)\s*\]\]")


async def _reply_to_user(chat_id: str, user_id: str, user_text: str) -> None:
    # In a group chat.id is the group, so key memory per member or everyone's questions would mix together.
    memory_key = f"{chat_id}:{user_id}"
    history = _histories.get(memory_key, [])
    reply = await generate_ai_response(user_text, history)

    images = _IMAGE_TAG.findall(reply)
    clean_reply = _IMAGE_TAG.sub("", reply).strip() or FALLBACK_REPLY

    if reply != FALLBACK_REPLY:
        history = history + [{"role": "user", "text": user_text}, {"role": "model", "text": clean_reply}]
        _histories[memory_key] = history[-MAX_HISTORY_MESSAGES:]

    await send_zalo_text(chat_id, clean_reply)
    for url in images:
        await send_zalo_image(chat_id, url)


@app.post("/zalo-webhook")
async def zalo_webhook(request: Request, background_tasks: BackgroundTasks):
    if not ZALO_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret is not configured")
    received = request.headers.get("X-Bot-Api-Secret-Token", "")
    if not hmac.compare_digest(received, _secret_token()):
        raise HTTPException(status_code=401, detail="Invalid secret token")

    try:
        body = json.loads(await request.body())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Zalo may deliver the update bare or wrapped as {"ok": true, "result": {...}}.
    update = body.get("result", body) if isinstance(body, dict) else {}
    if update.get("event_name") != "message.text.received":
        return {"ok": True}  # images, stickers and other events are acknowledged and ignored

    message = update.get("message") or {}
    if (message.get("from") or {}).get("is_bot"):
        return {"ok": True}
    chat_id = str((message.get("chat") or {}).get("id", ""))
    user_id = str((message.get("from") or {}).get("id", "")) or chat_id
    text = str(message.get("text") or "").strip()
    message_id = str(message.get("message_id", ""))
    if not chat_id or not text:
        return {"ok": True}
    if message_id:
        if message_id in _seen_message_ids:
            return {"ok": True}  # Zalo retries deliveries it thinks failed
        _seen_message_ids.append(message_id)

    # Zalo expects a fast 200, so the Gemini call and the reply happen after we respond.
    background_tasks.add_task(_reply_to_user, chat_id, user_id, text)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok", "model": GEMINI_MODEL}
