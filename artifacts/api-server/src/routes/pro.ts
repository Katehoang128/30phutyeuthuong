import { Router, type IRouter } from "express";

const router: IRouter = Router();
const PRO_AMOUNT = 49_000;

router.post("/pro/qr", (req, res) => {
  const phone = String(req.body?.phone ?? "").replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) {
    res.status(400).json({ error: "Vui lòng nhập số điện thoại hợp lệ để tạo nội dung chuyển khoản." });
    return;
  }

  const bankBin = process.env.VIETQR_BANK_BIN;
  const accountNumber = process.env.VIETQR_ACCOUNT_NUMBER;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;
  if (!bankBin || !accountNumber || !accountName) {
    res.status(503).json({ error: "Thông tin nhận chuyển khoản chưa được cấu hình." });
    return;
  }

  const transferContent = `PRO ${phone}`;
  const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankBin)}-${encodeURIComponent(accountNumber)}-compact2.png?${new URLSearchParams({
    amount: String(PRO_AMOUNT),
    addInfo: transferContent,
    accountName,
  }).toString()}`;

  res.json({ amount: PRO_AMOUNT, transferContent, qrUrl });
});

export default router;