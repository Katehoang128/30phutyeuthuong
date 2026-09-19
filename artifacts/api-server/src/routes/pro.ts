import { Router, type IRouter } from "express";

const router: IRouter = Router();
const PRO_AMOUNTS = { monthly: 49_000, annual: 399_000 } as const;

router.post("/pro/qr", (req, res) => {
  const phone = String(req.body?.phone ?? "").replace(/\D/g, "");
  const plan = req.body?.plan === "annual" ? "annual" : "monthly";
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

  const amount = PRO_AMOUNTS[plan];
  const transferContent = `PRO ${plan === "annual" ? "YEAR" : "MONTH"} ${phone}`;
  const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankBin)}-${encodeURIComponent(accountNumber)}-compact2.png?${new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName,
  }).toString()}`;

  res.json({ amount, transferContent, qrUrl });
});

export default router;