import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === "production";

  console.log(`Environment: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`Is Production: ${isProduction}`);
  console.log(`Dist Path exists: ${fs.existsSync(distPath)}`);



  if (isProduction) {
    // Production: Serve static files from dist/
    console.log('Serving from production build (dist/)...');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Development: Use Vite middleware
    console.log('Starting Vite in middleware mode...');
    try {
      const vite = await createViteServer({
        root: process.cwd(),
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('Vite middleware attached.');
    } catch (err) {
      console.error('Failed to start Vite:', err);
      // Fallback to dist if Vite fails and it exists
      if (fs.existsSync(distPath)) {
        console.log('Falling back to dist/ after Vite failure...');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        app.get('*all', (req, res) => {
          res.status(500).send('Server initialization failed and no production build found.');
        });
      }
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
