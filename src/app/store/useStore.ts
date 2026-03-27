import { create } from 'zustand';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

export interface Chunk {
  id: string;
  text: string;
  embedding?: number[];
  clusterId?: number;
  pageRef?: number;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  chunkId: string;
  flashcard?: Flashcard;
  isGroup?: boolean;
  clusterLabel?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  relevantChunks?: string[];
}

interface StoreState {
  // PDF and chunks
  chunks: Chunk[];
  setChunks: (chunks: Chunk[]) => void;
  
  // Canvas
  nodes: Node<NodeData>[];
  edges: Edge[];
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<Node<NodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  
  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  
  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  
  // Loading states
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  
  // Optional Upload
  hasSkippedUpload: boolean;
  setHasSkippedUpload: (hasSkippedUpload: boolean) => void;
  
  // App Life Cycle
  isWorkspaceActive: boolean;
  setIsWorkspaceActive: (isActive: boolean) => void;
  initialPrompt: string;
  setInitialPrompt: (prompt: string) => void;
  
  // Update node
  updateNode: (nodeId: string, updates: Partial<NodeData>) => void;
  
  // Delete node
  deleteNode: (nodeId: string) => void;
}

export const useStore = create<StoreState>((set) => ({
  chunks: [],
  setChunks: (chunks) => set({ chunks }),
  
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) as Node<NodeData>[] })),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
  
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  
  chatMessages: [],
  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, message].slice(-10) // Keep last 10 messages
  })),
  clearChat: () => set({ chatMessages: [] }),
  
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  
  hasSkippedUpload: false,
  setHasSkippedUpload: (hasSkippedUpload) => set({ hasSkippedUpload }),
  
  isWorkspaceActive: false,
  setIsWorkspaceActive: (isActive) => set({ isWorkspaceActive: isActive }),
  initialPrompt: '',
  setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),
  
  updateNode: (nodeId, updates) => set((state) => ({
    nodes: state.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    )
  })),
  
  deleteNode: (nodeId) => set((state) => ({
    nodes: state.nodes.filter((node) => node.id !== nodeId),
    edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
  }))
}));
