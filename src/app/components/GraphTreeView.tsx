import React from 'react';
import { useStore, NodeData } from '../store/useStore';
import { Node } from '@xyflow/react';
import { 
  ChevronRight, ChevronDown, 
  Layers, Circle, Box, 
  BookOpen, Network 
} from 'lucide-react';

interface TreeItem {
  node: Node<NodeData>;
  children: TreeItem[];
  depth: number;
}

export function GraphTreeView() {
  const { nodes, edges, selectedNodeId, setSelectedNodeId } = useStore();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Toggle expansion state
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  // 1. Build the hierarchical tree structure recursively
  const buildTree = (): TreeItem[] => {
    const rootNodes = nodes.filter(n => n.data.isRoot);
    
    const getChildren = (parentId: string, depth: number): TreeItem[] => {
      if (depth > 5) return []; // Level limit as requested
      
      const childEdges = edges.filter(e => e.source === parentId);
      const childNodes = childEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean) as Node<NodeData>[];
      
      return childNodes.map(node => ({
        node,
        children: getChildren(node.id, depth + 1),
        depth
      }));
    };

    return rootNodes.map(node => ({
      node,
      children: getChildren(node.id, 1),
      depth: 0
    }));
  };

  const treeData = buildTree();

  // 2. Render a recursive tree row
  const renderRow = (item: TreeItem, index?: number) => {
    const { node, children, depth } = item;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = children.length > 0;
    const isConceptNode = !node.data.isRoot && !node.data.isHub;

    // Determine icon based on node type
    const getIcon = () => {
      if (node.data.isRoot) return <Network className="w-3.5 h-3.5 text-[var(--sc-purple)]" />;
      if (node.data.isHub) return <Layers className="w-3.5 h-3.5 text-[var(--sc-green-deep)]" />;
      return <Circle className="w-2.5 h-2.5 text-[var(--sc-blue)] fill-current" />;
    };

    return (
      <div key={node.id} className="flex flex-col">
        {/* The row itself */}
        <div 
          onClick={() => setSelectedNodeId(node.id)}
          className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-[8px] cursor-pointer transition-all hover:bg-[var(--sc-surface-alt)] ${isSelected ? 'bg-[var(--sc-primary-faint)] ring-1 ring-inset ring-[var(--sc-primary-faint)]' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Collapse/Expand Toggle */}
          <div className="w-4 flex items-center justify-center">
            {hasChildren && (
              <button 
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 rounded-sm hover:bg-[var(--sc-border-light)] transition-colors opacity-60 group-hover:opacity-100"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}
          </div>

          <div className="flex-shrink-0">
            {getIcon()}
          </div>

          <span className={`text-[12px] truncate ${isSelected ? 'font-semibold text-[var(--sc-primary)]' : 'text-[var(--sc-text-secondary)] group-hover:text-[var(--sc-text-primary)]'}`}>
            {isConceptNode && typeof index === 'number' ? <span className="opacity-50 mr-1">{index + 1}.</span> : null}
            {node.data.label}
          </span>
          
          {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sc-primary)] shrink-0" />}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col border-l border-[var(--sc-border-light)] ml-[15px] pl-0">
            {children.map((child, idx) => renderRow(child, idx))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--sc-canvas-bg)]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--sc-border-light)] bg-[var(--sc-surface-alt)]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--sc-text-muted)] flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Graph Explorer
        </h3>
        <span className="text-[10px] bg-[var(--sc-border-light)] px-1.5 py-0.5 rounded-full text-[var(--sc-text-muted)] font-mono">
          {nodes.length}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 custom-scrollbar">
        {treeData.length > 0 ? (
          treeData.map(root => renderRow(root))
        ) : (
          <div className="p-8 text-center flex flex-col items-center gap-2 opacity-40">
            <Network className="w-8 h-8" />
            <p className="text-[11px] font-medium leading-relaxed">
              No graph data available.<br/>Generate a mindmap to view its structure.
            </p>
          </div>
        )}
      </div>
      
      <div className="p-2 border-t border-[var(--sc-border-light)] bg-[var(--sc-surface-alt)]">
        <div className="text-[9px] text-center text-[var(--sc-text-muted)] font-medium uppercase tracking-tighter">
          Hierarchical Inheritance (Level 1-5)
        </div>
      </div>
    </div>
  );
}
