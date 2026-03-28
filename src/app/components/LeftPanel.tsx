import React from 'react';
import { useStore } from '../store/useStore';
import { RefreshCw, Trash2, BookOpen, FileText, Tag, PanelBottomClose, PanelBottomOpen } from 'lucide-react';
import { generateFlashcard } from '../utils/geminiApi';
import { toast } from 'sonner';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GraphTreeView } from './GraphTreeView';

export function LeftPanel() {
  const { selectedNodeId, nodes, chunks, updateNode, deleteNode, isProcessing } = useStore();
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [editedLabel, setEditedLabel] = React.useState('');

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const chunk = chunks.find(c => c.id === selectedNode?.data.chunkId);

  React.useEffect(() => {
    if (selectedNode) {
      setEditedLabel(selectedNode.data.label);
    }
  }, [selectedNode]);

  const handleUpdateLabel = () => {
    if (selectedNodeId && editedLabel.trim()) {
      updateNode(selectedNodeId, { label: editedLabel.trim() });
      toast.success('Label updated');
    }
  };

  const handleRegenerateFlashcard = async () => {
    if (!chunk || !selectedNodeId) return;
    setIsRegenerating(true);
    try {
      const flashcard = await generateFlashcard(chunk.text);
      updateNode(selectedNodeId, { flashcard });
      toast.success('Flashcard regenerated');
    } catch (error) {
      toast.error('Failed to regenerate flashcard');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = () => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
      toast.success('Node deleted');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--sc-surface-panel)] border-r border-[var(--sc-border-light)] overflow-hidden">
      <PanelGroup direction="vertical">
        {/* TOP: Node Properties / Selection Details */}
        <Panel defaultSize={55} minSize={20} className="flex flex-col bg-[var(--sc-canvas-bg)]">
          {!selectedNode ? (
            /* ── Selection Placeholder ── */
            <div className="panel-empty animate-fade-in flex flex-col items-center justify-center h-full p-8 text-center bg-[var(--sc-canvas-bg)]">
              <div className="panel-empty-icon mb-4">
                <BookOpen className="w-10 h-10 text-[var(--sc-purple)] opacity-30" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--sc-blue-text)] mb-1">
                  Topic Focus View
                </p>
                <p className="text-[11px] text-[var(--sc-text-muted)] leading-relaxed font-medium">
                  Select any node in the tree or on the canvas to inspect its details and flashcards.
                </p>
              </div>
            </div>
          ) : (
            /* ── Active Selection UI ── */
            <div className="animate-fade-in custom-scrollbar p-5 overflow-y-auto h-full" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Properties Section */}
              <div className="panel-section-label !mt-0">Node Properties</div>
              
              <div className="property-card flex flex-col gap-12 bg-[var(--sc-surface-alt)] p-4 rounded-[12px] border border-[var(--sc-border-light)]">
                {/* ID/Type Row */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-[var(--sc-text-muted)] tracking-widest uppercase">
                    Ref: {selectedNode.id.split('-')[0]}...
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--sc-border-light)] text-[var(--sc-text-muted)] uppercase font-bold">
                    {selectedNode.data.isHub ? 'Hub' : selectedNode.data.isRoot ? 'Root' : 'Concept'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--sc-text-secondary)] uppercase tracking-tight mb-2">
                    <Tag size={12} className="text-[var(--sc-primary)]" />
                    Instance Label
                  </div>
                  <div className="text-[16px] font-bold text-[var(--sc-text-primary)] leading-tight">
                    {selectedNode.data.label}
                  </div>
                </div>

                {chunk && (
                  <div className="mt-2 text-sm text-[var(--sc-text-secondary)]">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight mb-2">
                      <FileText size={12} className="text-[var(--sc-primary)]" />
                      Document Source
                    </div>
                    <div className="p-3 bg-[var(--sc-canvas-bg)] rounded-[8px] border border-[var(--sc-border-light)] text-[11px] leading-relaxed max-h-[100px] overflow-y-auto italic">
                      {chunk.text}
                    </div>
                  </div>
                )}
              </div>

              {/* Flashcard Section */}
              <div className="panel-section-label">Flashcard System</div>
              <div className="property-card bg-[var(--sc-surface-alt)] p-4 rounded-[12px] border border-[var(--sc-border-light)]">
                {selectedNode.data.flashcard ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 border-l-2 border-[var(--sc-blue)] pl-3">
                      <span className="text-[9px] font-black tracking-widest text-[var(--sc-blue)] uppercase">Question</span>
                      <p className="text-[12px] leading-snug font-medium">{selectedNode.data.flashcard.question}</p>
                    </div>
                    <div className="flex flex-col gap-1 border-l-2 border-[var(--sc-green-deep)] pl-3">
                      <span className="text-[9px] font-black tracking-widest text-[var(--sc-green-deep)] uppercase">Mentor Answer</span>
                      <p className="text-[12px] leading-snug text-[var(--sc-text-secondary)]">{selectedNode.data.flashcard.answer}</p>
                    </div>
                    <button
                      onClick={handleRegenerateFlashcard}
                      disabled={isRegenerating}
                      className="btn-action w-full mt-2 bg-[var(--sc-surface-panel)] border-[var(--sc-border-light)] text-[11px] font-bold"
                    >
                      <RefreshCw size={11} className={isRegenerating ? 'animate-spin' : ''} />
                      Refine Knowledge Base
                    </button>
                  </div>
                ) : (
                  <button onClick={handleRegenerateFlashcard} disabled={isRegenerating} className="btn-action w-full">
                    <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                    {isProcessing ? 'Generating...' : 'Construct Flashcard'}
                  </button>
                )}
              </div>

              {/* Actions Section */}
              <div className="mt-auto pt-6">
                <button onClick={handleDelete} className="btn-action btn-danger w-full">
                  <Trash2 size={13} />
                  Purge Instance
                </button>
              </div>
            </div>
          )}
        </Panel>

        {/* Vertical Resize Handle */}
        <PanelResizeHandle className="h-[4px] relative bg-[var(--sc-border-light)] hover:bg-[var(--sc-primary)] hover:opacity-50 transition-all cursor-row-resize" title="Drag to Resize Graph Tree">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1">
             <div className="w-1 h-1 rounded-full bg-[var(--sc-text-muted)] opacity-50" />
             <div className="w-1 h-1 rounded-full bg-[var(--sc-text-muted)] opacity-50" />
             <div className="w-1 h-1 rounded-full bg-[var(--sc-text-muted)] opacity-50" />
          </div>
        </PanelResizeHandle>

        {/* BOTTOM: Graph Tree Explorer */}
        <Panel defaultSize={45} minSize={20} className="flex flex-col">
          <GraphTreeView />
        </Panel>
      </PanelGroup>
    </div>
  );
}