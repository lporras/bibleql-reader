export interface SaveImageArgs {
  data: Uint8Array;
  suggestedName: string;
  mimeType: "image/png" | "image/jpeg";
}

export interface SaveImageResult {
  canceled: boolean;
  filePath?: string;
}
