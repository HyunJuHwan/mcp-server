import { MCPServer } from "mcp-framework";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredDirs = [
  "tools/character",
  "tools/scene",
  "tools/video",
  "tools/webtoon",
];

async function ensureDirectoriesExist() {
  for (const dir of requiredDirs) {
    const fullPath = path.resolve(__dirname, dir);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      console.error(`[✔] 폴더 확인됨: ${fullPath}`);
    } catch (e) {
      console.error(`[x] 폴더 생성 실패: ${fullPath}`, e);
    }
  }
}

async function startServer() {
  await ensureDirectoriesExist();

  const mode = process.env.MODE || "dev";

  const server = new MCPServer({
    transport: mode === "prod"
      ? {
          type: "http-stream",
          options: {
            port: 1337,
            cors: {
              allowOrigin: "*"
            }
          }
        }
      : { type: "stdio" },
  });

  console.error(`🚀 MCP Server started in [${mode}] mode`);
  server.start();
}

startServer();
