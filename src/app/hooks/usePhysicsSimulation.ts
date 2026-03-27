import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export function usePhysicsSimulation() {
  const isSimulating = useStore(state => state.isSimulating);
  const nodes = useStore(state => state.nodes);
  const animationRef = useRef<number>();
  
  // Physics parameters from user's snippet
  const REP = 7500;
  const SPRING = 0.016;
  const SLEN = 155;
  const DAMP = 0.87;
  const CENTER = 0.002;

  // We maintain velocities in a ref to avoid polluting store state
  const velocities = useRef<Record<string, { vx: number; vy: number }>>({});

  useEffect(() => {
    if (!isSimulating || nodes.length === 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    // Initialize velocities for new nodes
    nodes.forEach(n => {
      if (!velocities.current[n.id]) velocities.current[n.id] = { vx: 0, vy: 0 };
    });

    const loop = () => {
      // We read the latest nodes from store.
      // Zustand allows us to useStore.getState() so we can run loop natively
      const currentNodes = useStore.getState().nodes;
      const currentEdges = useStore.getState().edges;
      
      let moved = false;
      const nextNodes = currentNodes.map(node => {
        let fx = 0;
        let fy = 0;

        // 1. Repulsion between all nodes
        for (let j = 0; j < currentNodes.length; j++) {
          if (node.id === currentNodes[j].id) continue;
          const other = currentNodes[j];
          const dx = node.position.x - other.position.x;
          const dy = node.position.y - other.position.y;
          const d2 = dx * dx + dy * dy + 1;
          fx += (REP / d2) * dx;
          fy += (REP / d2) * dy;
        }

        // 2. Spring attraction along edges
        for (let k = 0; k < currentEdges.length; k++) {
          const edge = currentEdges[k];
          let otherId: string | null = null;
          
          if (edge.source === node.id) otherId = edge.target;
          if (edge.target === node.id) otherId = edge.source;
          
          if (!otherId) continue;
          
          const otherNode = currentNodes.find(n => n.id === otherId);
          if (!otherNode) continue;

          const dx = otherNode.position.x - node.position.x;
          const dy = otherNode.position.y - node.position.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const f = SPRING * (d - SLEN);
          
          fx += (f * dx) / d;
          fy += (f * dy) / d;
        }

        // 3. Center gravity (pulling back to origin 0,0)
        fx -= CENTER * node.position.x;
        fy -= CENTER * node.position.y;

        // Node velocities
        const vel = velocities.current[node.id] || { vx: 0, vy: 0 };
        vel.vx = (vel.vx + fx) * DAMP;
        vel.vy = (vel.vy + fy) * DAMP;
        
        // Root node is often heavy/static, we could lock it but for now let it drift slightly
        if (node.data.isRoot) {
           vel.vx *= 0.1;
           vel.vy *= 0.1;
        }

        if (Math.abs(vel.vx) > 0.1 || Math.abs(vel.vy) > 0.1) moved = true;

        return {
          ...node,
          position: {
            x: node.position.x + vel.vx,
            y: node.position.y + vel.vy
          }
        };
      });

      if (moved) {
        useStore.getState().setNodes(nextNodes);
      }
      
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSimulating]); // only re-bind when simulation toggles, loop reads from getState()
  
}
