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

app.post("/generate-image", express.json(), async (req, res) => {
  try {
    const { model, prompt, size, n } = req.body;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        n
      })
    });

    const raw = await response.text();
    console.log("OpenAI raw:", raw);

    res.send(raw);
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Backend запущено на порту", PORT);
});
