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

interface UpdatecharacterInput {
  old_character_id: string;
  prompt: string;
  style: string;
}

class UpdatecharacterTool extends MCPTool<UpdatecharacterInput> {
  name = "updateCharacter";
  description = "Update character image using existing one and new prompt";

  schema = {
    old_character_id: {
      type: z.string(),
      description: "Previous character ID"
    },
    prompt: {
      type: z.string(),
      description: "New prompt to apply"
    },
    style: {
      type: z.enum(['2d', '3d']),
      description: "Character style"
    }
  };

  async execute({ old_character_id, prompt, style }: UpdatecharacterInput) {
    const characterId = `c-${Date.now()}`;
    const client_id = uuidv4();

    const oldFilePath = path.resolve(__dirname, 'character',`${old_character_id}.png`);
    const imageBuffer = await fs.readFile(oldFilePath);
    const image_b64 = imageBuffer.toString("base64");

    const promptGraph = {
      "0": {
        class_type: "LoadImageFromBase64",
        inputs: {
          data: image_b64
        }
      },
      "1": {
        class_type: "VAEEncode",
        inputs: {
          pixels: ["0", 0],
          vae: ["2", 2]
        }
      },
      "2": {
        class_type: "CheckpointLoaderSimple",
        inputs: {
          ckpt_name: "toonyou_beta6.safetensors"
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
          latent_image: ["1", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          seed: Math.floor(Math.random() * 100000),
          steps: 20,
          cfg: 8,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 0.65
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

    const imageBufferNew = await new Promise<Buffer>((resolve, reject) => {
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
        if (msg.slice(0, 1).toString() === '{') return;
        const pureImage = msg.slice(8);
        gotImage = true;
        ws.close();
        resolve(pureImage);
      });

      ws.on("error", (err) => {
        ws.close();
        reject(err);
      });

      ws.on("close", () => {
        if (!gotImage) reject(new Error("WebSocket closed before receiving image"));
      });
    });

    const newFilePath = path.resolve(__dirname, 'character',`${characterId}.png`);
    await fs.writeFile(newFilePath, imageBufferNew);
    await fs.unlink(oldFilePath);

    const result = {
      newCharacter: {
        character_id: characterId,
        image_url: newFilePath,
        metadata: { style, prompt }
      },
      old_character_id
    };

    await saveCharacter.save({
      mimeType: "application/json",
      text: JSON.stringify(result),
      uri: saveCharacter.uri
    });

    return result;
  }
}

export default UpdatecharacterTool;
