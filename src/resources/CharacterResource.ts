import { MCPResource, ResourceContent } from "mcp-framework";

let savedCharacters: any[] = [];
let confirmedCharacterCache: any[] = [];

class CharacterResource extends MCPResource {
  uri = "resource://character";
  name = "character";
  description = "Stores a list of generated characters";
  mimeType = "application/json";

  async read(): Promise<ResourceContent[]> {
    return [
      {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify({save: savedCharacters, confirmCharacter: confirmedCharacterCache}),
      },
    ];
  }

  async save(content: ResourceContent): Promise<void> {
    if (content.text) {
      try {
        const newCharacter = JSON.parse(content.text);
        savedCharacters.push(newCharacter);
      } catch (err) {
        console.error("Failed to parse and save character:", err);
      }
    }
  }

  async updateSave(content: ResourceContent): Promise<void> {
    if (content.text) {
      try {
        const character = JSON.parse(content.text);
        savedCharacters.push(character.newCharacter);
        const index = savedCharacters.findIndex((character) => character.character_id === character.old_character_id);
        if (index !== -1) {
          savedCharacters[index] = character.newCharacter;
        }

      } catch (err) {
        console.error("Failed to parse and save character:", err);
      }
    }
  }

  async confirm(content: ResourceContent): Promise<void> {
      if (content.text) {
        try {
          if (!confirmedCharacterCache.includes(content.text)) {
            confirmedCharacterCache.push(content.text);
          }
        } catch (err) {
          console.error("Failed to parse and confirm character:", err);
        }
      }
    }

}

export default CharacterResource;
