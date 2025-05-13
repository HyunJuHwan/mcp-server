import { MCPResource, ResourceContent } from "mcp-framework";

class ImagestyleResource extends MCPResource {
  uri = "resource://imageStyle";
  name = "Imagestyle";
  description = "Imagestyle resource description";
  mimeType = "application/json";

  readonly list = [
    { id: '2d', label: '2D 스타일' },
    { id: '3d', label: '3D 스타일' }
  ];

  async read(): Promise<ResourceContent[]> {
    return [
      {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(this.list),
      },
    ];
  }
}

export default ImagestyleResource;