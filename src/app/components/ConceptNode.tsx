import React, { useState } from 'react';
import { Handle, Position, NodeProps, useViewport } from '@xyflow/react';
import { NodeData, useStore } from '../store/useStore';
import { BookOpen, Info, Zap } from 'lucide-react';

export function ConceptNode({ id, data, selected }: NodeProps) {
  const nodeData = data as NodeData;
  const { zoom } = useViewport();
  const [isHovered, setIsHovered] = useState(false);
  const layoutMode = useStore(s => s.layoutMode);

  // Zoom thresholds for semantic states
  const isImportantNode = nodeData.isRoot || nodeData.isHub;
  const isDot = isImportantNode ? zoom < 0.25 : zoom < 0.45;
  const isBox = isImportantNode ? zoom >= 0.25 : zoom >= 0.60;

  // At high zoom, show full content inline. At normal zoom, use hover card.
  const showFullInline = zoom > 1.2;
  const showHoverCard = isHovered && !showFullInline && (nodeData.description || nodeData.flashcard);

  let themeClass = '';
  if (nodeData.isRoot) {
    themeClass = 'theme-root';
  } else if (nodeData.isHub) {
    themeClass = 'theme-hub-1';
  } else {
    themeClass = 'theme-leaf-2';
  }

  const isLeaf = !nodeData.isRoot && !nodeData.isHub;
  const useLeftHandles = layoutMode === 'topDown' && isLeaf;

  const nodeClass = [
    'rf-pixel-node',
    themeClass,
    isDot ? 'node-dot' : '',
    isBox ? 'node-box' : '',
    selected ? 'selected' : '',
    nodeData.isRoot ? 'node-root' : '',
    nodeData.isHub ? 'node-hub' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={nodeClass}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={useLeftHandles ? Position.Left : Position.Top}
        className="rf-handle-port rf-handle-target"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="rf-handle-port rf-handle-source"
      />

      <div className="node-content-wrapper">
        {/* State 1: Dot */}
        {isDot && (
          <div className="node-dot-indicator">
            {nodeData.isRoot && <Zap className="w-2 h-2 text-white" />}
          </div>
        )}

        {/* State 2: Box */}
        {!isDot && (
          <div className="node-box-inner animate-in fade-in zoom-in duration-300">
            <div className="node-header">
              {nodeData.isRoot ? (
                <div className="node-icon-root"><Zap className="w-3.5 h-3.5" /></div>
              ) : nodeData.isHub ? (
                <div className="node-icon-hub"><Info className="w-3.5 h-3.5" /></div>
              ) : (
                <div className="node-icon-concept"><BookOpen className="w-3.5 h-3.5" /></div>
              )}
              <h3 className="node-title">{nodeData.label}</h3>
            </div>

            {/* Content clip wrapper — keeps text inside node bounds at normal zoom */}
            <div className={showFullInline ? '' : 'node-content-clip'}>
              {isBox && nodeData.description && (
                <p className="node-caption">
                  {nodeData.description.split('.')[0]}.
                </p>
              )}

              {/* Full inline content only at high zoom (>120%) */}
              {showFullInline && nodeData.description && (
                <div className="node-details animate-in slide-in-from-top-1 duration-300">
                  <div className="node-divider" />
                  <p className="node-description">{nodeData.description}</p>
                  {nodeData.flashcard && (
                    <div className="node-flashcard-preview">
                      <div className="node-tag">Flashcard</div>
                      <p className="node-question">Q: {nodeData.flashcard.question}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Hover Detail Card ─────────────────────────────────────
          Appears to the right of the node, above all other canvas nodes.
          Uses position:absolute outside node-content-clip so it's never clipped.
          The parent .node-box has overflow:visible specifically for this.
      ───────────────────────────────────────────────────────────────── */}
      {showHoverCard && (
        <div className="node-hover-card">
          <div className="node-hover-card-title">{nodeData.label}</div>

          {nodeData.description && (
            <>
              <div className="node-hover-card-divider" />
              <p className="node-hover-card-body">{nodeData.description}</p>
            </>
          )}

          {nodeData.flashcard && (
            <div className="node-hover-card-flashcard">
              <div className="node-hover-card-tag">Flashcard</div>
              <p className="node-hover-card-question">❓ {nodeData.flashcard.question}</p>
              <p className="node-hover-card-answer">💡 {nodeData.flashcard.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
