// PATH: backend/controllers/aiController.js
import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeMime(mime) {
  const ok = new Set(["image/jpeg", "image/png", "image/webp"]);
  return ok.has(mime) ? mime : "image/jpeg";
}

export async function photoDiagnosis(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OPENAI_API_KEY is missing in environment",
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded. Field name must be: image",
      });
    }

    const mime = safeMime(req.file.mimetype);
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;

    const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "أنت مساعد ميكانيكي سيارات خبير. حلّل الصورة وحدد المشكلة المحتملة بدقة مع:\n" +
                "1) تشخيص محتمل\n2) أسباب محتملة\n3) خطوات فحص بسيطة للمستخدم\n4) هل القيادة آمنة أم لا؟\n" +
                "5) تقدير تكلفة تقريبي (منخفض/متوسط/مرتفع)\n" +
                "اكتب بالعربية المصرية وباختصار منظم.\n" +
                "تنبيه: هذا تقدير وليس بديل لفحص فني.",
            },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
      max_output_tokens: 700,
    });

    return res.json({
      success: true,
      model,
      diagnosis: response.output_text || "",
    });
  } catch (e) {
    console.error("❌ photoDiagnosis:", e?.message || e);
    return res.status(500).json({
      success: false,
      message: e?.message || "AI error",
    });
  }
}