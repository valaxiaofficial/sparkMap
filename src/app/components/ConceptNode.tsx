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

  // Node always stays at its compact size — never expands inline
  const nodeClass = [
    'rf-pixel-node',
    themeClass,
    isDot ? 'node-dot' : '',
    isBox ? 'node-box' : '',
    selected ? 'selected' : '',
    nodeData.isRoot ? 'node-root' : '',
    nodeData.isHub ? 'node-hub' : '',
  ].filter(Boolean).join(' ');

  const hasDetail = nodeData.description || nodeData.flashcard;

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

        {/* State 2: Compact box — never grows, never overlaps */}
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

            {/* Caption always shown in box mode */}
            {isBox && nodeData.description && (
              <p className="node-caption">
                {nodeData.description.split('.')[0]}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Floating Detail Card ────────────────────────────────────────────
          Rendered OUTSIDE the node flow via absolute positioning + high z-index.
          Never occupies layout space → zero overlap possible.
          Appears to the right of the node (or left if near the edge).
      ────────────────────────────────────────────────────────────────── */}
      {isHovered && hasDetail && isBox && (
        <div className="node-hover-card animate-in fade-in zoom-in-95 duration-200">
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
              <p className="node-hover-card-question">Q: {nodeData.flashcard.question}</p>
              <p className="node-hover-card-answer">A: {nodeData.flashcard.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
