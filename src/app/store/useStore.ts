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
  toggleSimulation: () => set((state) => ({ isSimulating: !state.isSimulating }))
}));
