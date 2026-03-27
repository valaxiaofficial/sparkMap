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
        <div className="canvas-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="canvas-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            {/* Header */}
            <div className="canvas-modal-header">
              <div className="canvas-modal-icon">
                {modal.mode === 'flashcard'
                  ? <BookOpen className="w-4 h-4" />
                  : modal.mode === 'note'
                  ? <StickyNote className="w-4 h-4" />
                  : <Plus className="w-4 h-4" />}
              </div>
              <h3 className="canvas-modal-title">
                {modal.mode === 'flashcard' ? 'New Flashcard Node'
                  : modal.mode === 'note' ? 'Quick Note'
                  : 'New Concept Node'}
              </h3>
              <button className="canvas-modal-close" onClick={() => setModal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Label */}
            <div className="canvas-modal-field">
              <label className="canvas-modal-label">
                {modal.mode === 'note' ? 'Note content' : 'Concept label'}
              </label>
              <input
                ref={inputRef}
                className="canvas-modal-input"
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
              <div className="canvas-modal-field">
                <label className="canvas-modal-label">
                  {modal.mode === 'flashcard'
                    ? 'Source text (used to generate flashcard)'
                    : 'Description (optional)'}
                </label>
                <textarea
                  className="canvas-modal-textarea"
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

            {/* Actions */}
            <div className="canvas-modal-actions">
              <button
                className="canvas-modal-cancel"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="canvas-modal-create"
                onClick={createNode}
                disabled={!labelInput.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="canvas-modal-spinner" />
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

            <p className="canvas-modal-hint">Press Enter to create · Esc to cancel</p>
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
