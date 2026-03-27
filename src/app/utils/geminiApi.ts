import { Chunk, Flashcard, ChatMessage } from '../store/useStore';
import { GoogleGenAI } from '@google/genai';

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
  const embeddings = await Promise.all(
    chunks.map(chunk => embedText(chunk.text))
  );
  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i]
  }));
}

export async function generateClusterLabel(chunkTexts: string[]): Promise<string> {
  try {
    const combinedText = chunkTexts.join('\n\n');
    const prompt = `Based on the following text excerpts from an academic document, generate a concise 2-4 word label that captures the main concept or theme. Be specific and academic in tone.\n\nText excerpts:\n${combinedText.slice(0, 2000)}\n\nLabel:`;
    return (await generateText(prompt)).trim().replace(/['"]/g, '');
  } catch (error) {
    console.error('Local fallback label generation error:', error);
    return 'Concept Group';
  }
}

export async function generateFlashcard(chunkText: string): Promise<Flashcard> {
  try {
    const prompt = `Based on this text from an academic document, create a study flashcard with one focused question and a clear, concise answer.\n\nText:\n${chunkText.slice(0, 1000)}\n\nRespond in JSON format:\n{\n  "question": "your question here",\n  "answer": "your answer here"\n}`;
    const responseText = (await generateText(prompt)).trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Local flashcard generation error:', error);
  }
  return {
    question: 'What is the main concept?',
    answer: chunkText.slice(0, 200) + '...'
  };
}

export async function chatWithRAG(
  query: string,
  contextChunks: Chunk[],
  topic?: string,
  history?: ChatMessage[]
): Promise<string> {
  try {
    const contextText = contextChunks.map(c => c.text).join('\n\n');

    const historyText = history && history.length > 0
      ? history
          .map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`)
          .join('\n')
      : '';

    const topicLine = topic ? `The student is currently studying: **${topic}**.` : '';

    const prompt = [
      'You are an elite academic mentor and study assistant. Your goal is to help the student master the topic they are studying.',
      '- Always stay focused on the topic and the student\'s materials.',
      '- Use the provided context from their study materials when relevant.',
      '- Supplement with your own expert knowledge when needed.',
      '- Maintain an encouraging, sophisticated, and scholarly tone.',
      '- NEVER ask the student what topic they are studying — you already know it from context.',
      '',
      topicLine,
      '',
      contextText ? `Context from study materials:\n${contextText.slice(0, 3000)}` : '',
      '',
      historyText ? `Conversation so far:\n${historyText}` : '',
      '',
      `Student: ${query}`,
      '',
      'Mentor:'
    ].filter(Boolean).join('\n');

    return (await generateText(prompt)).trim();
  } catch (error) {
    console.error('Local chat error:', error);
    throw error;
  }
}

export async function generateConceptsFromTopic(topic: string): Promise<any> {
  try {
    // Generate Root Node, Sub-Title Hubs, and Flashcard Concepts formatted for Neo4j relationships.
    const prompt = `You are a study workspace generator. Based on the topic "${topic}", create a structured knowledge map containing:
1. One central Root Node for the main topic.
2. Distinct Sub-title Hubs spanning the core subjects.
3. Detailed Concepts attached to each Sub-title Hub.

Respond STRICTLY in JSON format with this structure:
{
  "topic": "Central Domain Name",
  "hubs": [
    {
      "title": "Sub-title Hub 1",
      "concepts": [
        {
          "label": "Concept Label",
          "description": "2-3 sentences of detailed academic description.",
          "flashcard": {
            "question": "Focused question?",
            "answer": "Clear answer."
          }
        }
      ]
    }
  ]
}`;
    const responseText = (await generateText(prompt)).trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response into hierarchical concepts');
  } catch (error) {
    console.error('Local content generation error:', error);
    throw error;
  }
}

export async function embedQuery(query: string): Promise<number[]> {
  try {
    return await embedText(query);
  } catch (error) {
    console.error('Local query embedding error:', error);
    throw error;
  }
}