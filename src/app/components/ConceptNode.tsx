import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../store/useStore';
import { BookOpen } from 'lucide-react';

export function ConceptNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={`rf-chunk-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 8, height: 8 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Node label */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--sc-text-primary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.label}
        </div>

        {/* Flashcard badge */}
        {data.flashcard && (
          <div className="rf-flashcard-badge">
            <BookOpen style={{ width: 9, height: 9 }} />
            <span>Flashcard</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 8, height: 8 }}
      />
    </div>
  );
}
