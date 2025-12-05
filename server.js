import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
  origin: ["https://tashercrypto.github.io", "http://localhost:5500"],
  methods: ["GET", "POST", "OPTIONS"],
}));

app.get("/", (req, res) => res.json({ status: "ok" }));

// ENDPOINT з двома зображеннями
app.post("/generate-image", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("=== TWO-IMAGE REQUEST ===");

    const imageFile = req.files?.image?.[0];
    const logoFile = req.files?.logo?.[0];
    
    if (!imageFile) {
      return res.status(400).json({ error: { message: "No image" } });
    }

    console.log("Image:", imageFile.originalname);
    console.log("Logo:", logoFile ? logoFile.originalname : "NO LOGO");

    // Конвертуємо обидва в base64
    const imageBase64 = imageFile.buffer.toString("base64");
    const imageDataUrl = `data:${imageFile.mimetype};base64,${imageBase64}`;

    let logoDataUrl = null;
    let logoDescription = "";

    if (logoFile) {
      const logoBase64 = logoFile.buffer.toString("base64");
      logoDataUrl = `data:${logoFile.mimetype};base64,${logoBase64}`;

      // КРОК 1: Аналізуємо ЛОГО
      console.log("🔍 Analyzing logo...");

      const logoAnalysis = await fetch(
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
                    text: "Describe this logo in EXTREME detail for exact recreation. Include: exact shape, number of points/rays, angles, proportions, colors, style, thickness of lines. Be mathematical and precise.",
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
        }
      );

      const logoData = await logoAnalysis.json();
      
      if (logoAnalysis.ok) {
        logoDescription = logoData.choices[0].message.content;
        console.log("✅ Logo analyzed:", logoDescription.substring(0, 200));
      } else {
        console.warn("⚠️ Logo analysis failed, using default");
        logoDescription = "white 8-pointed star with evenly spaced sharp rays";
      }
    } else {
      logoDescription = "white 8-pointed star with evenly spaced sharp rays";
    }

    // КРОК 2: Аналізуємо ОСНОВНЕ ЗОБРАЖЕННЯ
    console.log("🔍 Analyzing main image...");

    const imageAnalysis = await fetch(
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
                  text: "Describe this image in extreme detail for DALL-E 3 recreation: character appearance, pose, background, lighting, colors, style, textures. Be very specific.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageDataUrl, detail: "high" },
                },
              ],
            },
          ],
          max_tokens: 1000,
        }),
      }
    );

    const imageData = await imageAnalysis.json();

    if (!imageAnalysis.ok) {
      console.error("❌ Image analysis failed:", imageData);
      return res.status(imageAnalysis.status).json({ error: imageData.error });
    }

    const imageDescription = imageData.choices[0].message.content;
    console.log("✅ Image analyzed");

    // КРОК 3: ГЕНЕРАЦІЯ з обома описами
    console.log("🎨 Generating with DALL-E 3...");

    const dallePrompt = `${imageDescription}

CRITICAL MODIFICATION - Add a cap:
Add a classic solid black baseball cap on the character's head. The cap must have this EXACT logo on the front panel:

${logoDescription}

The logo must be:
- EXACTLY as described above - precise shape, proportions, angles
- Centered perfectly on the front of the cap
- Bright and crisp with high contrast against the black cap
- The star/logo should be the EXACT shape specified

The cap should:
- Be solid black with no holes or stitching visible
- Fit naturally on the character's head
- Have realistic shadows and perspective
- Be slightly rotated to the left (brim turned left)
- Be fully visible, not cropped

IMPORTANT: Keep EVERYTHING else EXACTLY as described - same character, same background, same lighting, same colors, same pose, same style. ONLY add the cap with logo.`;

    console.log("Prompt length:", dallePrompt.length);

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
          quality: "hd", // Висока якість для точності
        }),
      }
    );

    const dalleData = await dalleResponse.json();

    if (!dalleResponse.ok) {
      console.error("❌ DALL-E error:", dalleData);
      return res.status(dalleResponse.status).json({ error: dalleData.error });
    }

    const imageUrl = dalleData.data[0].url;
    console.log("✅ Image generated");

    // Завантажуємо та конвертуємо
    const imgResp = await fetch(imageUrl);
    const imgBuffer = await imgResp.buffer();
    const base64 = imgBuffer.toString("base64");

    console.log("✅ SUCCESS");

    res.json({ data: [{ b64_json: base64 }] });
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
