import React from 'react';
import { Upload, Loader2, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { parsePDF, splitIntoChunks } from '../utils/pdfParser';
import { embedChunks, generateClusterLabel, generateFlashcard } from '../utils/geminiApi';
import { kMeansClustering, selectOptimalK } from '../utils/clustering';
import { toast } from 'sonner';
import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../store/useStore';

export function PDFUploader() {
  const { setChunks, setNodes, setEdges, setIsProcessing, isProcessing, setIsWorkspaceActive } = useStore();
  const [fileName, setFileName] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setFileName(file.name);
    setIsProcessing(true);
    
    try {
      toast.info('Parsing PDF...');
      const text = await parsePDF(file);
      
      if (!text || text.trim().length < 100) {
        toast.error('PDF appears to be empty or contains too little text');
        setIsProcessing(false);
        return;
      }
      
      toast.info('Splitting into chunks...');
      const chunks = splitIntoChunks(text, 300, 50);
      
      if (chunks.length === 0) {
        toast.error('No text found in PDF');
        setIsProcessing(false);
        return;
      }
      
      toast.info(`Generating embeddings for ${chunks.length} chunks...`);
      const embeddedChunks = await embedChunks(chunks);
      setChunks(embeddedChunks);
      
      toast.info('Clustering concepts...');
      const k = selectOptimalK(embeddedChunks);
      const clusters = kMeansClustering(embeddedChunks, k);
      
      toast.info('Building canvas...');
      const nodes: Node<NodeData>[] = [];
      const edges: Edge[] = [];
      
      let nodeY = 0;
      const clusterSpacing = 300;
      const nodeSpacing = 120;
      
      let clusterIndex = 0;
      for (const [clusterId, clusterChunks] of clusters.entries()) {
        const clusterTexts = clusterChunks.slice(0, 3).map(c => c.text);
        const clusterLabel = await generateClusterLabel(clusterTexts);
        
        const groupNodeId = `group-${clusterId}`;
        nodes.push({
          id: groupNodeId,
          type: 'group',
          position: { x: 50, y: nodeY },
          data: {
            label: clusterLabel,
            chunkId: '',
            isGroup: true,
            clusterLabel
          }
        });
        
        nodeY += 100;
        
        for (let i = 0; i < clusterChunks.length; i++) {
          const chunk = clusterChunks[i];
          const nodeId = `node-${chunk.id}`;
          
          try {
            const flashcard = await generateFlashcard(chunk.text);
            nodes.push({
              id: nodeId,
              type: 'concept',
              position: { x: 150 + (i % 3) * 250, y: nodeY + Math.floor(i / 3) * nodeSpacing },
              data: {
                label: chunk.text.slice(0, 50).trim() + '...',
                chunkId: chunk.id,
                flashcard
              }
            });
          } catch (error) {
            nodes.push({
              id: nodeId,
              type: 'concept',
              position: { x: 150 + (i % 3) * 250, y: nodeY + Math.floor(i / 3) * nodeSpacing },
              data: {
                label: chunk.text.slice(0, 50).trim() + '...',
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
      setIsWorkspaceActive(true);
      
      toast.success(`Canvas created with ${nodes.length} nodes!`);
    } catch (error) {
      console.error('PDF processing error:', error);
      toast.error(`Failed to process PDF`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
        id="pdf-upload-header"
        disabled={isProcessing}
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className="btn-action"
        style={{ margin: 0 }}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        Upload PDF
      </button>
      {fileName && (
        <div className="flex items-center gap-1 text-[12px] text-[var(--sc-text-secondary)]">
          <FileText className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{fileName}</span>
        </div>
      )}
    </div>
  );
}
