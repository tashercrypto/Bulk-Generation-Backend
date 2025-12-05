import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(
  cors({
    origin: [
      "https://tashercrypto.github.io",
      "http://localhost:5500",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend running" });
});

// ГОЛОВНИЙ ENDPOINT - АНАЛІЗ + ГЕНЕРАЦІЯ
app.post("/generate-image", upload.single("image"), async (req, res) => {
  try {
    console.log("=== NEW REQUEST ===");

    if (!req.file) {
      return res.status(400).json({ error: { message: "No image uploaded" } });
    }

    // Конвертуємо зображення в base64
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/png";
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log("📸 Image received:", req.file.originalname);
    console.log("📦 Size:", req.file.size, "bytes");

    // КРОК 1: АНАЛІЗ ЗОБРАЖЕННЯ через GPT-4 Vision
    console.log("🔍 Step 1: Analyzing image with GPT-4 Vision...");

    const visionResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image in extreme detail for DALL-E 3 recreation. Describe EVERYTHING:

CHARACTER:
- Exact appearance, colors, features
- Pose, expression, body parts
- Textures, materials, shine/matte
- Size proportions

BACKGROUND:
- What's visible (space, Earth, stars, etc)
- Colors, lighting, atmosphere
- Depth, perspective

STYLE:
- 3D/2D, realistic/cartoon
- Rendering quality, lighting type
- Overall mood and aesthetic

Be extremely specific and detailed. This description will be used to recreate the image exactly.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
        }),
      }
    );

    const visionData = await visionResponse.json();

    if (!visionResponse.ok) {
      console.error("❌ Vision API error:", visionData);
      return res.status(visionResponse.status).json({
        error: visionData.error || { message: "Vision API failed" },
      });
    }

    const imageDescription = visionData.choices[0].message.content;
    console.log("✅ Image analyzed!");
    console.log("📝 Description length:", imageDescription.length);

    console.log("🎨 Step 2: Generating with DALL-E 3...");

    const dallePrompt = `${imageDescription}

CRITICAL MODIFICATION:
Add a classic solid black baseball cap on the character's head. The cap must have these exact specifications:
- Solid black color, no holes, no stitching visible on top
- Smooth, clean, natural shape
- White 8-pointed star logo perfectly centered on the front panel
- The star must be bright white, crisp, with 8 evenly-spaced sharp points
- Cap slightly rotated to the left (brim turned slightly left)
- Cap must fit naturally with realistic shadows and perspective
- Character with cap must be fully visible, cap not cropped

IMPORTANT: Keep EVERYTHING else EXACTLY as described above - same background, same lighting, same colors, same style, same character details. Only add the cap.`;

    console.log("📤 Prompt length:", dallePrompt.length);

    const dalleResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: dallePrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard", // або "hd" для кращої якості
        }),
      }
    );

    const dalleData = await dalleResponse.json();

    if (!dalleResponse.ok) {
      console.error("❌ DALL-E error:", dalleData);
      return res.status(dalleResponse.status).json({
        error: dalleData.error || { message: "DALL-E generation failed" },
      });
    }

    const generatedImageUrl = dalleData.data[0].url;
    const revisedPrompt = dalleData.data[0].revised_prompt;

    console.log("✅ Image generated!");
    console.log("🔗 URL:", generatedImageUrl);
    console.log("📝 Revised prompt:", revisedPrompt?.substring(0, 200) + "...");

    // КРОК 3: ЗАВАНТАЖУЄМО ЗОБРАЖЕННЯ
    console.log("📥 Step 3: Downloading generated image...");

    const imageResponse = await fetch(generatedImageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }

    const imageBuffer = await imageResponse.buffer();
    const base64Result = imageBuffer.toString("base64");

    console.log("✅ SUCCESS! Sending to frontend...");
    console.log("📦 Base64 size:", base64Result.length);

    res.json({
      data: [
        {
          b64_json: base64Result,
          revised_prompt: revisedPrompt, 
        },
      ],
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
