import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const upload = multer();

app.post("/edit-image", upload.array("images"), async (req, res) => {
  try {
    const files = req.files;
    const prompt = req.body.prompt;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("image[]", new Blob([file.buffer]), file.originalname);
    });

    formData.append("prompt", prompt);
    formData.append("model", "gpt-image-1");
    formData.append("size", "1024x1024");
    formData.append("n", 1);

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Backend запущено на порту 3000"));
