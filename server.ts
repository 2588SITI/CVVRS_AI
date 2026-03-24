import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '100mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Content-Length: ${req.headers['content-length']}`);
    next();
  });

  // API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API: Analyze CVVRS Footage
  app.post("/api/analyze", async (req, res) => {
    try {
      const { frames, prompt, userApiKey } = req.body;
      console.log(`[${new Date().toISOString()}] Analyzing ${frames?.length || 0} frames...`);
      
      // Use provided key or fallback to server-side key
      const adminPassword = process.env.ADMIN_PASSWORD;
      let apiKey = userApiKey;

      if (adminPassword && userApiKey === adminPassword) {
        apiKey = process.env.GEMINI_API_KEY;
      }

      if (!apiKey) {
        console.warn(`[${new Date().toISOString()}] API Key missing in request`);
        return res.status(401).json({ error: "API Key or Admin Password required" });
      }

      const genAI = new GoogleGenAI({ apiKey });
      
      const contents = [
        {
          role: "user",
          parts: [
            ...frames.map((frame: any) => ({
              inlineData: {
                data: frame.data,
                mimeType: frame.mimeType
              }
            })),
            { text: prompt }
          ]
        }
      ];

      const result = await genAI.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents 
      });
      const responseText = result.text;

      console.log(`[${new Date().toISOString()}] Analysis successful`);
      res.json({ text: responseText });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Gemini API Error:`, error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(`[${new Date().toISOString()}] Global Error Handler:`, err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
