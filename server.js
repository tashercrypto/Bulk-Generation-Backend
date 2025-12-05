import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
  origin: [
    "https://tashercrypto.github.io",
    "http://localhost:5500",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend running" });
});

// ФУНКЦІЯ: Аналіз лого через GPT-4 Vision
async function analyzeLogo(logoBuffer, mimeType, apiKey) {
  try {
    const logoBase64 = logoBuffer.toString("base64");
    const logoDataUrl = `data:${mimeType};base64,${logoBase64}`;

    console.log("🔍 Analyzing logo with Vision...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this logo in EXTREME detail. Include: exact number of points/rays, their shape (sharp/rounded), angles between rays, proportions, colors (exact shades), line thickness, style. Be mathematical and precise.",
              },
              {
                type: "image_url",
                image_url: { url: logoDataUrl, detail: "high" },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn("⚠️ Logo analysis failed:", error);
      return "bright white 8-pointed star with evenly spaced sharp rays";
    }

    const data = await response.json();
    const description = data.choices[0].message.content;
    console.log("✅ Logo analyzed:", description.substring(0, 150) + "...");
    return description;

  } catch (error) {
    console.error("❌ Logo analysis error:", error);
    return "bright white 8-pointed star with evenly spaced sharp rays";
  }
}

// ГОЛОВНИЙ ENDPOINT
app.post("/generate-image", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("=== IMAGE EDIT REQUEST ===");

    const imageFile = req.files?.image?.[0];
    const logoFile = req.files?.logo?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: { message: "No image uploaded" } });
    }

    console.log("📸 Image:", imageFile.originalname, `(${imageFile.size} bytes)`);
    console.log("🏷️ Logo:", logoFile ? `${logoFile.originalname} (${logoFile.size} bytes)` : "NO LOGO");

    // КРОК 1: Аналізуємо лого (якщо є)
    let logoDescription = "bright white 8-pointed star with evenly spaced sharp rays";
    
    if (logoFile) {
      logoDescription = await analyzeLogo(
        logoFile.buffer,
        logoFile.mimetype,
        process.env.API_KEY
      );
    }

    // КРОК 2: Короткий промпт
    const prompt = `Add a solid black baseball cap with this logo: ${logoDescription.substring(0, 200)}. Keep everything else unchanged.`;
    
    console.log("✅ Prompt:", prompt);

    // КРОК 3: Конвертація в PNG з RGBA (КРИТИЧНО!)
    console.log("🔄 Converting image to PNG with RGBA...");

    let pngBuffer;
    
    try {
      // Спочатку читаємо метадані
      const metadata = await sharp(imageFile.buffer).metadata();
      console.log("📊 Input format:", metadata.format, "channels:", metadata.channels);

      // Конвертуємо з ПРИМУСОВИМ додаванням альфа-каналу
      pngBuffer = await sharp(imageFile.buffer)
        .resize(1024, 1024, {
          fit: "cover",
          position: "center",
        })
        .toFormat("png") // Конвертуємо в PNG
        .ensureAlpha() // Додаємо альфа-канал (RGBA)
        .png({
          quality: 100,
          compressionLevel: 6,
          force: true, // Форсуємо PNG
        })
        .toBuffer();

      // Перевіряємо результат
      const outputMetadata = await sharp(pngBuffer).metadata();
      console.log("✅ Output format:", outputMetadata.format, "channels:", outputMetadata.channels);

      if (outputMetadata.channels < 4) {
        console.warn("⚠️ Not RGBA, forcing alpha channel...");
        
        // Якщо все ще не RGBA - додаємо вручну
        pngBuffer = await sharp(pngBuffer)
          .ensureAlpha()
          .png({ force: true })
          .toBuffer();
        
        const finalMetadata = await sharp(pngBuffer).metadata();
        console.log("✅ Final format:", finalMetadata.format, "channels:", finalMetadata.channels);
      }

    } catch (sharpError) {
      console.error("❌ Sharp conversion error:", sharpError);
      return res.status(400).json({
        error: { message: `Image conversion failed: ${sharpError.message}` }
      });
    }

    console.log("✅ PNG created:", pngBuffer.length, "bytes");

    // Перевірка розміру (OpenAI ліміт: 4MB)
    if (pngBuffer.length > 4 * 1024 * 1024) {
      console.warn("⚠️ Image too large, compressing...");
      pngBuffer = await sharp(pngBuffer)
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
      console.log("✅ Compressed to:", pngBuffer.length, "bytes");
    }

    // КРОК 4: Формуємо FormData для OpenAI
    const { default: FormDataNode } = await import("form-data");
    const formData = new FormDataNode();

    formData.append("image", pngBuffer, {
      filename: "image.png",
      contentType: "image/png",
    });

    formData.append("prompt", prompt);
    formData.append("n", 1);
    formData.append("size", "1024x1024");

    console.log("📤 Sending to OpenAI /images/edits...");

    // КРОК 5: Запит до OpenAI
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
    console.log("📥 OpenAI status:", openaiResponse.status);

    if (!openaiResponse.ok) {
      console.error("❌ OpenAI error:", JSON.stringify(responseData, null, 2));
      return res.status(openaiResponse.status).json({
        error: responseData.error || { message: "OpenAI API error" },
      });
    }

    // КРОК 6: Отримуємо URL
    if (!responseData.data || !responseData.data[0] || !responseData.data[0].url) {
      console.error("❌ Invalid response:", responseData);
      return res.status(500).json({
        error: { message: "Invalid OpenAI response format" },
      });
    }

    const imageUrl = responseData.data[0].url;
    console.log("✅ Image URL received");

    // КРОК 7: Завантажуємо результат
    console.log("📥 Downloading result...");
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("Failed to download result image");
    }

    const imageBuffer = await imageResponse.buffer();
    const base64Image = imageBuffer.toString("base64");

    console.log("✅ SUCCESS! Base64 size:", base64Image.length);

    res.json({
      data: [{ b64_json: base64Image }],
    });

  } catch (err) {
    console.error("=== CRITICAL ERROR ===");
    console.error("Type:", err.constructor.name);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    res.status(500).json({
      error: {
        message: err.message || "Internal server error",
      },
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key present: ${!!process.env.API_KEY}`);
});
