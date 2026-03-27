import React, { useCallback, useRef, useState, useMemo } from 'react';
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
import { PDFUploader } from './PDFUploader';
import { usePhysicsSimulation } from '../hooks/usePhysicsSimulation';
import { Sparkles, Upload, Plus, BookOpen, Lightbulb, StickyNote, X } from 'lucide-react';
import { generateFlashcard } from '../utils/geminiApi';
import { toast } from 'sonner';

const nodeTypes: any = {
  concept: ConceptNode,
  group: GroupNode,
};

function ViewportTracker({ onRecenter }: { onRecenter: () => void }) {
  const { zoom } = useViewport();
  return (
    <div className="canvas-controls-group">
      <button 
        className="canvas-control-btn canvas-recenter-btn" 
        onClick={onRecenter}
        title="Recalibrate View (Focus Center)"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>
      <button
        className={`canvas-control-btn ${useStore(s => s.isSimulating) ? 'text-[var(--sc-primary)] bg-[var(--sc-primary-faint)]' : ''}`}
        onClick={useStore(s => s.toggleSimulation)}
        title={useStore(s => s.isSimulating) ? 'Pause Physics Simulation' : 'Resume Physics Simulation'}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider px-1">
          {useStore(s => s.isSimulating) ? 'Pause' : 'Play'}
        </div>
      </button>
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
  const { nodes, edges, onNodesChange, onEdgesChange, setSelectedNodeId, setNodes, selectedNodeId } = useStore();
  const { screenToFlowPosition, fitView } = useReactFlow();
  
  // Attach physics simulation (starts paused by default)
  usePhysicsSimulation();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [modal, setModal] = useState<QuickCreateModal | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Recalibrate / Recenter
  const onRecenter = useCallback(() => {
    fitView({ padding: 0.2, duration: 800 });
  }, [fitView]);

  // Dynamic Edge Styling: Dotted by default, Solid if connected to selected node
  const styledEdges = useMemo(() => {
    return edges.map(edge => {
      const isConnected = selectedNodeId === edge.source || selectedNodeId === edge.target;
      return {
        ...edge,
        animated: isConnected,
        style: {
          stroke: isConnected ? 'var(--sc-primary)' : 'var(--sc-text-muted)',
          strokeWidth: isConnected ? 2 : 1.5,
          strokeDasharray: isConnected ? '0' : '4 4',
          transition: 'all 0.3s ease',
          opacity: isConnected ? 1 : 0.4
        }
      };
    });
  }, [edges, selectedNodeId]);
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
        fitViewOptions={{ padding: 0.15 }}
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
        <ViewportTracker onRecenter={onRecenter} />
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
