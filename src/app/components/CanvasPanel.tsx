import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  NodeTypes,
  Node,
  Edge,
  BackgroundVariant,
  useViewport,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore, NodeData } from '../store/useStore';
import { ConceptNode } from './ConceptNode';
import { GroupNode } from './GroupNode';

import { usePhysicsSimulation } from '../hooks/usePhysicsSimulation';
import { Sparkles, Upload, Plus, BookOpen, Lightbulb, StickyNote, X, RefreshCw, ArrowDownToLine, LayoutDashboard } from 'lucide-react';
import { generateFlashcard } from '../utils/geminiApi';
import { toast } from 'sonner';
import { computeTopDownLayout } from '../utils/topDownLayout';

const nodeTypes: any = {
  concept: ConceptNode,
  group: GroupNode,
};

function ViewportTracker({ onRecenter, layoutMode, setLayoutMode }: {
  onRecenter: () => void;
  layoutMode: 'physics' | 'topDown';
  setLayoutMode: (m: 'physics' | 'topDown') => void;
}) {
  const { zoom } = useViewport();
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const handleRecenter = () => {
    setSpinning(true);
    onRecenter();
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <div className="canvas-controls-group">
      {/* Recenter button — animated reload icon */}
      <button
        className="canvas-control-btn canvas-recenter-btn"
        onClick={handleRecenter}
        title="Recenter view"
      >
        <RefreshCw className={`w-3.5 h-3.5 transition-transform ${spinning ? 'animate-spin' : ''}`} />
      </button>

      {/* View mode button */}
      <div className="relative">
        <button
          className="canvas-control-btn"
          onClick={() => setShowViewMenu(v => !v)}
          title="Change layout view"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
        </button>

        {showViewMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowViewMenu(false)} />
            <div className="absolute bottom-full left-0 mb-2 w-44 bg-[var(--sc-surface-card)] border border-[var(--sc-border)] rounded-[12px] shadow-xl p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="px-2 py-1.5 text-[9px] font-semibold text-[var(--sc-text-muted)] uppercase tracking-wider border-b border-[var(--sc-border-light)] mb-1">View Mode</div>
              <button
                onClick={() => { setLayoutMode('physics'); setShowViewMenu(false); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-[8px] text-[11px] font-medium transition-all ${
                  layoutMode === 'physics'
                    ? 'bg-[var(--sc-primary-light)] text-[var(--sc-primary)]'
                    : 'hover:bg-[var(--sc-surface-hover)] text-[var(--sc-text-primary)]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Default (Physics)</span>
                {layoutMode === 'physics' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--sc-primary)] ml-auto" />}
              </button>
              <button
                onClick={() => { setLayoutMode('topDown'); setShowViewMenu(false); }}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-[8px] text-[11px] font-medium transition-all ${
                  layoutMode === 'topDown'
                    ? 'bg-[var(--sc-primary-light)] text-[var(--sc-primary)]'
                    : 'hover:bg-[var(--sc-surface-hover)] text-[var(--sc-text-primary)]'
                }`}
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>Top Down (Tree)</span>
                {layoutMode === 'topDown' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--sc-primary)] ml-auto" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="canvas-scale-indicator">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

function BackgroundLayer() {
  const { zoom } = useViewport();
  const intensity = Math.min(0.65, Math.max(0.2, zoom * 0.45));
  
  return (
    <Background
      variant={BackgroundVariant.Dots}
      gap={24}
      size={1}
      color={`rgba(132, 165, 157, ${intensity})`}
      className="canvas-background-dots"
    />
  );
}

interface ContextMenu {
  x: number;   // screen px
  y: number;   // screen px
  flowX: number; // canvas coords
  flowY: number;
}

interface QuickCreateModal {
  flowX: number;
  flowY: number;
  mode: 'blank' | 'flashcard' | 'note';
}

function CanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, setSelectedNodeId, setNodes, selectedNodeId, layoutMode, setLayoutMode } = useStore();
  const { screenToFlowPosition, fitView } = useReactFlow();
  
  // Attach physics simulation — only active in physics mode
  usePhysicsSimulation();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [modal, setModal] = useState<QuickCreateModal | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Apply top-down layout when mode switches
  useEffect(() => {
    if (layoutMode === 'topDown' && nodes.length > 0) {
      const arranged = computeTopDownLayout(nodes, edges, null);
      setNodes(arranged);
      setTimeout(() => fitView({ padding: 0.12, duration: 900, maxZoom: 0.52 }), 120);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode]);

  // Recalibrate / Recenter
  const onRecenter = useCallback(() => {
    fitView({ padding: 0.1, duration: 800, maxZoom: 0.52 });
  }, [fitView]);

  // Dynamic Edge Styling + handle routing for top-down leaf columns
  const styledEdges = useMemo(() => {
    // In topDown mode, identify leaf targets so we can route edges to their left side
    const leafIds = layoutMode === 'topDown'
      ? new Set(nodes.filter(n => !n.data.isRoot && !n.data.isHub).map(n => n.id))
      : new Set<string>();

    return edges.map(edge => {
      const isConnected = selectedNodeId === edge.source || selectedNodeId === edge.target;
      const isLeafTarget = leafIds.has(edge.target);

      return {
        ...edge,
        // Route to left handle when leaf target in top-down mode
        targetHandle: layoutMode === 'topDown' && isLeafTarget ? 'left' : undefined,
        type: layoutMode === 'topDown' && isLeafTarget ? 'smoothstep' : 'default',
        animated: isConnected,
        style: {
          stroke: isConnected ? 'var(--sc-primary)' : 'var(--sc-text-muted)',
          strokeWidth: isConnected ? 2 : 1.5,
          strokeDasharray: isConnected ? '0' : '4 4',
          transition: 'all 0.3s ease',
          opacity: isConnected ? 1 : 0.4,
        },
      };
    });
  }, [edges, selectedNodeId, layoutMode, nodes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on pane click (without drag)
  const onPaneClick = useCallback((e: any) => {
    setContextMenu(null);
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // Right-click or long-press on pane → show context menu
  const onPaneContextMenu = useCallback((e: any) => {
    e.preventDefault();
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const screenX = e.clientX;
    const screenY = e.clientY;
    const flowPos = screenToFlowPosition({ x: screenX, y: screenY });

    // Clamp menu so it never goes off-screen
    const menuW = 200;
    const menuH = 160;
    const clampedX = Math.min(screenX, window.innerWidth - menuW - 16);
    const clampedY = Math.min(screenY, window.innerHeight - menuH - 16);

    setContextMenu({ x: clampedX, y: clampedY, flowX: flowPos.x, flowY: flowPos.y });
  }, [screenToFlowPosition]);

  // Double-click on blank pane → quick blank node
  const onPaneDblClick = useCallback((e: any) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setModal({ flowX: flowPos.x, flowY: flowPos.y, mode: 'blank' });
    setLabelInput('');
    setDescInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
    setContextMenu(null);
  }, [screenToFlowPosition]);

  const openModal = useCallback((mode: QuickCreateModal['mode'], menu: ContextMenu) => {
    setModal({ flowX: menu.flowX, flowY: menu.flowY, mode });
    setLabelInput('');
    setDescInput('');
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const createNode = useCallback(async () => {
    if (!modal || !labelInput.trim()) return;
    const id = `concept-${Date.now()}`;

    let flashcard = undefined;
    if (modal.mode === 'flashcard' && descInput.trim()) {
      setIsGenerating(true);
      try {
        flashcard = await generateFlashcard(descInput.trim());
      } catch {
        toast.error('Could not generate flashcard – node created without it.');
      } finally {
        setIsGenerating(false);
      }
    }

    const newNode: Node<NodeData> = {
      id,
      type: 'concept',
      position: { x: modal.flowX - 120, y: modal.flowY - 40 },
      data: {
        label: labelInput.trim(),
        chunkId: 'manual',
        description: descInput.trim() || undefined,
        flashcard,
      },
    };

    setNodes([...nodes, newNode]);
    setSelectedNodeId(id);
    setModal(null);
    toast.success('Node created!');
  }, [modal, labelInput, descInput, nodes, setNodes, setSelectedNodeId]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      createNode();
    }
    if (e.key === 'Escape') {
      setModal(null);
      setContextMenu(null);
    }
  }, [createNode]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    setContextMenu(null);
    if (!node.data.isGroup) {
      setSelectedNodeId(node.id);
    }
  }, [setSelectedNodeId]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={useStore((state) => state.onConnect)}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onPaneDblClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 0.52, minZoom: 0.05 }}
        minZoom={0.05}
        maxZoom={4}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        selectionOnDrag={true}
        panOnDrag={[1, 2, 3, 4]}
        proOptions={{ hideAttribution: true }}
      >
        <BackgroundLayer />
        <Controls className="rf-controls" showInteractive={false} />
        <ViewportTracker onRecenter={onRecenter} layoutMode={layoutMode} setLayoutMode={setLayoutMode} />
      </ReactFlow>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="canvas-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="canvas-context-title">Add to canvas</div>

            <button
              className="canvas-context-item"
              onClick={() => openModal('blank', contextMenu)}
            >
              <span className="canvas-context-icon canvas-context-icon--blank">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span>Blank concept node</span>
            </button>

            <button
              className="canvas-context-item"
              onClick={() => openModal('flashcard', contextMenu)}
            >
              <span className="canvas-context-icon canvas-context-icon--flash">
                <BookOpen className="w-3.5 h-3.5" />
              </span>
              <span>Node + flashcard</span>
            </button>

            <button
              className="canvas-context-item"
              onClick={() => openModal('note', contextMenu)}
            >
              <span className="canvas-context-icon canvas-context-icon--note">
                <StickyNote className="w-3.5 h-3.5" />
              </span>
              <span>Quick note</span>
            </button>

            <div className="canvas-context-hint">
              Or double-click anywhere to create
            </div>
          </div>
        </>
      )}

      {/* ── Quick Create Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setModal(null)}>
          <div
            className="w-[400px] max-w-[90vw] bg-[var(--sc-surface-card)] rounded-[16px] shadow-2xl border border-[var(--sc-border)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sc-border-light)] bg-[var(--sc-surface-alt)]">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-[var(--sc-primary-light)] text-[var(--sc-primary)]">
                  {modal.mode === 'flashcard'
                    ? <BookOpen className="w-4 h-4" />
                    : modal.mode === 'note'
                    ? <StickyNote className="w-4 h-4" />
                    : <Plus className="w-4 h-4" />}
                </div>
                <h3 className="text-[14px] font-bold text-[var(--sc-text-primary)] m-0">
                  {modal.mode === 'flashcard' ? 'New Flashcard Node'
                    : modal.mode === 'note' ? 'Quick Note'
                    : 'New Concept Node'}
                </h3>
              </div>
              <button 
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--sc-border-light)] text-[var(--sc-text-muted)] hover:text-[var(--sc-text-primary)] transition-colors" 
                onClick={() => setModal(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Label */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[var(--sc-text-secondary)] uppercase tracking-wider">
                  {modal.mode === 'note' ? 'Note content' : 'Concept label'}
                </label>
                <input
                  ref={inputRef}
                  className="w-full px-3 py-2.5 bg-[var(--sc-canvas-bg)] border border-[var(--sc-border)] rounded-[8px] text-[13px] text-[var(--sc-text-primary)] placeholder:text-[var(--sc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary-glow)] focus:border-[var(--sc-primary)] transition-all"
                  placeholder={
                    modal.mode === 'note' ? 'Write your note…'
                    : modal.mode === 'flashcard' ? 'e.g. Photosynthesis'
                    : 'e.g. Neural Networks'
                  }
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                />
              </div>

              {/* Description / source text */}
              {modal.mode !== 'note' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[var(--sc-text-secondary)] uppercase tracking-wider">
                    {modal.mode === 'flashcard'
                      ? 'Source text (used to generate flashcard)'
                      : 'Description (optional)'}
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-[var(--sc-canvas-bg)] border border-[var(--sc-border)] rounded-[8px] text-[13px] text-[var(--sc-text-primary)] placeholder:text-[var(--sc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sc-primary-glow)] focus:border-[var(--sc-primary)] transition-all resize-none"
                    placeholder={
                      modal.mode === 'flashcard'
                        ? 'Paste the text you want to turn into a flashcard…'
                        : 'Brief description of this concept…'
                    }
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--sc-border-light)] bg-[var(--sc-surface-alt)]">
              <p className="text-[10px] text-[var(--sc-text-muted)]">Press <strong className="font-semibold text-[var(--sc-text-secondary)]">Enter</strong> to create · <strong className="font-semibold text-[var(--sc-text-secondary)]">Esc</strong> to cancel</p>
              
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-[12px] font-bold text-[var(--sc-text-secondary)] hover:text-[var(--sc-text-primary)] hover:bg-[var(--sc-border-light)] rounded-[6px] transition-colors"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-bold text-white bg-[var(--sc-primary)] hover:bg-[var(--sc-primary-hover)] rounded-[6px] shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={createNode}
                  disabled={!labelInput.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      {modal.mode === 'flashcard' ? 'Create & generate' : 'Create node'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CanvasPanel() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
