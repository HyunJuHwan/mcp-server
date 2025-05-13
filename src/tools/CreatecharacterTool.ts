import { MCPTool } from "mcp-framework";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

import CharacterResource from "../resources/CharacterResource.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saveCharacter = new CharacterResource();

interface CreatecharacterInput {
  prompt: string;
  style: string;
}

class CreatecharacterTool extends MCPTool<CreatecharacterInput> {
  name = "createCharacter";
  description = "Create a character image via ComfyUI WebSocket";

  schema = {
    prompt: {
      type: z.string(),
      description: "Prompt text"
    },
    style: {
      type: z.enum(['2d', '3d']),
      description: "Style of the character"
    }
  };

  async execute({ prompt, style }: CreatecharacterInput) {
    const characterId = `c-${Date.now()}`;
    const client_id = uuidv4();

    const promptGraph = {
      "2": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "toonyou_beta6.safetensors" }
      },
      "4": {
        class_type: "EmptyLatentImage",
        inputs: {
          width: 512,
          height: 512,
          batch_size: 1,
          seed: Math.floor(Math.random() * 100000)
        }
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: {
          text: prompt,
          clip: ["2", 1]
        }
      },
      "7": {
        class_type: "CLIPTextEncode",
        inputs: {
          text: "bad quality, blurry, low resolution",
          clip: ["2", 1]
        }
      },
      "8": {
        class_type: "KSampler",
        inputs: {
          model: ["2", 0],
          latent_image: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          seed: 305522570661793,
          steps: 20,
          cfg: 8,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1
        }
      },
      "9": {
        class_type: "VAEDecode",
        inputs: {
          samples: ["8", 0],
          vae: ["2", 2]
        }
      },
      "12": {
        class_type: "SaveImageWebsocket",
        inputs: {
          images: ["9", 0]
        }
      }
    };

    const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${client_id}`);

    const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
      let prompt_id = "";
      let gotImage = false;

      ws.on("open", async () => {
        try {
          const res = await fetch("http://127.0.0.1:8188/prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptGraph, client_id })
          });
          const resJson = await res.json();
          prompt_id = resJson.prompt_id;
        } catch (err) {
          ws.close();
          return reject(err);
        }
      });

      ws.on("message", (msg: Buffer) => {
        if (msg.slice(0, 1).toString() === '{') {
          const data = JSON.parse(msg.toString());
          if (data.type === 'executing' && data.data.prompt_id === prompt_id) {
            console.error("[DEBUG] Prompt executing:", data.data.node);
          }
          return;
        }

        // 이미지 수신 시 처리
        const pureImage = msg.slice(8); // 헤더 제외
        gotImage = true;
        ws.close();
        resolve(pureImage);
      });

      ws.on("error", (err) => {
        ws.close();
        reject(err);
      });

      ws.on("close", () => {
        if (!gotImage) {
          reject(new Error("WebSocket closed before receiving image"));
        }
      });
    });

    const filePath = path.resolve(__dirname, 'character',`${characterId}.png`);
    await fs.writeFile(filePath, imageBuffer);

    const result = {
      character_id: characterId,
      image_url: filePath,
      metadata: { style, prompt }
    };

    await saveCharacter.save({
      mimeType: "application/json",
      text: JSON.stringify(result),
      uri: saveCharacter.uri
    });

    return result;
  }
}

export default CreatecharacterTool;
