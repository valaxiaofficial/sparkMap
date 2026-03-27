import React, { useEffect, useState } from 'react';
import { 
  Sparkles, ArrowRight, BookOpen, Brain, Zap, Sun, Moon, History, 
  Plus, Search, Settings, PanelLeftClose, PanelLeftOpen,
  LayoutGrid, FileText, Code2, User, Pin, PinOff
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DocUploader } from './DocUploader';
import { generateConceptsFromTopic } from '../utils/geminiApi';
import { 
  getRecentMindmaps, loadMindmapFromNeo4j, saveWorkspaceToNeo4j, 
  loadChatFromNeo4j 
} from '../utils/neo4jdb';
import { toast } from 'sonner';

export function LaunchScreen() {
  const [prompt, setPrompt] = React.useState('');
  const [recents, setRecents] = useState<{topic: string, updatedAt: string}[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [recentsSearch, setRecentsSearch] = useState('');
  const [pinnedTopics, setPinnedTopics] = useState<string[]>([]);
  const { 
    setIsWorkspaceActive, isProcessing, setIsProcessing, 
    setNodes, setEdges, setInitialPrompt, addChatMessage, 
    setChatMessages, theme, toggleTheme 
  } = useStore();

  // Load recents and pins on mount
  useEffect(() => {
    getRecentMindmaps().then(setRecents);
    
    const savedPins = localStorage.getItem('sparkmap_pins');
    if (savedPins) setPinnedTopics(JSON.parse(savedPins));

    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const togglePin = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = pinnedTopics.includes(topic)
      ? pinnedTopics.filter(t => t !== topic)
      : [topic, ...pinnedTopics];
    setPinnedTopics(next);
    localStorage.setItem('sparkmap_pins', JSON.stringify(next));
  };

  const loadRecent = async (topic: string) => {
    setIsProcessing(true);
    try {
      const [data, chatData] = await Promise.all([
        loadMindmapFromNeo4j(topic),
        loadChatFromNeo4j(topic)
      ]);
      
      if (data) {
        setInitialPrompt(topic);
        setNodes(data.nodes as any);
        setEdges(data.edges as any);
        setChatMessages(chatData);
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
          const hubRadius = 400; // Halved from 800 to bring them closer
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

          const numConcepts = hub.concepts?.length || 0;
          hub.concepts?.forEach((concept: any, conceptIdx: number) => {
            // Distribute them in outward radiating rings to prevent overlapping
            const nodesPerRing = 5;
            const ringIndex = Math.floor(conceptIdx / nodesPerRing);
            const indexInRing = conceptIdx % nodesPerRing;
            const actualNodesInThisRing = Math.min(nodesPerRing, numConcepts - ringIndex * nodesPerRing);
            
            const conceptRadius = 340 + (ringIndex * 220); // First ring is at 340px, next at 560px, etc.
            
            // Calculate minimum arc spread to ensure horizontal non-overlap (box width ~240px + padding)
            const minArcLength = 280; 
            const requiredArcSpread = actualNodesInThisRing > 1 ? ((actualNodesInThisRing - 1) * minArcLength) / conceptRadius : 0;
            
            const startAngle = hubAngle - (requiredArcSpread / 2);
            const angleStep = actualNodesInThisRing > 1 ? requiredArcSpread / (actualNodesInThisRing - 1) : 0;
            
            const conceptAngle = actualNodesInThisRing === 1 ? hubAngle : startAngle + (indexInRing * angleStep);

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
        
        // Refresh recents list immediately so it shows in sidebar
        const updatedRecents = await getRecentMindmaps();
        setRecents(updatedRecents);

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
          <div className="sidebar-search-container px-3 py-2">
            <div className="relative group">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sc-text-muted)] group-focus-within:text-[var(--sc-primary)] transition-colors" />
              <input 
                type="text" 
                placeholder="Search recents..." 
                value={recentsSearch}
                onChange={(e) => setRecentsSearch(e.target.value)}
                className="w-full bg-[var(--sc-surface-panel)] border border-[var(--sc-border-light)] rounded-[8px] py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-[var(--sc-primary-faint)] focus:ring-2 focus:ring-[var(--sc-primary-faint)] transition-all"
              />
            </div>
          </div>

          {/* Pinned Section */}
          {pinnedTopics.length > 0 && (
            <>
              <div className="sidebar-section-title flex items-center gap-1.5">
                <Pin size={10} className="text-[var(--sc-primary)]" />
                Pinned
              </div>
              {pinnedTopics.map((topic, i) => (
                <div key={`pin-${i}`} className="sidebar-item group pr-2" onClick={() => loadRecent(topic)}>
                  <span className="truncate flex-1">{topic}</span>
                  <button 
                    onClick={(e) => togglePin(topic, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--sc-border-light)] rounded-md transition-all text-[var(--sc-primary)]"
                  >
                    <PinOff size={12} />
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="sidebar-section-title">Recents</div>
          <div className="flex flex-col gap-0.5 custom-scrollbar max-h-[40vh] overflow-y-auto">
            {recents
              .filter(item => 
                item.topic.toLowerCase().includes(recentsSearch.toLowerCase()) && 
                !pinnedTopics.includes(item.topic)
              )
              .map((item, i) => (
                <div key={`recent-${i}`} className="sidebar-item group pr-2" onClick={() => loadRecent(item.topic)}>
                  <span className="truncate flex-1">{item.topic}</span>
                  <button 
                    onClick={(e) => togglePin(item.topic, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--sc-border-light)] rounded-md transition-all"
                  >
                    <Pin size={12} className="text-[var(--sc-text-muted)] hover:text-[var(--sc-primary)]" />
                  </button>
                </div>
              ))}
            {recents.length === 0 && !recentsSearch && (
              <div className="px-3 py-2 text-[11px] text-[var(--sc-text-muted)] italic">
                Get started by creating your first map!
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile flex-1">
            <div className="user-avatar bg-gradient-to-br from-[var(--sc-primary)] to-[var(--sc-purple)] text-white shadow-sm flex items-center justify-center font-bold">X</div>
            <div className="user-info">
              <span className="user-name">Xyaa</span>
              <span className="user-plan text-[10px] uppercase font-bold tracking-widest opacity-50">Pro Plan</span>
            </div>
          </div>
          
          <button 
            className="p-2 rounded-lg hover:bg-[var(--sc-border-light)] transition-all text-[var(--sc-text-muted)] hover:text-[var(--sc-primary)]"
            title="Settings"
          >
            <Settings size={20} />
          </button>
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
              className={`launch-submit ${prompt.trim().length > 0 ? 'animate-pulse-glow bg-[var(--sc-purple)] shadow-[0_0_15px_rgba(124,100,182,0.4)]' : ''}`}
              disabled={!prompt.trim() || isProcessing}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="launch-divider">
            <span>OR UPLOAD</span>
          </div>

          <div className="flex justify-center mb-12">
            <DocUploader onUploadSuccess={() => getRecentMindmaps().then(setRecents)} />
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
