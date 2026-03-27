import React, { useRef, useState } from 'react';
import { CanvasPanel } from './components/CanvasPanel';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { DocUploader } from './components/DocUploader';
import { ExportButtons } from './components/ExportButtons';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Sparkles, Layers, Sun, Moon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { useStore } from './store/useStore';
import { LaunchScreen } from './components/LaunchScreen';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';

export default function App() {
  const { isProcessing, nodes, isWorkspaceActive, theme, toggleTheme } = useStore();
  
  // Panel state tracking
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Apply dark class on initial mount (default = dark)
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (!isWorkspaceActive) {
    return (
      <>
        <LaunchScreen />
        <Toaster />
        <LoadingOverlay isVisible={isProcessing} message="Building your knowledge map…" />
      </>
    );
  }

  const toggleLeft = () => {
    const p = leftPanelRef.current;
    if (!p) return;
    if (p.isCollapsed()) { p.expand(); }
    else { p.collapse(); }
  };

  const toggleRight = () => {
    const p = rightPanelRef.current;
    if (!p) return;
    if (p.isCollapsed()) { p.expand(); }
    else { p.collapse(); }
  };

  return (
    <div className="app-shell animate-fade-in">
      {/* ── Top Header ── */}
      <header className="header">
         {/* Left Controls & Brand */}
         <div className="header-brand">
          <button className="panel-toggle-btn" onClick={toggleLeft} title="Toggle Left Panel">
            {leftOpen ? <PanelLeftClose className="w-5 h-5 text-current opacity-70" /> : <PanelLeftOpen className="w-5 h-5 text-current opacity-70" />}
          </button>
          
          <div className="header-logo ml-2">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col ml-1">
            <h1 className="header-title">Sparkmap</h1>
            <p className="header-subtitle">AI-Powered Study Workspace</p>
          </div>

        </div>

        {/* Right actions */}
        <div className="header-actions">
          <ExportButtons />
          <div style={{ width: 1, height: 20, background: 'var(--sc-border-light)', flexShrink: 0, marginLeft: 8 }} />
          {/* Theme toggle */}
          <button
            className="theme-toggle"
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
          
          <div style={{ width: 1, height: 20, background: 'var(--sc-border-light)', flexShrink: 0, marginLeft: 4 }} />
          <button className="panel-toggle-btn" onClick={toggleRight} title="Toggle Right Panel">
            {rightOpen ? <PanelRightClose className="w-5 h-5 text-current opacity-70" /> : <PanelRightOpen className="w-5 h-5 text-current opacity-70" />}
          </button>
        </div>
      </header>

      {/* ── Flexible Resizable Layout ── */}
      <div className="app-workspace-body">
        <PanelGroup direction="horizontal">
          
          {/* Left Panel */}
          <Panel
            ref={leftPanelRef}
            collapsible
            defaultSize={20}
            minSize={0} // Allows complete collapse
            maxSize={30}
            onCollapse={() => setLeftOpen(false)}
            onExpand={() => setLeftOpen(true)}
            className="panel-left"
          >
            <LeftPanel />
          </Panel>

          <PanelResizeHandle className="custom-resize-handle" />

          {/* Canvas Center Panel */}
          <Panel defaultSize={60} minSize={30} className="panel-canvas relative">
            <CanvasPanel />
          </Panel>

          <PanelResizeHandle className="custom-resize-handle" />

          {/* Right Panel (Chat) */}
          <Panel
            ref={rightPanelRef}
            collapsible
            defaultSize={22}
            minSize={0} // Allows complete collapse
            maxSize={35}
            onCollapse={() => setRightOpen(false)}
            onExpand={() => setRightOpen(true)}
            className="panel-right"
          >
            <RightPanel />
          </Panel>

        </PanelGroup>
      </div>

      <LoadingOverlay isVisible={isProcessing} message="Building your knowledge map…" />
      <Toaster />
    </div>
  );
}
