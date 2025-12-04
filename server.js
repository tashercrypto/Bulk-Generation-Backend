import express from "express";
import cors from "cors";
import multer from "multer";
import FormData from "form-data";  
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer();

app.use(cors({
  origin: [
    "https://tashercrypto.github.io",
    "http://localhost:5500",
    "http://localhost:3000"
  ],
  methods: "GET,POST"
}));


app.post("/edit-image", upload.array("images"), async (req, res) => {
  try {
    const files = req.files;
    const prompt = req.body.prompt;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    // FormData для Node.js
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("image", file.buffer, file.originalname);
    });

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

    const data = await response.json();

    res.json(data);

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Backend запущено на порту 3000");
});
