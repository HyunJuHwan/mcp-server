import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import util from "util";
import { v4 as uuidv4 } from "uuid";

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BuildvideoInput {
  frame_folder: string;
}

class BuildVideoTool extends MCPTool<BuildvideoInput> {
  name = "buildVideo";
  description = "Create an .mp4 video with 2 seconds per scene image using ffmpeg concat mode.";

  schema = {
    frame_folder: {
      type: z.string(),
      description: "Folder containing PNG scene images (e.g. scene-*.png)"
    }
  };

  async execute({ frame_folder }: BuildvideoInput) {
    const folderPath = path.isAbsolute(frame_folder)
      ? frame_folder
      : path.resolve(__dirname, frame_folder);

    const sceneFiles = (await fs.readdir(folderPath))
      .filter(f => f.endsWith(".png"))
      .sort(); // 정렬 중요

    if (sceneFiles.length === 0) {
      throw new Error("No PNG images found in the folder.");
    }

    // Step 1: Generate file list with durations
    const listPath = path.join(__dirname, `filelist-${Date.now()}.txt`);
    let fileListContent = sceneFiles
      .map(f => `file '${path.join(folderPath, f).replace(/\\/g, "/")}'\nduration 2`)
      .join("\n");

    // 마지막 컷은 duration 없이 한 번 더 삽입해야 정상 종료됨
    const lastScene = sceneFiles[sceneFiles.length - 1];
    fileListContent += `\nfile '${path.join(folderPath, lastScene).replace(/\\/g, "/")}'`;

    await fs.writeFile(listPath, fileListContent);

    // Step 2: ffmpeg 명령어 실행
    const outputName = `video-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, "video", outputName);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -vsync vfr -pix_fmt yuv420p "${outputPath}"`;
    try {
      const { stderr } = await execAsync(command);
      if (stderr) console.warn("[ffmpeg warning]", stderr);
    } catch (err: any) {
      throw new Error(`ffmpeg execution failed: ${err.message}`);
    }

    // Step 3: Clean up and return result
    await fs.unlink(listPath);

    return {
      video_url: outputPath,
      frame_count: sceneFiles.length,
      duration_per_frame: 2,
      total_duration: sceneFiles.length * 2,
      format: "mp4"
    };
  }
}

export default BuildVideoTool;
