import { MCPTool } from "mcp-framework";
import { z } from "zod";

interface UpdatesceneInput {
  scene_id: string;
  modification: string;
}

class UpdatesceneTool extends MCPTool<UpdatesceneInput> {
  name = "updateScene";
  description = "Updatescene tool description";

  schema = {
    scene_id: {
      type: z.string(),
      description: "scene_id",
    },
    modification: {
      type: z.string(),
      description: "udpate scene",
    },
  };

  async execute({scene_id, modification}: UpdatesceneInput) {
    const edited_image_url = `https://dummyimage.com/512x512/222/fff.png&text=Edited:${encodeURIComponent(modification)}`;
    return `Processed: ${edited_image_url}`;
  }
}

export default UpdatesceneTool;