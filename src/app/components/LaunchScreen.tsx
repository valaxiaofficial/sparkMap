import React, { useEffect, useState } from 'react';
import { 
  Sparkles, ArrowRight, BookOpen, Brain, Zap, Sun, Moon, History, 
  Plus, Search, Settings, PanelLeftClose, PanelLeftOpen,
  LayoutGrid, FileText, Code2, User, Pin, PinOff,
  Share2, Download, Bot, Users, Layers, Workflow
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

        <div className="launch-hero-section">


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

        {/* --- ABOUT SECTION --- */}
        <section className="launch-info-section text-center border-t border-[var(--sc-border-light)] bg-[#fafbfb] dark:bg-[var(--sc-surface-alt)]">
          <div className="info-container">
            <h2 className="info-section-title">What is <span>SparkMap AI?</span></h2>
            <p className="text-[16px] text-[var(--sc-text-secondary)] max-w-2xl mx-auto leading-relaxed mt-4">
              SparkMap AI is a next-generation study workspace that seamlessly fuses the free-form creativity of mind mapping with the rigid structure of relational databases. By converting plain text and uploads into Neo4j-backed knowledge graphs, SparkMap automatically structures your thoughts into interactive topological networks, giving you unparalleled semantic overview over complex topics.
            </p>
          </div>
        </section>

        {/* --- FEATURES SECTION --- */}
        <section className="launch-info-section">
          <div className="info-container">
            <h2 className="info-section-title">Powerful features for <span>deep work</span></h2>
            
            <div className="info-grid">
              <div className="info-card">
                <div className="info-card-image">
                  <img src="/features/ai.png" alt="AI mapping" />
                </div>
                <div className="info-card-content">
                  <div className="info-card-icon blue"><Bot size={24} /></div>
                  <h3>AI-Powered Mapping</h3>
                  <p>Generate expansive, hierarchically structured mind maps from simple keyword prompts in seconds. Let the AI handle the heavy lifting while you connect the concepts.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-image">
                  <img src="/features/document.png" alt="Document Parsing" />
                </div>
                <div className="info-card-content">
                  <div className="info-card-icon purple"><FileText size={24} /></div>
                  <h3>Intelligent Document Parsing</h3>
                  <p>Upload PDFs and let our parsing engine break down dense materials into visual, digestible nodes seamlessly linked by conceptual relevance.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-image">
                  <img src="/features/physics.png" alt="Physics Layout" />
                </div>
                <div className="info-card-content">
                  <div className="info-card-icon orange"><Workflow size={24} /></div>
                  <h3>Force-directed Physics</h3>
                  <p>Enjoy a responsive canvas equipped with automatic layout algorithms and force-directed physics that naturally organize and detangle your nodes dynamically.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-content">
                  <div className="info-card-icon"><Brain size={24} /></div>
                  <h3>Smart Flashcards</h3>
                  <p>Every node becomes a learning opportunity. Instantly generate context-aware Q&A flashcards directly from any node in your graph for active recall.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-content">
                  <div className="info-card-icon blue"><Layers size={24} /></div>
                  <h3>Persistent Workspaces</h3>
                  <p>Backed securely by Neo4j graph databases and local storage fallbacks, ensuring your intricate knowledge webs are never lost and load instantly.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-content">
                  <div className="info-card-icon purple"><Download size={24} /></div>
                  <h3>Export & Share</h3>
                  <p>Download your canvas fully rendered as high-fidelity PNG images natively right from the workspace to share with peers or include in reports.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- COMING SOON SECTION --- */}
        <section className="launch-info-section border-t border-[var(--sc-border-light)] bg-gradient-to-b from-[#fafbfb] to-[#f4f7f6] dark:from-[var(--sc-surface-alt)] dark:to-[var(--sc-canvas-bg)]">
          <div className="info-container">
            <h2 className="info-section-title">What's <span>coming next?</span></h2>
            <p className="text-[16px] text-[var(--sc-text-secondary)] text-center max-w-2xl mx-auto mb-12">
              We're constantly expanding SparkMap's capabilities to make the ultimate knowledge tool. Check out what features are rolling out over the next few updates.
            </p>

            <div className="info-grid opacity-80 mt-0">
              <div className="info-card relative overflow-hidden group hover:opacity-100 transition-opacity p-0">
                <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] z-10"></div>
                <div className="info-card-content relative z-20">
                  <div className="coming-soon-badge relative z-20">Coming Soon</div>
                  <div className="info-card-icon purple relative z-20"><Users size={24} /></div>
                  <h3 className="relative z-20">Real-time Collaboration</h3>
                  <p className="relative z-20">Multiplayer workspace syncing. Collaborate live on identical graphs with your team using WebSockets.</p>
                </div>
              </div>

              <div className="info-card relative overflow-hidden group hover:opacity-100 transition-opacity p-0">
                <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] z-10"></div>
                <div className="info-card-content relative z-20">
                  <div className="coming-soon-badge relative z-20">Coming Soon</div>
                  <div className="info-card-icon orange relative z-20"><Share2 size={24} /></div>
                  <h3 className="relative z-20">Public Link Sharing</h3>
                  <p className="relative z-20">Generate read-only interactive canvas links so external viewers can pan, zoom, and explore your mind maps on the web.</p>
                </div>
              </div>

              <div className="info-card relative overflow-hidden group hover:opacity-100 transition-opacity p-0">
                <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[1px] z-10"></div>
                <div className="info-card-content relative z-20">
                  <div className="coming-soon-badge relative z-20">Coming Soon</div>
                  <div className="info-card-icon blue relative z-20"><Search size={24} /></div>
                  <h3 className="relative z-20">Web Source Integration</h3>
                  <p className="relative z-20">Directly embed and crawl live URLs. SparkMap will scrape websites and automatically convert them into visual nodes.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
