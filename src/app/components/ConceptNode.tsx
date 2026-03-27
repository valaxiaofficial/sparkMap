import React, { useState } from 'react';
import { Handle, Position, NodeProps, useViewport } from '@xyflow/react';
import { NodeData } from '../store/useStore';
import { BookOpen, Info, Zap } from 'lucide-react';

export function ConceptNode({ data, selected }: NodeProps) {
  const nodeData = data as NodeData;
  const { zoom } = useViewport();
  const [isHovered, setIsHovered] = useState(false);

  // Zoom thresholds for semantic states
  const isImportantNode = nodeData.isRoot || nodeData.isHub;
  const isDot = isImportantNode ? zoom < 0.25 : zoom < 0.45;
  const isBox = isImportantNode ? zoom >= 0.25 : zoom >= 0.60;
  // Determine if we should show the "Detailed" view (either high zoom or hover)
  const showFull = isHovered || zoom > 1.2;

  // Base classes for Pixel OS aesthetic
  const nodeClass = [
    'rf-pixel-node',
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
        position={Position.Top}
        className="rf-handle-port"
      />

      <div className="node-content-wrapper">
        {/* State 1: Dot (Minimal topology) */}
        {isDot && (
          <div className="node-dot-indicator">
             {nodeData.isRoot && <Zap className="w-2 h-2 text-white" />}
          </div>
        )}

        {/* State 2: Box (Title + Caption) */}
        {!isDot && (
          <div className="node-box-inner animate-in fade-in zoom-in duration-300">
            <div className="node-header">
              {nodeData.isRoot ? (
                <div className="node-icon-root">
                   <Zap className="w-3.5 h-3.5" />
                </div>
              ) : nodeData.isHub ? (
                <div className="node-icon-hub">
                   <Info className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="node-icon-concept">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
              )}
              <h3 className="node-title">{nodeData.label}</h3>
            </div>

            {/* Subtitle/Caption (visible when in Box mode) */}
            {(isBox || showFull) && (
              <p className="node-caption">
                {nodeData.description?.split('.')[0]}.
              </p>
            )}

            {/* Full Content (visible on hover or extreme zoom) */}
            {showFull && nodeData.description && (
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
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="rf-handle-port"
      />
    </div>
  );
}
