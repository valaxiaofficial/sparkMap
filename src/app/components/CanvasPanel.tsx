import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Node,
  Edge,
  BackgroundVariant,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore, NodeData } from '../store/useStore';
import { ConceptNode } from './ConceptNode';
import { GroupNode } from './GroupNode';
import { PDFUploader } from './PDFUploader';
import { Sparkles, Upload } from 'lucide-react';

const nodeTypes: any = {
  concept: ConceptNode,
  group: GroupNode,
};

function ViewportTracker() {
  const { zoom } = useViewport();
  return (
    <div className="canvas-scale-indicator">
      {Math.round(zoom * 100)}%
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

export function CanvasPanel() {
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId } = useStore();

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);

  React.useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  React.useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  React.useEffect(() => {
    setNodes(localNodes);
  }, [localNodes, setNodes]);

  React.useEffect(() => {
    setEdges(localEdges);
  }, [localEdges, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    if (!node.data.isGroup) {
      setSelectedNodeId(node.id);
    }
  }, [setSelectedNodeId]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={4}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={true}
        selectionOnDrag={true}
        panOnDrag={[1, 2, 3, 4]}
        proOptions={{ hideAttribution: true }}
      >
        <BackgroundLayer />
        <Controls className="rf-controls" />
        <ViewportTracker />
      </ReactFlow>
    </div>
  );
}
