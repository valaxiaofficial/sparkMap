import React from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, Plus } from 'lucide-react';
import { embedQuery, chatWithRAG } from '../utils/geminiApi';
import { findTopKSimilar } from '../utils/clustering';
import { toast } from 'sonner';

export function RightPanel() {
  const { chatMessages, addChatMessage, chunks, nodes, setNodes, initialPrompt } = useStore();
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Allow chat even without chunks (General Knowledge)
    
    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: input.trim()
    };
    
    addChatMessage(userMessage);
    setInput('');
    setIsLoading(true);
    
    try {
      const queryEmbedding = await embedQuery(userMessage.content);
      const relevantChunks = findTopKSimilar(queryEmbedding, chunks, 3);
      // Pass the workspace topic and full conversation history so the AI
      // always knows what subject is being studied and remembers prior turns.
      const answer = await chatWithRAG(
        userMessage.content,
        relevantChunks,
        initialPrompt || undefined,
        chatMessages  // full history (before this message was added)
      );
      
      const assistantMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant' as const,
        content: answer,
        relevantChunks: relevantChunks.map(c => c.id)
      };
      
      addChatMessage(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNode = (content: string) => {
    const id = `concept-${Date.now()}`;
    const newNode = {
      id,
      type: 'concept',
      position: { x: Math.random() * 200, y: Math.random() * 200 },
      data: {
        label: content.slice(0, 30) + '...',
        chunkId: 'manual',
        description: content
      }
    };
    
    setNodes([...nodes, newNode]);
    toast.success('Added to canvas!');
  };
  
  return (
    <div className="chat-container">
      <div className="chat-panel-header">
        <Bot className="w-5 h-5 text-[var(--sc-purple)]" />
        <h2 className="text-[14px] font-medium text-[var(--sc-blue-text)] m-0">AI Study Assistant</h2>
      </div>
      
      <div className="chat-messages" ref={scrollRef}>
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--sc-text-secondary)] opacity-70">
            <Bot className="w-10 h-10 mb-2" />
            <p className="text-[13px]">Ask questions about your notes</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.role === 'assistant' && (
                <button 
                  onClick={() => handleCreateNode(message.content)}
                  className="mt-2 text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                  title="Add this insight to your canvas"
                >
                  <Plus className="w-3 h-3" />
                  Add to Canvas
                </button>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="chat-bubble-ai flex gap-1 items-center px-4 py-3">
            <div className="dot-animation" style={{ animationDelay: '0ms' }} />
            <div className="dot-animation" style={{ animationDelay: '200ms' }} />
            <div className="dot-animation" style={{ animationDelay: '400ms' }} />
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask a question..."
          disabled={isLoading}
          className="chat-input"
          rows={1}
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="btn-send">
          <Send className="w-4 h-4 ml-[-2px]" />
        </button>
      </form>
    </div>
  );
}