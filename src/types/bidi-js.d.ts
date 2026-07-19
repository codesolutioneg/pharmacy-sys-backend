declare module 'bidi-js' {
  type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };

  type BidiApi = {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevels;
    getReorderedString(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number | null,
      end?: number | null,
    ): string;
  };

  export default function bidiFactory(): BidiApi;
}
