import React from 'react';
import { Sparkles, ArrowRight, BookOpen, Brain, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PDFUploader } from './PDFUploader';
import { generateConceptsFromTopic } from '../utils/geminiApi';
import { toast } from 'sonner';

export function LaunchScreen() {
  const [prompt, setPrompt] = React.useState('');
  const { setIsWorkspaceActive, isProcessing, setIsProcessing, setNodes, setEdges, setInitialPrompt, addChatMessage } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isProcessing) {
      setInitialPrompt(prompt);
      setIsProcessing(true);
      
      try {
        const concepts = await generateConceptsFromTopic(prompt);
        
        const newNodes = concepts.map((c: any, i: number) => ({
          id: `concept-${i}-${Date.now()}`,
          type: 'concept',
          position: { x: Math.cos(i) * 250 + 400, y: Math.sin(i) * 250 + 300 },
          data: {
            label: c.label,
            description: c.description,
            flashcard: c.flashcard,
            chunkId: 'llm-generated'
          }
        }));

        setNodes(newNodes);
        
        addChatMessage({
          id: 'initial',
          role: 'assistant',
          content: `I've mapped out the key concepts for **${prompt}**. You can explore the nodes on the canvas or ask me more specific questions!`,
        });
        
        setIsWorkspaceActive(true);
        toast.success(`Generated workspace for ${prompt}`);
      } catch (err) {
        toast.error("Failed to generate content. Let's start with a blank canvas.");
        setIsWorkspaceActive(true);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="launch-screen">
      <div className="launch-background">
        {/* Consistent Dot Grid */}
        <div className="canvas-welcome-dots" style={{ opacity: 0.6 }} />
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="launch-content animate-fade-in">
        <div className="launch-header">
          <div className="launch-logo">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <span className="launch-brand">SparkMap AI</span>
        </div>

        <h1 className="launch-hero-title">
          Modular thinking,<br/>
          <span className="text-gradient">naturally structured.</span>
        </h1>
        
        <p className="launch-hero-sub">
          The elegant space for students to transform complex documents into visual knowledge.
        </p>

        <form onSubmit={handleSubmit} className="launch-input-wrapper">
          <input 
            type="text" 
            placeholder="Type a topic to explore or upload a PDF..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="launch-input"
            disabled={isProcessing}
          />
          <button 
            type="submit" 
            className="launch-submit"
            disabled={!prompt.trim() || isProcessing}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="launch-divider">
          <span>OR</span>
        </div>

        <div className="flex justify-center mb-12">
          <PDFUploader />
        </div>

        <div className="launch-features">
          <div className="feature-card">
            <div className="feature-icon bg-sage"><BookOpen className="w-4 h-4" /></div>
            <div className="feature-text">
              <strong>PDF to Nodes</strong>
              <span>Semantic chunking</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon bg-earth"><Brain className="w-4 h-4" /></div>
            <div className="feature-text">
              <strong>Smart Clusters</strong>
              <span>AI logical grouping</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon bg-water"><Zap className="w-4 h-4" /></div>
            <div className="feature-text">
              <strong>Instant Insight</strong>
              <span>Flashcards & Chat</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="launch-footer">
        © 2026 SparkMap AI • Nature-inspired Study Workspace
      </div>
    </div>
  );
}
