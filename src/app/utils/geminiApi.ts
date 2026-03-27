import { Chunk, Flashcard } from '../store/useStore';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { GoogleGenAI } from '@google/genai';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-edd888a5/api`;

// ─── New @google/genai SDK ────────────────────────────────────────────────────
// Uses the updated API as per https://ai.google.dev/gemini-api/docs/api-key#provide-api-key-explicitly
// and https://ai.google.dev/gemini-api/docs/gemini-3
const API_KEY = import.meta.env?.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  console.warn(
    'VITE_GEMINI_API_KEY is not set in .env. Gemini fallback calls will fail. ' +
    'Add VITE_GEMINI_API_KEY=<your_key> to .env and restart the dev server.'
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY ?? '' });

// Text model: gemini-3-flash-preview (fast, free-tier friendly)
const TEXT_MODEL = 'gemini-3-flash-preview';
// Embedding model
const EMBEDDING_MODEL = 'gemini-embedding-001';

// ─── Helper: generate text content via new SDK ────────────────────────────────
async function generateText(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
  });
  return response.text ?? '';
}

// ─── Helper: embed text via new SDK ───────────────────────────────────────────
async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function embedChunks(chunks: Chunk[]): Promise<Chunk[]> {
  try {
    const response = await fetch(`${API_BASE}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ texts: chunks.map(c => c.text) })
    });

    if (!response.ok) {
      throw new Error('Failed to generate embeddings via API');
    }

    const { embeddings } = await response.json();
    return chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for embedChunks', error);
    const embeddings = await Promise.all(
      chunks.map(chunk => embedText(chunk.text))
    );
    return chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));
  }
}

export async function generateClusterLabel(chunkTexts: string[]): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/generate-label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ texts: chunkTexts })
    });

    if (!response.ok) {
      throw new Error('Failed to generate label via API');
    }

    const { label } = await response.json();
    return label;
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for generateClusterLabel', error);
    try {
      const combinedText = chunkTexts.join('\n\n');
      const prompt = `Based on the following text excerpts from an academic document, generate a concise 2-4 word label that captures the main concept or theme. Be specific and academic in tone.\n\nText excerpts:\n${combinedText.slice(0, 2000)}\n\nLabel:`;
      return (await generateText(prompt)).trim().replace(/['"]/g, '');
    } catch (fallbackError) {
      console.error('Local fallback label generation error:', fallbackError);
      return 'Concept Group';
    }
  }
}

export async function generateFlashcard(chunkText: string): Promise<Flashcard> {
  try {
    const response = await fetch(`${API_BASE}/generate-flashcard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ text: chunkText })
    });

    if (!response.ok) {
      throw new Error('Failed to generate flashcard via API');
    }

    const { flashcard } = await response.json();
    return flashcard;
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for generateFlashcard', error);
    try {
      const prompt = `Based on this text from an academic document, create a study flashcard with one focused question and a clear, concise answer.\n\nText:\n${chunkText.slice(0, 1000)}\n\nRespond in JSON format:\n{\n  "question": "your question here",\n  "answer": "your answer here"\n}`;
      const responseText = (await generateText(prompt)).trim();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (fallbackError) {
      console.error('Local fallback flashcard generation error:', fallbackError);
    }
    return {
      question: 'What is the main concept?',
      answer: chunkText.slice(0, 200) + '...'
    };
  }
}

export async function chatWithRAG(query: string, contextChunks: Chunk[]): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        query,
        context: contextChunks.map(c => c.text)
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get chat response via API');
    }

    const { answer } = await response.json();
    return answer;
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for chatWithRAG', error);
    try {
      const contextText = contextChunks.map(c => c.text).join('\n\n');
      const prompt = `You are an elite academic mentor and study assistant. Your goal is to help the user master complex topics.\n- Answer the student's question accurately.\n- Use the provided context from their materials if available.\n- CRITICALLY: Supplement with your own high-level expert knowledge if the context is incomplete or if a broader explanation is needed.\n- Maintain an encouraging, sophisticated, and scholarly tone.\n\nContext from study materials:\n${contextText.slice(0, 4000)}\n\nStudent question: ${query}\n\nExpert Response:`;
      return (await generateText(prompt)).trim();
    } catch (fallbackError) {
      console.error('Local fallback chat error:', fallbackError);
      throw fallbackError;
    }
  }
}

export async function generateConceptsFromTopic(topic: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/generate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ topic })
    });

    if (!response.ok) {
      throw new Error('Failed to generate study content via API');
    }

    const { concepts } = await response.json();
    return concepts;
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for generateConceptsFromTopic', error);
    try {
      const prompt = `You are a study workspace generator. Based on the topic "${topic}", create a structured knowledge map.\nBreak the topic down into 5-8 distinct, high-level academic concepts.\nFor each concept, provide:\n1. A concise label (2-4 words).\n2. A detailed academic description (2-3 sentences).\n3. A study flashcard (one question, one answer).\n\nRespond STRICTLY in JSON format as an array of concepts:\n[\n  {\n    "label": "Concept Label",\n    "description": "Concept description here.",\n    "flashcard": {\n      "question": "Question here?",\n      "answer": "Answer here."\n    }\n  }\n]`;
      const responseText = (await generateText(prompt)).trim();

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse AI response into JSON concepts');
    } catch (fallbackError) {
      console.error('Local fallback content generation error:', fallbackError);
      throw fallbackError;
    }
  }
}

export async function embedQuery(query: string): Promise<number[]> {
  try {
    const response = await fetch(`${API_BASE}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ texts: [query] })
    });

    if (!response.ok) {
      throw new Error('Failed to embed query via API');
    }

    const { embeddings } = await response.json();
    return embeddings[0];
  } catch (error) {
    console.warn('Backend API failed, falling back to local Gemini SDK for embedQuery', error);
    try {
      return await embedText(query);
    } catch (fallbackError) {
      console.error('Local fallback query embedding error:', fallbackError);
      throw fallbackError;
    }
  }
}