import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CORS
app.use(
  cors({
    origin: [
      "https://tashercrypto.github.io",
      "http://localhost:5500",
      "http://localhost:3000",
      "http://127.0.0.1:5500",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// Головний endpoint
app.post(
  "/generate-image",
  upload.single("image"), // ❗ ТІЛЬКИ ОДИН ФАЙЛ
  async (req, res) => {
    try {
      console.log("=== NEW REQUEST ===");
      console.log("File received:", !!req.file);
      console.log("Prompt length:", req.body.prompt?.length);

      // Перевірки
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      if (!req.body.prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Обрізаємо промпт до 1000 символів
      const prompt = req.body.prompt.slice(0, 1000);

      console.log("Converting image to PNG with alpha...");

      // Конвертуємо зображення в PNG з прозорістю (обов'язково для OpenAI)
      const pngBuffer = await sharp(req.file.buffer)
        .resize(1024, 1024, { fit: "cover" }) // Обрізаємо до 1024x1024
        .ensureAlpha() // Додаємо альфа-канал
        .png()
        .toBuffer();

      console.log("PNG size:", pngBuffer.length, "bytes");

      // Створюємо FormData для OpenAI
      const { default: FormDataNode } = await import("form-data");
      const formData = new FormDataNode();

      // ❗ ТІЛЬКИ image, БЕЗ mask (маска не обов'язкова)
      formData.append("image", pngBuffer, {
        filename: "image.png",
        contentType: "image/png",
      });

      formData.append("prompt", prompt);
      formData.append("n", 1);
      formData.append("size", "1024x1024");

      console.log("Sending to OpenAI API...");

      // Запит до OpenAI
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.API_KEY}`,
            ...formData.getHeaders(),
          },
          body: formData,
        }
      );

      const responseData = await openaiResponse.json();

      console.log("OpenAI status:", openaiResponse.status);

      if (!openaiResponse.ok) {
        console.error("OpenAI error:", responseData);
        return res.status(openaiResponse.status).json({
          error: responseData.error || { message: "OpenAI API error" },
        });
      }

      // Перевіряємо відповідь
      if (!responseData.data || !responseData.data[0]) {
        return res.status(500).json({
          error: { message: "Invalid response from OpenAI" },
        });
      }

      // Отримуємо URL зображення
      const imageUrl = responseData.data[0].url;
      console.log("Image URL received:", imageUrl);

      // Завантажуємо зображення та конвертуємо в base64
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      const base64Image = imageBuffer.toString("base64");

      console.log("Sending base64 image to frontend");

      // Відправляємо у форматі, який очікує фронтенд
      res.json({
        data: [
          {
            b64_json: base64Image,
          },
        ],
      });
    } catch (err) {
      console.error("=== SERVER ERROR ===");
      console.error(err);
      res.status(500).json({
        error: { message: err.message || "Internal server error" },
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
