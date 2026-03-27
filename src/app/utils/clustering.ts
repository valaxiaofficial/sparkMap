import { Chunk } from '../store/useStore';

// Simple k-means clustering implementation
export function kMeansClustering(chunks: Chunk[], k: number = 5): Map<number, Chunk[]> {
  if (!chunks.length || !chunks[0].embedding) {
    throw new Error('Chunks must have embeddings');
  }
  
  const embeddings = chunks.map(c => c.embedding!);
  const dim = embeddings[0].length;
  
  // Initialize centroids randomly
  const centroids: number[][] = [];
  const indices = new Set<number>();
  while (centroids.length < Math.min(k, chunks.length)) {
    const idx = Math.floor(Math.random() * chunks.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      centroids.push([...embeddings[idx]]);
    }
  }
  
  let assignments = new Array(chunks.length).fill(0);
  let changed = true;
  let iterations = 0;
  
  while (changed && iterations < 50) {
    changed = false;
    iterations++;
    
    // Assign each point to nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(embeddings[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }
      
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    
    // Update centroids
    for (let j = 0; j < centroids.length; j++) {
      const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);
      if (clusterPoints.length > 0) {
        for (let d = 0; d < dim; d++) {
          centroids[j][d] = clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
        }
      }
    }
  }
  
  // Group chunks by cluster
  const clusters = new Map<number, Chunk[]>();
  chunks.forEach((chunk, i) => {
    const clusterId = assignments[i];
    if (!clusters.has(clusterId)) {
      clusters.set(clusterId, []);
    }
    clusters.get(clusterId)!.push({ ...chunk, clusterId });
  });
  
  return clusters;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export function findTopKSimilar(queryEmbedding: number[], chunks: Chunk[], k: number = 3): Chunk[] {
  const similarities = chunks
    .filter(c => c.embedding)
    .map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding!)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
  
  return similarities.map(s => s.chunk);
}

// Auto-select k using elbow heuristic
export function selectOptimalK(chunks: Chunk[], maxK: number = 8): number {
  if (chunks.length <= 3) return 1;
  if (chunks.length <= 8) return Math.min(3, chunks.length);
  return Math.min(5, Math.ceil(chunks.length / 10));
}
