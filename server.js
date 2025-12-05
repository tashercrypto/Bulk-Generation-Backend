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

app.post("/generate-image", upload.any(), async (req, res) => {
  try {
    const prompt = req.body.prompt;

    console.log("PROMPT:", prompt);
    console.log("FILES:", req.files);

    const response = await fetch(
      "https://api.openai.com/v1/images/edits", // <= якщо з файлами !!
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: (() => {
          const fd = new FormData();
          fd.append("prompt", prompt);
          fd.append("images", req.files.find(f => f.fieldname === "image").buffer, "image.png");
          fd.append("logo", req.files.find(f => f.fieldname === "logo").buffer, "logo.jpg");
          return fd;
        })(),
      }
    );

    const raw = await response.text();
    console.log("OpenAI Response:", raw);

    res.send(raw);
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: { message: err.message } });
  }
});


app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Backend запущено на порту", PORT);
});
