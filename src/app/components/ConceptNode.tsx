import React, { useState, useMemo } from 'react';
import { Handle, Position, NodeProps, useViewport } from '@xyflow/react';
import { NodeData, useStore } from '../store/useStore';
import { BookOpen, Info, Zap, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

export function ConceptNode({ id, data, selected }: NodeProps) {
  const nodeData = data as NodeData;
  const { zoom } = useViewport();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLabel, setEditedLabel] = useState(nodeData.label);
  
  const { 
    updateNode, 
    isTourActive, 
    tourIndex, 
    tourNodeIds, 
    nextTourNode, 
    prevTourNode, 
    toggleNodeChildren, 
    edges,
    layoutMode
  } = useStore();
  
  const isSelectedInTour = isTourActive && tourNodeIds[tourIndex] === id;
  const hasChildren = useMemo(() => edges.some(e => e.source === id), [edges, id]);

  const saveEdit = () => {
    if (editedLabel.trim() && editedLabel !== nodeData.label) {
      updateNode(id, { label: editedLabel.trim() });
    }
    setIsEditing(false);
  };

  // Zoom thresholds for semantic states
  const isImportantNode = nodeData.isRoot || nodeData.isHub;
  const isDot = isImportantNode ? zoom < 0.25 : zoom < 0.45;
  const isBox = !isDot;

  const nodeClass = `rf-pixel-node 
    ${isDot ? 'node-dot' : 'node-box'} 
    ${selected ? 'selected' : ''} 
    ${nodeData.isRoot ? 'theme-root' : ''} 
    ${nodeData.isHub ? 'theme-hub' : ''}
    ${isSelectedInTour ? 'node-tour-focus' : ''}
  `;

  const useLeftHandles = layoutMode === 'leftToRight';

  return (
    <div
      className={nodeClass}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => !isTourActive && setIsEditing(true)}
    >
      {/* Tour Navigation Overlay */}
      {isSelectedInTour && (
        <div className="node-tour-controls animate-in fade-in slide-in-from-top-2">
          <button className="tour-nav-btn" onClick={(e) => { e.stopPropagation(); prevTourNode(); }} disabled={tourIndex === 0}>
            <ChevronLeft size={14} />
          </button>
          <div className="tour-status">{tourIndex + 1} / {tourNodeIds.length}</div>
          <button className="tour-nav-btn" onClick={(e) => { e.stopPropagation(); nextTourNode(); }} disabled={tourIndex === tourNodeIds.length - 1}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Collapse/Expand Toggle */}
      {hasChildren && !isEditing && isBox && (
        <button 
          className="node-collapse-btn" 
          onClick={(e) => { e.stopPropagation(); toggleNodeChildren(id); }}
          title="Toggle Children"
        >
          {edges.some(e => e.source === id && e.hidden) ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
      )}

      <Handle
        type="target"
        position={useLeftHandles ? Position.Left : Position.Top}
        className="rf-handle-port rf-handle-target"
      />

      <div className="node-content-wrapper">
        {isDot ? (
          <div className="node-dot-indicator">
            {nodeData.isRoot && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
          </div>
        ) : (
          <div className="node-box-inner p-3">
            <div className="node-header flex items-center gap-2 mb-1">
              {nodeData.isRoot ? (
                <div className="node-icon-root"><Zap className="w-3.5 h-3.5" /></div>
              ) : nodeData.isHub ? (
                <div className="node-icon-hub"><Info className="w-3.5 h-3.5" /></div>
              ) : (
                <div className="node-icon-concept"><BookOpen className="w-3.5 h-3.5" /></div>
              )}
              {isEditing ? (
                <input
                  autoFocus
                  className="node-edit-input"
                  value={editedLabel}
                  onChange={e => setEditedLabel(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <h3 className="node-title text-[13px] font-bold m-0 leading-tight">{nodeData.label}</h3>
              )}
            </div>

            {nodeData.description && zoom > 0.8 && (
               <p className="node-description text-[11px] text-[var(--sc-text-secondary)] line-clamp-2 m-0 mt-1 leading-relaxed">
                 {nodeData.description}
               </p>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={useLeftHandles ? Position.Right : Position.Bottom}
        className="rf-handle-port rf-handle-source"
      />
    </div>
  );
}
