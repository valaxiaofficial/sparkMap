import React from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, Plus } from 'lucide-react';
import { embedQuery, chatWithRAG } from '../utils/geminiApi';
import { findTopKSimilar } from '../utils/clustering';
import { saveChatToNeo4j } from '../utils/neo4jdb';
import { setModel } from '../utils/geminiApi';
import { SUPPORTED_MODELS } from '../store/useStore';
import { DocUploader } from './DocUploader';
import { toast } from 'sonner';

export function RightPanel() {
  const { 
    chatMessages, addChatMessage, chunks, nodes, setNodes, 
    initialPrompt, selectedModel, setSelectedModel 
  } = useStore();
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showModelMenu, setShowModelMenu] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  // Propagate model selection to the API utility
  React.useEffect(() => {
    setModel(selectedModel);
  }, [selectedModel]);
  
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);

  // Persist chat to Neo4j whenever it changes
  React.useEffect(() => {
    if (initialPrompt && chatMessages.length > 0) {
      saveChatToNeo4j(initialPrompt, chatMessages);
    }
  }, [chatMessages, initialPrompt]);
  
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
                  className="mt-3 text-[10px] flex items-center gap-1.5 w-max px-2.5 py-1.5 rounded-md border border-[var(--sc-primary-glow)] bg-[var(--sc-primary-light)] text-[var(--sc-primary)] hover:border-[var(--sc-primary)] hover:shadow-sm transition-all"
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

      {/* Chat Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--sc-border-light)] bg-[var(--sc-surface-alt)]">
        <div className="flex items-center gap-1">
          {/* Upload Button */}
            <DocUploader compact />
          <div className="w-[1px] h-3.5 bg-[var(--sc-border-light)] mx-1" />
          
          <div className="relative">
            <button 
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] bg-[var(--sc-surface-card)] shadow-sm border border-[var(--sc-border)] hover:border-[var(--sc-primary)] hover:text-[var(--sc-primary)] transition-all text-[11px] font-medium text-[var(--sc-text-muted)] group"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--sc-primary)] animate-pulse group-hover:scale-110 transition-transform" />
              <span>{SUPPORTED_MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
            </button>

            {showModelMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--sc-surface-card)] border border-[var(--sc-border-light)] rounded-[12px] shadow-xl p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="px-2 py-1.5 text-[9px] font-semibold text-[var(--sc-text-muted)] uppercase tracking-wider border-b border-[var(--sc-border-light)] mb-1">
                    Select AI Model
                  </div>
                  {SUPPORTED_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelMenu(false);
                        toast.success(`Switched to ${model.name}`);
                      }}
                      className={`flex items-center justify-between w-full p-2 text-left rounded-[8px] transition-all ${selectedModel === model.id ? 'bg-[var(--sc-primary-faint)] text-[var(--sc-primary)]' : 'hover:bg-[var(--sc-surface-panel)] text-[var(--sc-text-primary)]'}`}
                    >
                      <span className="text-[11px] font-medium">{model.name}</span>
                      {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--sc-primary)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="text-[9px] font-medium text-[var(--sc-text-muted)] uppercase tracking-tighter opacity-70">
          Ready for analysis
        </div>
      </div>
    </div>
  );
}