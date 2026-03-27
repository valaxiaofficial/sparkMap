import React from 'react';
import { Upload, Loader2, FileText, File as FileIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseDocument, splitIntoChunks } from '../utils/documentParser';
import { embedChunks, generateClusterLabel, generateFlashcard } from '../utils/geminiApi';
import { kMeansClustering, selectOptimalK } from '../utils/clustering';
import { toast } from 'sonner';
import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../store/useStore';
import { saveWorkspaceToNeo4j } from '../utils/neo4jdb';

interface DocUploaderProps {
  compact?: boolean;
  onUploadSuccess?: () => void;
}

export function DocUploader({ compact = false, onUploadSuccess }: DocUploaderProps) {
  const { setChunks, setNodes, setEdges, setIsProcessing, isProcessing, setIsWorkspaceActive } = useStore();
  const [fileName, setFileName] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setIsProcessing(true);
    
    try {
      toast.info(`Parsing ${file.name}...`);
      const text = await parseDocument(file);
      
      if (!text || text.trim().length < 50) {
        toast.error('Document appears to be empty or contains too little text');
        setIsProcessing(false);
        return;
      }
      
      toast.info('Analyzing content structure...');
      const chunks = splitIntoChunks(text, 600, 100);
      
      if (chunks.length === 0) {
        toast.error('No readable content found');
        setIsProcessing(false);
        return;
      }
      
      toast.info(`Mapping ${chunks.length} knowledge segments...`);
      const embeddedChunks = await embedChunks(chunks);
      setChunks(embeddedChunks);
      
      toast.info('Architecting concept clusters...');
      const k = selectOptimalK(embeddedChunks);
      const clusters = kMeansClustering(embeddedChunks, k);
      
      toast.info('Visualizing workspace...');
      const nodes: Node<NodeData>[] = [];
      const edges: Edge[] = [];
      
      let nodeY = 0;
      const clusterSpacing = 400;
      const nodeSpacing = 160;
      
      let clusterIndex = 0;
      for (const [clusterId, clusterChunks] of clusters.entries()) {
        const clusterTexts = clusterChunks.slice(0, 3).map(c => c.text);
        const clusterLabel = await generateClusterLabel(clusterTexts);
        
        const groupNodeId = `group-${clusterId}`;
        nodes.push({
          id: groupNodeId,
          type: 'group',
          position: { x: 100, y: nodeY },
          data: {
            label: clusterLabel,
            chunkId: '',
            isGroup: true,
            clusterLabel
          }
        });
        
        nodeY += 120;
        
        for (let i = 0; i < clusterChunks.length; i++) {
          const chunk = clusterChunks[i];
          const nodeId = `node-${chunk.id}`;
          
          try {
            const flashcard = await generateFlashcard(chunk.text);
            nodes.push({
              id: nodeId,
              type: 'concept',
              position: { x: 250 + (i % 3) * 320, y: nodeY + Math.floor(i / 3) * nodeSpacing },
              data: {
                label: chunk.text.slice(0, 60).trim() + '...',
                chunkId: chunk.id,
                flashcard
              }
            });
          } catch (error) {
            nodes.push({
              id: nodeId,
              type: 'concept',
              position: { x: 250 + (i % 3) * 320, y: nodeY + Math.floor(i / 3) * nodeSpacing },
              data: {
                label: chunk.text.slice(0, 60).trim() + '...',
                chunkId: chunk.id
              }
            });
          }
          
          edges.push({
            id: `edge-${groupNodeId}-${nodeId}`,
            source: groupNodeId,
            target: nodeId,
            type: 'smoothstep',
            animated: false
          });
        }
        
        nodeY += Math.ceil(clusterChunks.length / 3) * nodeSpacing + clusterSpacing;
        clusterIndex++;
      }
      
      setNodes(nodes);
      setEdges(edges);
      
      // Save to Neo4j
      toast.info('Cloud archiving starting...');
      await saveWorkspaceToNeo4j(file.name, nodes as any, edges as any);
      
      setIsWorkspaceActive(true);
      if (onUploadSuccess) onUploadSuccess();
      
      toast.success(`Success! Generated map from ${file.name}`);
    } catch (error) {
      console.error('Extraction Error:', error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.md,.markdown,.txt"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center w-8 h-8 rounded-full bg-[var(--sc-surface-card)] shadow-sm border border-[var(--sc-border)] hover:border-[var(--sc-primary)] hover:text-[var(--sc-primary)] transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Analyze document (PDF, Docx, PPTX)"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--sc-purple)]" />
          ) : (
            <Upload className="w-3.5 h-3.5 transition-colors" />
          )}
        </button>
        {fileName && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--sc-text-muted)] max-w-[80px]">
            <span className="truncate">{fileName}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.md,.markdown,.txt"
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing}
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className="btn-action !px-8 !py-6 !rounded-[24px] bg-white hover:bg-[var(--sc-surface-alt)] border-2 border-[var(--sc-border-light)] !shadow-lg transition-all transform hover:-translate-y-1"
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin text-[var(--sc-purple)]" />
        ) : (
          <div className="flex items-center gap-3 text-[15px] font-bold text-[var(--sc-blue-text)]">
            <div className="p-2 bg-[var(--sc-purple-light)] rounded-lg">
              <Upload className="w-5 h-5 text-[var(--sc-purple)]" />
            </div>
            Upload
          </div>
        )}
      </button>
      
      <div className="flex items-center gap-6 opacity-40">
        <div className="flex items-center gap-1.5 grayscale">
          <FileIcon size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">PDF</span>
        </div>
        <div className="flex items-center gap-1.5 grayscale">
          <FileIcon size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">DOCX</span>
        </div>
        <div className="flex items-center gap-1.5 grayscale">
          <FileIcon size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">PPTX</span>
        </div>
        <div className="flex items-center gap-1.5 grayscale">
          <FileIcon size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">MD</span>
        </div>
      </div>
    </div>
  );
}
