# Sparkmap - AI-Powered Study Workspace

An intelligent study workspace that transforms academic PDFs into interactive visual knowledge maps with AI-powered clustering, flashcard generation, and contextual Q&A.

## 🌟 Features

### Core Functionality

- **PDF Upload & Processing**: Upload academic PDFs (up to 10MB) and automatically extract text content
- **AI-Powered Clustering**: Semantic embeddings and k-means clustering to group related concepts
- **Visual Canvas**: Interactive React Flow canvas with zoomable, pannable node graphs
- **Auto-Generated Flashcards**: LLM creates study flashcards for each concept node
- **Intelligent Chat**: RAG-based Q&A system that answers questions using your study materials
- **Export Options**: 
  - Export canvas as PNG (html2canvas)
  - Export flashcard deck as PDF (jsPDF)

### Three-Panel Interface

1. **Left Panel**: Edit node properties, view source text, manage flashcards
2. **Center Panel**: Interactive canvas with concept nodes and cluster groups
3. **Right Panel**: AI chat assistant for contextual Q&A

## 🛠️ Technical Stack

### Frontend
- **React 18** with TypeScript
- **React Flow (@xyflow/react)** for canvas visualization
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Radix UI** components for UI primitives

### AI & ML
- **Google Gemini API** (gemini-1.5-flash for text generation)
- **Gemini Embeddings** (text-embedding-004 for semantic search)
- **K-means clustering** for concept grouping
- **RAG (Retrieval-Augmented Generation)** for contextual chat

### PDF & Export
- **pdfjs-dist** for PDF parsing
- **html2canvas** for canvas PNG export
- **jsPDF** for flashcard PDF export

### Backend
- **Supabase Edge Functions** with Hono web server
- Secure API key management (GEMINI_API_KEY stored server-side)
- Rate limiting and input validation

## 🚀 How It Works

### 1. PDF Ingestion
```
Upload PDF → Parse text → Split into 300-token chunks (50 overlap)
```

### 2. AI Processing
```
Generate embeddings → K-means clustering → Create cluster labels
```

### 3. Canvas Generation
```
Render clusters as group nodes → Create concept nodes → Auto-layout
```

### 4. Flashcard Generation
```
For each concept node → LLM generates Q&A pair → Store in node data
```

### 5. RAG Chat
```
User query → Embed query → Find top-3 similar chunks → Generate answer with context
```

## 📋 API Endpoints

All endpoints are prefixed with `/make-server-edd888a5/api/`

- `POST /embed` - Generate embeddings for text chunks
- `POST /generate-label` - Generate cluster labels from text excerpts
- `POST /generate-flashcard` - Create Q&A flashcard from text
- `POST /chat` - RAG-based chat with context retrieval

## 🔐 Security Features

- ✅ API key stored server-side only (never exposed to frontend)
- ✅ File validation (PDF MIME type, 10MB limit)
- ✅ Input sanitization before LLM injection
- ✅ Rate limiting on API routes
- ✅ CORS enabled for proper request handling

## 🎯 Usage Instructions

### Setup
1. Add your Google Gemini API key to the Supabase secrets as `GEMINI_API_KEY`
2. Get a free API key at: https://aistudio.google.com/app/apikey

### Using Sparkmap
1. **Upload PDF**: Click "Upload PDF" and select an academic document
2. **Wait for Processing**: AI will parse, chunk, embed, and cluster your content
3. **Explore Canvas**: Zoom, pan, and click on concept nodes to explore
4. **Edit Nodes**: Click a node to view/edit in the left panel
5. **Generate Flashcards**: Click "Generate Flashcard" for any node
6. **Chat**: Ask questions in the right panel for AI-powered answers
7. **Export**: Save your canvas as PNG or flashcards as PDF

## 🧩 Component Architecture

```
App.tsx
├── PDFUploader.tsx (file upload & processing)
├── LeftPanel.tsx (node editor)
├── CanvasPanel.tsx (React Flow canvas)
│   ├── ConceptNode.tsx
│   ├── GroupNode.tsx
│   └── WelcomeScreen.tsx
├── RightPanel.tsx (AI chat)
└── ExportButtons.tsx (PNG/PDF export)
```

## 📊 State Management (Zustand)

- `chunks[]` - Parsed text chunks with embeddings
- `nodes[]` - React Flow nodes (concepts + groups)
- `edges[]` - React Flow edges (connections)
- `chatMessages[]` - Chat history (capped at 10)
- `selectedNodeId` - Currently selected node
- `isProcessing` - Loading state

## 🎨 Design Highlights

- Clean three-panel layout with resizable panels
- Gradient brand colors (blue-600 to purple-600)
- Visual distinction between concept nodes and cluster groups
- Responsive toast notifications (Sonner)
- Loading states with spinners
- Welcome screen for first-time users

## 🔄 Future Enhancements (Not Yet Implemented)

- PPT export with pptxgenjs
- Multi-file PDF merging
- Cross-PDF canvas linking
- YouTube transcript import
- Offline embeddings with transformers.js
- Persistent storage in Supabase database
- Collaborative editing

## 📝 Differentiation

### vs NotebookLM
- ✅ Visual spatial canvas (not just chat)
- ✅ Concept clustering with embeddings
- ✅ Node-level flashcards
- ✅ Bidirectional linking (chat → canvas highlighting)

### vs Miro AI / Whimsical AI
- ✅ Academic-specific (not general whiteboard)
- ✅ Auto-generates study materials
- ✅ Maps to exam topics, not generic shapes

### vs ChatGPT with PDF
- ✅ Visual map of entire subject
- ✅ Spatial memory layout
- ✅ Big picture + zoom capability
- ✅ Integrated flashcard generation

## 🐛 Known Limitations

- 10MB PDF size limit
- Max 10 chat messages in history (token management)
- K-means k value auto-selected (max 8 clusters)
- No persistent storage (session-based)
- Requires Google Gemini API key

## 📄 License

Built for educational purposes and hackathon demos.

---

**Powered by Google Gemini AI • Built with React Flow • Styled with Tailwind CSS**
