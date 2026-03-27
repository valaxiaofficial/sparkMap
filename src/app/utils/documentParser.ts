import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { Chunk } from '../store/useStore';

// Configure PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Universal document parser supporting PDF, DOCX, PPTX, MD, and TXT.
 */
export async function parseDocument(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return await parsePDF(file);
    case 'docx':
      return await parseDOCX(file);
    case 'pptx':
      return await parsePPTX(file);
    case 'md':
    case 'markdown':
    case 'txt':
      return await file.text();
    default:
      // Fallback: try reading as text
      try {
        return await file.text();
      } catch {
        throw new Error(`Unsupported file type: ${extension}`);
      }
  }
}

async function parsePDF(file: File): Promise<string> {
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

async function parseDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parsePPTX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // PPTX slides are in ppt/slides/slide1.xml, slide2.xml...
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  
  // Sort slides numerically
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] || '0');
    const nb = parseInt(b.match(/\d+/)?.[0] || '0');
    return na - nb;
  });

  let fullText = '';
  for (const slidePath of slideFiles) {
    const xmlText = await zip.files[slidePath].async('string');
    // Basic XML text extraction (extract all text content in <a:t> tags)
    const texts = xmlText.match(/<a:t>.*?<\/a:t>/g);
    if (texts) {
      const slideContent = texts.map(t => t.replace(/<[^>]*>/g, '')).join(' ');
      fullText += slideContent + '\n';
    }
  }
  return fullText || 'No text content found in PPTX.';
}

export function splitIntoChunks(text: string, maxChunkSize: number = 800, overlap: number = 150): Chunk[] {
  // Use existing logic (improved chunk boundaries)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: Chunk[] = [];
  let currentChunkText = '';
  let chunkId = 0;
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (trimmedPara.length > maxChunkSize) {
      const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((currentChunkText + sentence).length > maxChunkSize && currentChunkText.length > 0) {
          chunks.push({
            id: `chunk-${chunkId++}`,
            text: currentChunkText.trim(),
            pageRef: Math.floor(chunks.length / 2) + 1
          });
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
    chunks.push({ id: `chunk-${chunkId++}`, text: currentChunkText.trim(), pageRef: 1 });
  }
  
  return chunks;
}
