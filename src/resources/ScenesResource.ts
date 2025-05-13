import { MCPResource, ResourceContent } from "mcp-framework";

const sceneCache: any[] = [];

class ScenesResource extends MCPResource {
  uri = "resource://scenes";
  name = "scenes";
  description = "Createscenes resource description";
  mimeType = "application/json";

  async read(): Promise<ResourceContent[]> {
      return [
        {
          uri: this.uri,
          mimeType: this.mimeType,
          text: JSON.stringify(sceneCache),
        },
      ];
    }
  
    async write(content: ResourceContent): Promise<void> {
      if (content.text) {
        try {
          const newScene = JSON.parse(content.text);
          sceneCache.push(newScene);
        } catch (err) {
          console.error("Failed to parse and save character:", err);
        }
      }
    }

    async update(content: ResourceContent): Promise<void> {
      if (content.text) {
        try {
          const updatedScene = JSON.parse(content.text);
          const index = sceneCache.findIndex((scene) => scene.id === updatedScene.id);
          if (index !== -1) {
            sceneCache[index] = updatedScene;
          }
        } catch (err) {
          console.error("Failed to parse and update character:", err);
        }
      }
    }
}

export default ScenesResource;