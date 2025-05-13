import { MCPTool } from "mcp-framework";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

import ScenesResource from "../resources/ScenesResource.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saveScene = new ScenesResource();

function fixBase64Padding(b64: string): string {
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

interface CreatesceneInput {
  character_ids: string[];
  scene_description: string;
}

class CreatesceneTool extends MCPTool<CreatesceneInput> {
  name = "createScene";
  description = "Create a scene image using multiple character images and a prompt.";

  schema = {
    character_ids: {
      type: z.array(z.string()),
      description: "List of character IDs (e.g., [\"char_001\", \"char_002\"])"
    },
    scene_description: {
      type: z.string(),
      description: "Description of the scene to generate with these characters"
    }
  };

  async execute({ character_ids, scene_description }: CreatesceneInput) {
    const sceneId = `scene-${Date.now()}`;
    const client_id = uuidv4();

    // Step 1: Load and encode all character images as base64
    const base64Images: string[] = [];
    for (const id of character_ids) {
      const filePath = path.resolve(__dirname, 'character',`${id}.png`);
      const buffer = await fs.readFile(filePath);
      base64Images.push(fixBase64Padding(buffer.toString("base64")));
    }

    // Step 2: Build prompt graph
    const promptGraph: Record<string, any> = {};
    const latentNodeIds: string[] = [];

    character_ids.forEach((_, index) => {
      const loadId = `${21 + index}`;
      const encodeId = `${100 + index}`;

      promptGraph[loadId] = {
        class_type: "LoadImageFromBase64",
        inputs: { data: base64Images[index] }
      };

      promptGraph[encodeId] = {
        class_type: "VAEEncode",
        inputs: { pixels: [loadId, 0], vae: ["14", 2] }
      };

      latentNodeIds.push(encodeId);
    });

    let lastBlendId = latentNodeIds[0];

    for (let i = 1; i < latentNodeIds.length; i++) {
      const blendId = `${1000 + i}`;
      promptGraph[blendId] = {
        class_type: "LatentBlend",
        inputs: {
          samples1: [lastBlendId, 0],
          samples2: [latentNodeIds[i], 0],
          blend_factor: 0.5
        }
      };
      lastBlendId = blendId;
    }

    // Common setup
    promptGraph["14"] = {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "toonyou_beta6.safetensors" }
    };

    promptGraph["6"] = {
      class_type: "CLIPTextEncode",
      inputs: {
        text: scene_description,
        clip: ["14", 1]
      }
    };

    promptGraph["7"] = {
      class_type: "CLIPTextEncode",
      inputs: {
        text: "bad quality, blurry, low resolution",
        clip: ["14", 1]
      }
    };

    promptGraph["3"] = {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 100000),
        steps: 20,
        cfg: 8,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 0.8,
        model: ["14", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: [lastBlendId, 0]
      }
    };

    promptGraph["8"] = {
      class_type: "VAEDecode",
      inputs: {
        samples: ["3", 0],
        vae: ["14", 2]
      }
    };

    promptGraph["15"] = {
      class_type: "SaveImageWebsocket",
      inputs: {
        images: ["8", 0]
      }
    };

    // Step 3: Send to ComfyUI via WebSocket
    const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${client_id}`);
    const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
      let gotImage = false;

      ws.on("open", async () => {
        try {
          const res = await fetch("http://127.0.0.1:8188/prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptGraph, client_id })
          });
          await res.json();
        } catch (err) {
          ws.close();
          return reject(err);
        }
      });

      ws.on("message", (msg: Buffer) => {
        if (msg.slice(0, 1).toString() === "{") return;
        const pureImage = msg.slice(8);
        gotImage = true;
        ws.close();
        resolve(pureImage);
      });

      ws.on("error", err => {
        ws.close();
        reject(err);
      });

      ws.on("close", () => {
        if (!gotImage) reject(new Error("WebSocket closed before receiving image"));
      });
    });

    // Step 4: Save result
    const filePath = path.resolve(__dirname, 'scene',`${sceneId}.png`);
    await fs.writeFile(filePath, imageBuffer);

    const result = {
      scene_id: sceneId,
      image_url: filePath,
      metadata: {
        character_ids,
        scene_description
      }
    };

    await saveScene.write({
      mimeType: "application/json",
      text: JSON.stringify(result),
      uri: saveScene.uri
    });

    return result;
  }
}

export default CreatesceneTool;
