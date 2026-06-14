// PATH: backend/routes/aiRoutes.js
import express from "express";
import multer from "multer";
import { photoDiagnosis } from "../controllers/aiController.js";

const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
});

const diagnosisSystemPrompt = `
أنت خبير ميكانيكي سيارات متخصص في تشخيص الأعطال للمستخدمين المصريين.
مهمتك: تحليل وصف العطل وإرجاع JSON فقط بدون أي نص إضافي.

أرجع JSON بهذا الشكل فقط:
{
  "service": "battery",
  "title": "مشكلة بطارية",
  "confidence": 87,
  "reason": "الوصف يشير بوضوح إلى...",
  "advice": "ننصح بـ...",
  "urgency": "high",
  "possible_causes": ["سبب 1", "سبب 2", "سبب 3"],
  "quick_checks": ["افحص...", "تأكد من..."]
}

الخدمات المتاحة:
battery, tires, brakes, engine, electrical, ac, transmission, fuel, bodywork, general
`;

const chatSystemPrompt = `
أنت ميكانيكي سيارات خبير اسمك "أستاذ كريم" بتتكلم مع عملاء تطبيق Doctor Car.
اتكلم بالعامية المصرية.
اسأل أسئلة تشخيصية ذكية.
ردودك قصيرة وواضحة من 3 إلى 4 جمل فقط.
`;

function requireAnthropicKey(req, res, next) {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "ANTHROPIC_API_KEY is missing on server",
    });
  }
  next();
}

async function callAnthropic({ system, messages, maxTokens = 1000 }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Anthropic error ${response.status}`;

    const error = new Error(msg);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function extractText(data) {
  return (data?.content || [])
    .map((b) => b?.text || "")
    .join("")
    .trim();
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "AI routes ready",
    hasAnthropicKey: Boolean(ANTHROPIC_API_KEY),
    model: ANTHROPIC_MODEL,
  });
});

router.post("/diagnose", requireAnthropicKey, async (req, res) => {
  try {
    const problem = String(req.body?.problem || "").trim();

    if (!problem) {
      return res.status(400).json({
        success: false,
        message: "problem is required",
      });
    }

    if (problem.length > 1500) {
      return res.status(400).json({
        success: false,
        message: "problem is too long",
      });
    }

    const data = await callAnthropic({
      system: diagnosisSystemPrompt,
      messages: [
        {
          role: "user",
          content: `وصف العطل: ${problem}`,
        },
      ],
      maxTokens: 1000,
    });

    const text = extractText(data);
    const clean = text.replace(/```json|```/g, "").trim();

    let diagnosis;
    try {
      diagnosis = JSON.parse(clean);
    } catch {
      return res.status(502).json({
        success: false,
        message: "AI returned invalid JSON",
        raw: text,
      });
    }

    res.json({
      success: true,
      diagnosis,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "AI diagnose failed",
    });
  }
});

router.post("/chat", requireAnthropicKey, async (req, res) => {
  try {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    const messages = history
      .filter((m) => ["user", "assistant"].includes(m?.role))
      .map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 1200),
      }))
      .slice(-12);

    if (messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "history is required",
      });
    }

    const data = await callAnthropic({
      system: chatSystemPrompt,
      messages,
      maxTokens: 700,
    });

    res.json({
      success: true,
      reply: extractText(data),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "AI chat failed",
    });
  }
});

router.post("/photo-diagnosis", upload.single("image"), photoDiagnosis);

export default router;