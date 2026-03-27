import React from 'react';
import { CanvasPanel } from './components/CanvasPanel';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { PDFUploader } from './components/PDFUploader';
import { ExportButtons } from './components/ExportButtons';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Sparkles, Layers, Sun, Moon } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { useStore } from './store/useStore';
import { LaunchScreen } from './components/LaunchScreen';

export default function App() {
  const { isProcessing, nodes, isWorkspaceActive, theme, toggleTheme } = useStore();

  // Apply dark class on initial mount (default = dark)
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  if (!isWorkspaceActive) {
    return (
      <>
        <LaunchScreen />
        <Toaster />
        <LoadingOverlay isVisible={isProcessing} message="Building your knowledge map…" />
      </>
    );
  }

  return (
    <div className="app-shell animate-fade-in">
      {/* ── Top Header ── */}
      <header className="header">
        {/* Brand */}
        <div className="header-brand">
          <div className="header-logo">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="header-title">Sparkmap</h1>
            <p className="header-subtitle">AI-Powered Study Workspace</p>
          </div>

          <div className="header-divider" />

          {/* Status / info tag */}
          {nodes.length > 0 ? (
            <div className="header-tag">
              <Layers className="w-3 h-3" />
              {nodes.filter(n => !n.data.isGroup).length} concepts
            </div>
          ) : (
            <div className="header-tag">
              <span>Personal Space</span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="header-actions">
          <PDFUploader />
          <div style={{ width: 1, height: 20, background: 'var(--sc-border-light)', flexShrink: 0 }} />
          <ExportButtons />
          <div style={{ width: 1, height: 20, background: 'var(--sc-border-light)', flexShrink: 0 }} />
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
        </div>
      </header>

      {/* ── Left Panel — Node Editor ── */}
      <aside className="panel-left">
        <LeftPanel />
      </aside>

      {/* ── Center Panel — Canvas ── */}
      <main className="panel-canvas">
        <CanvasPanel />
      </main>

      {/* ── Right Panel — Chat ── */}
      <aside className="panel-right">
        <RightPanel />
      </aside>

      <LoadingOverlay isVisible={isProcessing} message="Building your knowledge map…" />
      <Toaster />
    </div>
  );
}
