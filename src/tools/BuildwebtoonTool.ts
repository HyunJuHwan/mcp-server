import { MCPTool } from "mcp-framework";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import ScenesResource from "../resources/ScenesResource.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const saveScene = new ScenesResource();

function makeSpeechSVG(text: string, width: number = 200): Buffer {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + word + " ";
    if (testLine.length > 15) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  const lineHeight = 28;
  const svgHeight = lineHeight * lines.length + 40;

  const textSvg = lines.map((line, i) => {
    const y = 40 + i * lineHeight;
    return `<text x="50%" y="${y}" dominant-baseline="middle" text-anchor="middle"
      font-size="24" font-family="Arial" fill="black">${line}</text>`;
  }).join("\n");

  const svg = `
    <svg width="${width}" height="${svgHeight}">
      <rect x="0" y="0" width="${width}" height="${svgHeight}" rx="16" ry="16" fill="white" stroke="black" stroke-width="2"/>
      ${textSvg}
    </svg>
  `;
  return Buffer.from(svg);
}

interface BuildwebtoonInput {
  scene_ids: string[];
  speech_bubbles?: Array<{ scene_id: string; text: string }> | string;
}

class BuildwebtoonTool extends MCPTool<BuildwebtoonInput> {
  name = "buildWebtoon";
  description = "Combine scenes vertically with alternating 30%-width speech bubbles and wrapped text.";

  schema = {
    scene_ids: {
      type: z.array(z.string()),
      description: "List of scene image IDs"
    },
    speech_bubbles: {
      type: z.any().optional(),
      description: "Speech bubbles as array or JSON string"
    }
  };

  async execute({ scene_ids, speech_bubbles = [] }: BuildwebtoonInput) {
    const gap = 50;
    const images: Buffer[] = [];
    const metadata: { width: number; height: number }[] = [];

    let parsedBubbles: Array<{ scene_id: string; text: string }> = [];

    if (typeof speech_bubbles === "string") {
      try {
        // 백슬래시 제거 → \" → "
        const cleaned = speech_bubbles.replaceAll(/\\"/g, '"');

        // 혹시 전체 문자열이 따옴표로 한번 감싸진 경우 → 제거
        const trimmed = cleaned.trim();
        const unwrapped = trimmed.startsWith('"') && trimmed.endsWith('"')
          ? trimmed.slice(1, -1)
          : trimmed;

        parsedBubbles = JSON.parse(unwrapped);
      } catch (e: any) {
        throw new Error("speech_bubbles 문자열을 JSON으로 변환할 수 없습니다: " + e.message);
      }
    } else if (Array.isArray(speech_bubbles)) {
      parsedBubbles = speech_bubbles;
    }

    const speechMap = new Map<string, string[]>();
    for (const { scene_id, text } of parsedBubbles) {
      if (!speechMap.has(scene_id)) speechMap.set(scene_id, []);
      speechMap.get(scene_id)!.push(text);
    }

    for (const id of scene_ids) {
      const filePath = path.resolve(__dirname, 'scene', `${id}.png`);
      let image = await fs.readFile(filePath);
      const { width = 0, height = 0 } = await sharp(image).metadata();

      const texts = speechMap.get(id) || [];
      let yOffset = 20;

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const bubbleWidth = Math.floor(width * 0.3); // ⬅️ 30% 크기
        const svg = makeSpeechSVG(text, bubbleWidth);

        const isLeft = i % 2 === 0;
        const xOffset = isLeft ? 20 : (width - bubbleWidth - 20);

        image = await sharp(image)
          .composite([{ input: svg, top: yOffset, left: xOffset }])
          .toBuffer();

        yOffset += 120;
      }

      images.push(image);
      metadata.push({ width, height });
    }

    const maxWidth = Math.max(...metadata.map(m => m.width));
    const totalHeight = metadata.reduce((sum, m) => sum + m.height, 0) + gap * (scene_ids.length - 1);
    const compositeImages = [];

    let currentY = 0;
    for (let i = 0; i < images.length; i++) {
      compositeImages.push({ input: images[i], top: currentY, left: 0 });
      currentY += metadata[i].height + (i < images.length - 1 ? gap : 0);
    }

    const webtoonId = `webtoon-${Date.now()}`;
    const outputPath = path.resolve(__dirname, 'webtoon',`${webtoonId}.png`);

    await sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).composite(compositeImages).png().toFile(outputPath);

    const result = {
      webtoon_id: webtoonId,
      webtoon_url: outputPath,
      scene_ids,
      metadata: {
        width: maxWidth,
        height: totalHeight,
        gap,
        speech_bubble_count: parsedBubbles.length
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

export default BuildwebtoonTool;