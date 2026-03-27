import * as pdfjsLib from 'pdfjs-dist';
import { Chunk } from '../store/useStore';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

export function splitIntoChunks(text: string, maxChunkSize: number = 1000, overlap: number = 200): Chunk[] {
  // Split by paragraphs first (double newline or single newline followed by capital letter)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: Chunk[] = [];
  let currentChunkText = '';
  let chunkId = 0;
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // If a single paragraph is larger than maxChunkSize, we split it by sentences
    if (trimmedPara.length > maxChunkSize) {
      const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((currentChunkText + sentence).length > maxChunkSize && currentChunkText.length > 0) {
          chunks.push({
            id: `chunk-${chunkId++}`,
            text: currentChunkText.trim(),
            pageRef: Math.floor(chunks.length / 2) + 1 // Rough estimate
          });
          // Keep a bit of overlap
          currentChunkText = currentChunkText.slice(-overlap) + ' ' + sentence;
        } else {
          currentChunkText += (currentChunkText ? ' ' : '') + sentence;
        }
      }
    } else if ((currentChunkText + trimmedPara).length > maxChunkSize && currentChunkText.length > 0) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        text: currentChunkText.trim(),
        pageRef: Math.floor(chunks.length / 2) + 1
      });
      currentChunkText = currentChunkText.slice(-overlap) + ' ' + trimmedPara;
    } else {
      currentChunkText += (currentChunkText ? '\n\n' : '') + trimmedPara;
    }
  }
  
  if (currentChunkText.trim()) {
    chunks.push({
      id: `chunk-${chunkId++}`,
      text: currentChunkText.trim(),
      pageRef: Math.floor(chunks.length / 2) + 1
    });
  }
  
  return chunks;
}
