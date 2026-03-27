import React, { useEffect, useState } from 'react';
import { 
  Sparkles, ArrowRight, BookOpen, Brain, Zap, Sun, Moon, History, 
  Plus, Search, Settings, PanelLeftClose, PanelLeftOpen,
  LayoutGrid, FileText, Code2, User
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { PDFUploader } from './PDFUploader';
import { generateConceptsFromTopic } from '../utils/geminiApi';
import { getRecentMindmaps, loadMindmapFromNeo4j, saveWorkspaceToNeo4j } from '../utils/neo4jdb';
import { toast } from 'sonner';

export function LaunchScreen() {
  const [prompt, setPrompt] = React.useState('');
  const [recents, setRecents] = useState<{topic: string, updatedAt: string}[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { 
    setIsWorkspaceActive, isProcessing, setIsProcessing, 
    setNodes, setEdges, setInitialPrompt, addChatMessage, 
    theme, toggleTheme 
  } = useStore();

  // Load recents from Neo4j on mount
  useEffect(() => {
    getRecentMindmaps().then(setRecents);
  }, []);

  const loadRecent = async (topic: string) => {
    setIsProcessing(true);
    try {
      const data = await loadMindmapFromNeo4j(topic);
      if (data) {
        setInitialPrompt(topic);
        setNodes(data.nodes as any);
        setEdges(data.edges as any);
        setIsWorkspaceActive(true);
        toast.success(`Restored ${topic}`);
      }
    } catch (err) {
      toast.error("Failed to load map.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startNew = () => {
    setPrompt('');
    setInitialPrompt('');
    setIsWorkspaceActive(false);
  };

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
      {/* Sidebar Toggle Button (Floating when collapsed) */}
      <button 
        className={`sidebar-toggle-btn ${!isSidebarCollapsed ? 'sidebar-open' : ''}`}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {/* Claude-style Sidebar */}
      <aside className={`launch-sidebar-claude ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-link">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>SparkMap AI</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <button className="sidebar-item sidebar-item-new" onClick={startNew}>
            <Plus size={16} />
            <span>New mindmap</span>
          </button>

          <button className="sidebar-item">
            <Search size={16} />
            <span>Search</span>
          </button>

          <button className="sidebar-item">
            <Settings size={16} />
            <span>Customize</span>
          </button>

          <div className="sidebar-section-title">Starred</div>
          <div className="sidebar-item">
            <span>Graph Architecture</span>
          </div>

          <div className="sidebar-section-title">Recents</div>
          {recents.length > 0 ? (
            recents.map((item, i) => (
              <button key={i} className="sidebar-item" onClick={() => loadRecent(item.topic)}>
                <span className="truncate">{item.topic}</span>
              </button>
            ))
          ) : (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--sc-text-muted)' }}>
              No recent maps found
            </div>
          )}

          <div className="sidebar-section-title">Collections</div>
          <button className="sidebar-item"><LayoutGrid size={16} /> Projects</button>
          <button className="sidebar-item"><FileText size={16} /> Artifacts</button>
          <button className="sidebar-item"><Code2 size={16} /> Code</button>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">X</div>
            <div className="user-info">
              <span className="user-name">Xyaa</span>
              <span className="user-plan">Pro Plan (Pixel OS)</span>
            </div>
          </div>
        </div>
      </aside>

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
