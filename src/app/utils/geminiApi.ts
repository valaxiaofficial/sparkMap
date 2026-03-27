import { Chunk, Flashcard } from '../store/useStore';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-edd888a5/api`;

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
      throw new Error('Failed to generate embeddings');
    }
    
    const { embeddings } = await response.json();
    
    return chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));
  } catch (error) {
    console.error('Embedding error:', error);
    throw error;
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
      throw new Error('Failed to generate label');
    }
    
    const { label } = await response.json();
    return label;
  } catch (error) {
    console.error('Label generation error:', error);
    return 'Concept Group';
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
      throw new Error('Failed to generate flashcard');
    }
    
    const { flashcard } = await response.json();
    return flashcard;
  } catch (error) {
    console.error('Flashcard generation error:', error);
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
      throw new Error('Failed to get chat response');
    }
    
    const { answer } = await response.json();
    return answer;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
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
      throw new Error('Failed to generate study content');
    }
    
    const { concepts } = await response.json();
    return concepts;
  } catch (error) {
    console.error('Content generation error:', error);
    throw error;
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
      throw new Error('Failed to embed query');
    }
    
    const { embeddings } = await response.json();
    return embeddings[0];
  } catch (error) {
    console.error('Query embedding error:', error);
    throw error;
  }
}