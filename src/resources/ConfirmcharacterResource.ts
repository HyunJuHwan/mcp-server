// import { MCPResource, ResourceContent } from "mcp-framework";

// let confirmedCharacterCache: any[] = [];

// class ConfirmcharacterResource extends MCPResource {
//   uri = "resource://confirmCharacter";
//   name = "Confirmcharacter";
//   description = "Confirmcharacter resource description";
//   mimeType = "application/json";

//   async read(): Promise<ResourceContent[]> {
//       return [
//         {
//           uri: this.uri,
//           mimeType: this.mimeType,
//           text: JSON.stringify(confirmedCharacterCache),
//         },
//       ];
//     }
  
//     async write(content: ResourceContent): Promise<void> {
//       if (content.text) {
//         try {
//           if (!confirmedCharacterCache.includes(content.text)) {
//             confirmedCharacterCache.push(content.text);
//           }
//         } catch (err) {
//           console.error("Failed to parse and confirm character:", err);
//         }
//       }
//     }

// }

// export default ConfirmcharacterResource;