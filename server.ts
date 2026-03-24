import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AWS DynamoDB Configuration
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  const ddbDocClient = DynamoDBDocumentClient.from(client);
  const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "CVVRS_Corrections";

  // API: Save a new correction
  app.post("/api/corrections", async (req, res) => {
    try {
      const { correction, context, timestamp, userEmail } = req.body;
      
      if (!process.env.AWS_ACCESS_KEY_ID) {
        return res.status(500).json({ error: "AWS Credentials not configured" });
      }

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          id: Date.now().toString(),
          correction,
          context,
          timestamp: timestamp || new Date().toISOString(),
          userEmail: userEmail || "anonymous",
        },
      });

      await ddbDocClient.send(command);
      res.json({ success: true, message: "Correction saved to AWS DynamoDB" });
    } catch (error) {
      console.error("AWS DynamoDB Error:", error);
      res.status(500).json({ error: "Failed to save to AWS" });
    }
  });

  // API: Get all corrections for AI learning
  app.get("/api/corrections", async (req, res) => {
    try {
      if (!process.env.AWS_ACCESS_KEY_ID) {
        return res.json([]); // Return empty if not configured
      }

      const command = new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 50, // Get last 50 corrections for context
      });

      const response = await ddbDocClient.send(command);
      res.json(response.Items || []);
    } catch (error) {
      console.error("AWS DynamoDB Fetch Error:", error);
      res.json([]); // Fail gracefully
    }
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
