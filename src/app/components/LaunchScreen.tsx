import React, { useEffect } from 'react';
import { Sparkles, ArrowRight, BookOpen, Brain, Zap, Sun, Moon, History } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PDFUploader } from './PDFUploader';
import { generateConceptsFromTopic } from '../utils/geminiApi';
import { getRecentMindmaps, loadMindmapFromNeo4j, saveWorkspaceToNeo4j } from '../utils/neo4jdb';
import { toast } from 'sonner';

export function LaunchScreen() {
  const [prompt, setPrompt] = React.useState('');
  const { 
    setIsWorkspaceActive, isProcessing, setIsProcessing, 
    setNodes, setEdges, setInitialPrompt, addChatMessage, 
    theme, toggleTheme 
  } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isProcessing) {
      setInitialPrompt(prompt);
      setIsProcessing(true);
      
      try {
        const result = await generateConceptsFromTopic(prompt);
        // Expect result: { topic, hubs: [ { title, concepts: [...] } ] }
        
        const newNodes: any[] = [];
        const newEdges: any[] = [];
        const timestamp = Date.now();

        // 1. Create Root Node
        const rootId = `root-${timestamp}`;
        newNodes.push({
          id: rootId,
          type: 'concept',
          position: { x: 0, y: 0 },
          data: { label: result.topic, isRoot: true, description: `Central theme for ${result.topic}`, chunkId: 'gen' }
        });

        // 2. Create Hubs and Concepts in Vector Clusters
        result.hubs.forEach((hub: any, hubIdx: number) => {
          const hubAngle = (hubIdx / result.hubs.length) * 2 * Math.PI;
          const hubRadius = 450;
          const hubX = Math.cos(hubAngle) * hubRadius;
          const hubY = Math.sin(hubAngle) * hubRadius;
          const hubId = `hub-${hubIdx}-${timestamp}`;

          newNodes.push({
            id: hubId,
            type: 'concept',
            position: { x: hubX, y: hubY },
            data: { label: hub.title, isHub: true, description: `Core pillar of ${hub.title}`, chunkId: 'gen' }
          });

          newEdges.push({
            id: `edge-root-hub-${hubIdx}`,
            source: rootId,
            target: hubId,
            animated: true
          });

          hub.concepts.forEach((concept: any, conceptIdx: number) => {
            const conceptAngle = hubAngle + ((conceptIdx - (hub.concepts.length / 2)) * 0.25);
            const conceptRadius = 180;
            const conceptX = hubX + Math.cos(conceptAngle) * conceptRadius;
            const conceptY = hubY + Math.sin(conceptAngle) * conceptRadius;
            const conceptId = `concept-${hubIdx}-${conceptIdx}-${timestamp}`;

            newNodes.push({
              id: conceptId,
              type: 'concept',
              position: { x: conceptX, y: conceptY },
              data: { 
                label: concept.label, 
                description: concept.description, 
                flashcard: concept.flashcard,
                chunkId: 'gen'
              }
            });

            newEdges.push({
              id: `edge-hub-concept-${hubIdx}-${conceptIdx}`,
              source: hubId,
              target: conceptId
            });
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
        
        // Save to Neo4j
        await saveWorkspaceToNeo4j(prompt, newNodes, newEdges);

        addChatMessage({
          id: 'initial',
          role: 'assistant',
          content: `I've constructed a hierarchical mindmap for **${prompt}**. You'll find the central root connected to key sub-topic hubs, each surrounded by detailed concepts.`,
        });
        
        setIsWorkspaceActive(true);
        toast.success(`Generated workspace for ${prompt}`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to generate content. Let's try again.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="launch-screen">
      {/* Main Content */}
      <div className="launch-main">
        {/* Theme toggle — top right */}
        <button
          className="theme-toggle launch-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <span className="theme-toggle-track">
            <span className="theme-toggle-thumb">
              {theme === 'dark'
                ? <Moon className="w-3 h-3" />
                : <Sun className="w-3 h-3" />
              }
            </span>
          </span>
        </button>

        <div className="launch-background">
          <div className="canvas-welcome-dots" style={{ opacity: 0.6 }} />
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <div className="launch-content animate-fade-in">
          <div className="launch-header">
            <div className="launch-logo">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <span className="launch-brand">SparkMap AI</span>
          </div>

          <h1 className="launch-hero-title">
            Visualizing knowledge,<br/>
            <span className="text-gradient">redefined.</span>
          </h1>
          
          <p className="launch-hero-sub">
            Transform topics and documents into interactive hierarchical graphs with Neo4j-style topological search.
          </p>

          <form onSubmit={handleSubmit} className="launch-input-wrapper">
            <input 
              type="text" 
              placeholder="Enter a topic to explore..."
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
            <span>OR UPLOAD</span>
          </div>

          <div className="flex justify-center mb-12">
            <PDFUploader />
          </div>

          <div className="launch-features">
            <div className="feature-card">
              <div className="feature-icon bg-sage"><History className="w-4 h-4" /></div>
              <div className="feature-text">
                <strong>History</strong>
                <span>Persistent Neo4j storage</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon bg-earth"><Brain className="w-4 h-4" /></div>
              <div className="feature-text">
                <strong>Vector Graph</strong>
                <span>Hierarchical clusters</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon bg-water"><Zap className="w-4 h-4" /></div>
              <div className="feature-text">
                <strong>Semantic AI</strong>
                <span>Figma-responsive view</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
