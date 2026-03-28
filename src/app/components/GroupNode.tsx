import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '../store/useStore';

// Soft color palette for group clusters
const GROUP_COLORS = [
  { dot: '#7c64b6', bg: 'rgba(124, 100, 182, 0.07)', border: 'rgba(124, 100, 182, 0.25)' },
  { dot: '#4966ff', bg: 'rgba(73, 102, 255, 0.06)',  border: 'rgba(73, 102, 255, 0.22)'  },
  { dot: '#1db37e', bg: 'rgba(29, 179, 126, 0.07)',  border: 'rgba(29, 179, 126, 0.22)'  },
  { dot: '#f59e0b', bg: 'rgba(245, 158, 11, 0.07)',  border: 'rgba(245, 158, 11, 0.22)'  },
  { dot: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)',   border: 'rgba(239, 68, 68, 0.22)'   },
  { dot: '#06b6d4', bg: 'rgba(6, 182, 212, 0.07)',   border: 'rgba(6, 182, 212, 0.22)'   },
  { dot: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.07)',  border: 'rgba(139, 92, 246, 0.22)'  },
  { dot: '#d946ef', bg: 'rgba(217, 70, 239, 0.07)',  border: 'rgba(217, 70, 239, 0.22)'  },
];

// Derive a stable color index from the node label
function getColorIndex(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) & 0xffff;
  }
  return hash % GROUP_COLORS.length;
}

export function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as NodeData;
  const label = nodeData.clusterLabel || 'Concept Group';
  const color = GROUP_COLORS[getColorIndex(label)];

  return (
    <div
      className={`rf-group-node ${selected ? 'selected' : ''}`}
      style={{
        background: selected
          ? `rgba(255,255,255,1)`
          : `rgba(255,255,255,0.7)`,
        borderColor: selected ? color.dot : color.border,
        borderRadius: '500px', // Mathematical Set / Venn circle
      }}
    >
      {/* Group label */}
      <div className="rf-group-label">
        <div
          className="rf-group-pill"
          style={{ background: color.dot }}
        />
        <span style={{ color: color.dot }}>{label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="rf-handle-port"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="rf-handle-port"
      />
    </div>
  );
}
