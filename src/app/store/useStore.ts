import { create } from 'zustand';
import { Node, Edge, NodeChange, EdgeChange, Connection, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

export interface Chunk {
  id: string;
  text: string;
  embedding?: number[];
  clusterId?: number;
  pageRef?: number;
}

export const SUPPORTED_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-exp-1206', name: 'Gemini Experimental' }
];

export interface Flashcard {
  question: string;
  answer: string;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  chunkId: string;
  description?: string;
  flashcard?: Flashcard;
  isGroup?: boolean;
  isRoot?: boolean;
  isHub?: boolean;
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
  onConnect: (connection: Connection) => void;
  
  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  
  // Layout mode
  layoutMode: 'physics' | 'topDown' | 'leftToRight' | 'symmetric';
  setLayoutMode: (mode: 'physics' | 'topDown' | 'leftToRight' | 'symmetric') => void;
  
  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
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
  
  // Model
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  // Physics Simulation
  isSimulating: boolean;
  setIsSimulating: (isSim: boolean) => void;
  toggleSimulation: () => void;

  // Tour / Navigation
  isTourActive: boolean;
  tourIndex: number;
  tourNodeIds: string[];
  startTour: (nodeIds: string[]) => void;
  stopTour: () => void;
  nextTourNode: () => void;
  prevTourNode: () => void;
  toggleNodeChildren: (nodeId: string) => void;
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
  onConnect: (connection) => set((state) => ({ edges: addEdge({ ...connection, animated: true }, state.edges) })),
  
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  layoutMode: 'physics',
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  
  chatMessages: [],
  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, message].slice(-15) // Increased limit slightly
  })),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  clearChat: () => set({ chatMessages: [] }),
  
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  
  hasSkippedUpload: false,
  setHasSkippedUpload: (hasSkippedUpload) => set({ hasSkippedUpload }),
  
  isWorkspaceActive: false,
  setIsWorkspaceActive: (isActive) => set({ isWorkspaceActive: isActive }),
  initialPrompt: '',
  setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),

  selectedModel: 'gemini-2.5-flash',
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  theme: 'dark',
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    return { theme: next };
  }),
  
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
  })),

  isSimulating: false,
  setIsSimulating: (isSim) => set({ isSimulating: isSim }),
  toggleSimulation: () => set((state) => ({ isSimulating: !state.isSimulating })),

  isTourActive: false,
  tourIndex: 0,
  tourNodeIds: [],
  startTour: (nodeIds) => set({ isTourActive: true, tourIndex: 0, tourNodeIds: nodeIds, selectedNodeId: nodeIds[0] }),
  stopTour: () => set({ isTourActive: false, tourIndex: 0, tourNodeIds: [], selectedNodeId: null }),
  nextTourNode: () => set((state) => {
    const nextIdx = Math.min(state.tourIndex + 1, state.tourNodeIds.length - 1);
    return { 
      tourIndex: nextIdx, 
      selectedNodeId: state.tourNodeIds[nextIdx] 
    };
  }),
  prevTourNode: () => set((state) => {
    const prevIdx = Math.max(state.tourIndex - 1, 0);
    return { 
      prevIdx: prevIdx, 
      tourIndex: prevIdx,
      selectedNodeId: state.tourNodeIds[prevIdx] 
    };
  }),
  toggleNodeChildren: (nodeId) => set((state) => {
    const descendants = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      state.edges.forEach(edge => {
        if (edge.source === currentId && !descendants.has(edge.target)) {
          descendants.add(edge.target);
          stack.push(edge.target);
        }
      });
    }
    const targetNode = state.nodes.find(n => descendants.has(n.id));
    const shouldHide = targetNode ? !targetNode.hidden : true;
    return {
      nodes: state.nodes.map(n => descendants.has(n.id) ? { ...n, hidden: shouldHide } : n),
      edges: state.edges.map(e => (descendants.has(e.source) || descendants.has(e.target)) ? { ...e, hidden: shouldHide } : e)
    };
  })
}));
