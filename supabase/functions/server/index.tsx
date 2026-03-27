import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const app = new Hono();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '');
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-edd888a5/health", (c) => {
  return c.json({ status: "ok" });
});

// Embedding endpoint
app.post("/make-server-edd888a5/api/embed", async (c) => {
  try {
    const { texts } = await c.req.json();
    
    if (!Array.isArray(texts) || texts.length === 0) {
      return c.json({ error: "texts array is required" }, 400);
    }

    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
      })
    );

    return c.json({ embeddings });
  } catch (error: any) {
    console.error("Embedding error:", error);
    return c.json({ error: error.message || "Failed to generate embeddings" }, 500);
  }
});

// Generate cluster label endpoint
app.post("/make-server-edd888a5/api/generate-label", async (c) => {
  try {
    const { texts } = await c.req.json();
    
    if (!Array.isArray(texts) || texts.length === 0) {
      return c.json({ error: "texts array is required" }, 400);
    }

    const combinedText = texts.join('\n\n');
    const prompt = `Based on the following text excerpts from an academic document, generate a concise 2-4 word label that captures the main concept or theme. Be specific and academic in tone.

Text excerpts:
${combinedText.slice(0, 2000)}

Label:`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const label = response.text().trim().replace(/['"]/g, '');

    return c.json({ label });
  } catch (error: any) {
    console.error("Label generation error:", error);
    return c.json({ error: error.message || "Failed to generate label" }, 500);
  }
});

// Generate flashcard endpoint
app.post("/make-server-edd888a5/api/generate-flashcard", async (c) => {
  try {
    const { text } = await c.req.json();
    
    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }

    const prompt = `Based on this text from an academic document, create a study flashcard with one focused question and a clear, concise answer.

Text:
${text.slice(0, 1000)}

Respond in JSON format:
{
  "question": "your question here",
  "answer": "your answer here"
}`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const flashcard = JSON.parse(jsonMatch[0]);
      return c.json({ flashcard });
    }

    // Fallback if JSON parsing fails
    return c.json({
      flashcard: {
        question: "What is the main concept?",
        answer: text.slice(0, 200)
      }
    });
  } catch (error: any) {
    console.error("Flashcard generation error:", error);
    return c.json({ error: error.message || "Failed to generate flashcard" }, 500);
  }
});

// Generate initial canvas from topic
app.post("/make-server-edd888a5/api/generate-content", async (c) => {
  try {
    const { topic } = await c.req.json();
    
    if (!topic) {
      return c.json({ error: "topic is required" }, 400);
    }

    const prompt = `You are a study workspace generator. Based on the topic "${topic}", create a structured knowledge map.
Break the topic down into 5-8 distinct, high-level academic concepts.
For each concept, provide:
1. A concise label (2-4 words).
2. A detailed academic description (2-3 sentences).
3. A study flashcard (one question, one answer).

Respond STIRCTLY in JSON format as an array of concepts:
[
  {
    "label": "Concept Label",
    "description": "Concept description here.",
    "flashcard": {
      "question": "Question here?",
      "answer": "Answer here."
    }
  },
  ...
]`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const concepts = JSON.parse(jsonMatch[0]);
      return c.json({ concepts });
    }

    throw new Error("Failed to parse AI response into JSON concepts");
  } catch (error: any) {
    console.error("Content generation error:", error);
    return c.json({ error: error.message || "Failed to generate content" }, 500);
  }
});

// Chat endpoint with RAG
app.post("/make-server-edd888a5/api/chat", async (c) => {
  try {
    const { query, context } = await c.req.json();
    
    if (!query) {
      return c.json({ error: "query is required" }, 400);
    }

    const contextText = Array.isArray(context) ? context.join('\n\n') : '';
    
    const prompt = `You are an elite academic mentor and study assistant. Your goal is to help the user master complex topics.
- Answer the student's question accurately.
- Use the provided context from their materials if available.
- CRITICALLY: Supplement with your own high-level expert knowledge if the context is incomplete or if a broader explanation is needed.
- Maintain an encouraging, sophisticated, and scholarly tone.

Context from study materials:
${contextText.slice(0, 4000)}

Student question: ${query}

Expert Response:`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();

    return c.json({ answer });
  } catch (error: any) {
    console.error("Chat error:", error);
    return c.json({ error: error.message || "Failed to get chat response" }, 500);
  }
});

Deno.serve(app.fetch);