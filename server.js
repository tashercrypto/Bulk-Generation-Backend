import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer();

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
  res.json({ status: "ok" });
});

// ГЕНЕРАЦІЯ ЗОБРАЖЕННЯ (без редагування)
app.post("/generate-image", upload.single("image"), async (req, res) => {
  try {
    console.log("=== GENERATION REQUEST ===");
    
    const prompt = req.body.prompt || "A cute purple octopus character with large eyes and a smile, wearing a black baseball cap with a white 8-pointed star logo on the front. The octopus has 8 tentacles and is set against a space background with Earth visible. The style is 3D rendered, cute and cartoon-like with soft lighting.";

    console.log("Prompt:", prompt);
    console.log("Sending to DALL-E 2...");

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-2", // DALL-E 2 дешевший і швидший
          prompt: prompt,
          n: 1,
          size: "1024x1024",
        }),
      }
    );

    const data = await response.json();

    console.log("Response status:", response.status);

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(response.status).json({ error: data.error });
    }

    const imageUrl = data.data[0].url;
    console.log("✅ Image URL:", imageUrl);

    // Завантажуємо і конвертуємо в base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.buffer();
    const base64 = imageBuffer.toString("base64");

    console.log("✅ Sending base64 to frontend");

    res.json({
      data: [{ b64_json: base64 }],
    });
  } catch (err) {
    console.error("=== ERROR ===");
    console.error(err);
    res.status(500).json({
      error: { message: err.message },
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
