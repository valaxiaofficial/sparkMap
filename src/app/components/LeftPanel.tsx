import React from 'react';
import { useStore } from '../store/useStore';
import { RefreshCw, Trash2, BookOpen, FileText, Tag } from 'lucide-react';
import { generateFlashcard } from '../utils/geminiApi';
import { toast } from 'sonner';

export function LeftPanel() {
  const { selectedNodeId, nodes, chunks, updateNode, deleteNode } = useStore();
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

  /* ── Empty state ── */
  if (!selectedNode) {
    return (
      <div className="panel-empty animate-fade-in">
        <div className="panel-empty-icon">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--sc-blue-text)',
              marginBottom: 4,
            }}
          >
            No node selected
          </p>
          <p style={{ fontSize: 12, color: 'var(--sc-text-muted)', lineHeight: 1.5 }}>
            Click any concept node on the canvas to view and edit its properties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* ── Section: Node Properties ── */}
      <div className="panel-section-label" style={{ marginTop: 2 }}>Node Properties</div>

      <div className="property-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Label row */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--sc-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Tag style={{ width: 10, height: 10 }} />
            Label
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <input
              type="text"
              value={editedLabel}
              onChange={e => setEditedLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdateLabel()}
              className="property-input"
              placeholder="Node label…"
            />
            <button
              onClick={handleUpdateLabel}
              className="btn-action"
              style={{ padding: '5px 12px', flexShrink: 0 }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Source text */}
        {chunk && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--sc-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <FileText style={{ width: 10, height: 10 }} />
              Source Text
              {chunk.pageRef && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontWeight: 400,
                    fontSize: 10,
                    color: 'var(--sc-text-muted)',
                    textTransform: 'none',
                    letterSpacing: 0,
                  }}
                >
                  Page {chunk.pageRef}
                </span>
              )}
            </div>
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--sc-surface)',
                borderRadius: 8,
                border: '1px solid var(--sc-border-light)',
                fontSize: 12,
                color: 'var(--sc-text-secondary)',
                lineHeight: 1.65,
                maxHeight: 120,
                overflowY: 'auto',
              }}
            >
              {chunk.text}
            </div>
          </div>
        )}
      </div>

      {/* ── Section: Flashcard ── */}
      <div className="panel-section-label">Flashcard</div>

      <div className="property-card">
        {selectedNode.data.flashcard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Question */}
            <div className="flashcard" style={{ borderLeftColor: 'var(--sc-blue)' }}>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: 'var(--sc-blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 5,
                }}
              >
                Question
              </div>
              <div>{selectedNode.data.flashcard.question}</div>
            </div>

            {/* Answer */}
            <div className="flashcard" style={{ borderLeftColor: '#1db37e' }}>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: '#1db37e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 5,
                }}
              >
                Answer
              </div>
              <div>{selectedNode.data.flashcard.answer}</div>
            </div>

            <button
              onClick={handleRegenerateFlashcard}
              disabled={isRegenerating}
              className="btn-action"
              style={{ width: '100%', marginTop: 2 }}
            >
              <RefreshCw
                style={{ width: 12, height: 12 }}
                className={isRegenerating ? 'animate-spin' : ''}
              />
              Regenerate Flashcard
            </button>
          </div>
        ) : (
          <button
            onClick={handleRegenerateFlashcard}
            disabled={isRegenerating}
            className="btn-action"
            style={{ width: '100%' }}
          >
            <RefreshCw
              style={{ width: 12, height: 12 }}
              className={isRegenerating ? 'animate-spin' : ''}
            />
            {isRegenerating ? 'Generating…' : 'Generate Flashcard'}
          </button>
        )}
      </div>

      {/* ── Delete node ── */}
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button
          onClick={handleDelete}
          className="btn-action btn-danger"
          style={{ width: '100%' }}
        >
          <Trash2 style={{ width: 13, height: 13 }} />
          Delete Node
        </button>
      </div>
    </div>
  );
}