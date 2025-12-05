import express from "express";
import cors from "cors";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer();

app.use(
  cors({
    origin: [
      "https://tashercrypto.github.io",
      "https://tashercrypto.github.io/Bulk-Generation",
      "https://tashercrypto.github.io/Bulk-Generation/",
      "http://localhost:5500",
      "http://localhost:3000",
    ],
    methods: "GET,POST",
  })
);

app.post("/edit-image", upload.any(), async (req, res) => {
  console.log("===== NEW REQUEST =====");

  try {
    const prompt = req.body.prompt;

    const userImage = req.files.find(f => f.fieldname === "image");
    const maskFile = req.files.find(f => f.fieldname === "mask");

    console.log("User image:", !!userImage);
    console.log("Mask:", !!maskFile);
    console.log("Prompt:", prompt);

    if (!userImage) {
      return res.status(400).json({ error: "Main image is required" });
    }

    const formData = new FormData();

    // main image
    formData.append("image", userImage.buffer, {
      filename: userImage.originalname,
      contentType: userImage.mimetype,
    });

    // mask (optional)
    if (maskFile) {
      formData.append("mask", maskFile.buffer, {
        filename: maskFile.originalname,
        contentType: maskFile.mimetype,
      });
    }

    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-1");
    formData.append("size", "1024x1024");
    formData.append("n", "1");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const raw = await response.text();
    console.log("OpenAI raw response:", raw);

    return res.send(raw);

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Backend запущено на порту", PORT);
});
