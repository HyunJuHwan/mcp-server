import { MCPTool } from "mcp-framework";
import { z } from "zod";
import CharacterResource from "../resources/CharacterResource.js";

const saveCharacter = new CharacterResource();

interface ConfirmcharacterInput {
  character_ids: Array<string>;
}

class ConfirmcharacterTool extends MCPTool<ConfirmcharacterInput> {
  name = "confirmCharacter";
  description = "Confirmcharacter tool description";

  schema = {
    character_ids: {
      type: z.array(z.string()),
      description: "List of character IDs to confirm",
    },
  };

  async execute({character_ids}: ConfirmcharacterInput) {

    await saveCharacter.confirm({
      mimeType: "application/json",
      text: JSON.stringify(character_ids),
      uri: saveCharacter.uri,
    });

    return { confirmed: character_ids };
  }
}

export default ConfirmcharacterTool;