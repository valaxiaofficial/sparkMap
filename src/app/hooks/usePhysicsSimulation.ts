import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useReactFlow } from '@xyflow/react';

export function usePhysicsSimulation() {
  const nodes = useStore(state => state.nodes);
  const animationRef = useRef<number>(0);
  const { fitView } = useReactFlow();
  
  // D3-style Alpha cooling
  const alphaRef = useRef(1.0);
  const lastNodeCount = useRef(0);
  const hasSettledRef = useRef(false);

  // Redesigned constants for tight, beautiful organic clustering
  const OPTIMAL_DIST = 120; // ideal spring length
  const REPULSION_STR = 6000; // base repulsion strength
  const SPRING_STR = 0.05; // spring tension
  const DAMP = 0.6; // high friction stops wobbling
  const CENTER_STR = 0.005; // gentle gravity

  const velocities = useRef<Record<string, { vx: number; vy: number }>>({});

  useEffect(() => {
    if (nodes.length !== lastNodeCount.current) {
      alphaRef.current = 1.0;
      lastNodeCount.current = nodes.length;
      hasSettledRef.current = false;
    }
  }, [nodes.length]);

  useEffect(() => {
    if (nodes.length > 0) {
      alphaRef.current = 1.0;
      hasSettledRef.current = false;
    }

    const loop = () => {
      const currentNodes = useStore.getState().nodes;
      const currentEdges = useStore.getState().edges;
      const currentLayoutMode = useStore.getState().layoutMode;

      // Pause physics entirely when in top-down layout mode
      if (currentLayoutMode === 'topDown') {
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      // Stop loop when cooled completely and perfectly frame to 52% exactly as requested
      if (currentNodes.length === 0 || alphaRef.current < 0.005) {
        if (!hasSettledRef.current && currentNodes.length > 0) {
          hasSettledRef.current = true;
          fitView({ padding: 0.1, duration: 1000, maxZoom: 0.52, minZoom: 0.52 });
        }
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      alphaRef.current *= 0.95; // fast cooling factor
      
      let moved = false;
      const nextNodes = currentNodes.map(node => {
        let fx = 0;
        let fy = 0;

        // 1. Repulsive Force (inverse square, very weak far away)
        for (let j = 0; j < currentNodes.length; j++) {
          if (node.id === currentNodes[j].id) continue;
          
          const other = currentNodes[j];
          let dx = node.position.x - other.position.x;
          let dy = node.position.y - other.position.y;
          let d2 = dx * dx + dy * dy;

          if (d2 === 0) {
            dx = (Math.random() - 0.5) * 10;
            dy = (Math.random() - 0.5) * 10;
            d2 = dx * dx + dy * dy;
          }

          let d = Math.sqrt(d2);
          
          // Only repel if they are decently close to prevent giant expansive circles
          if (d < OPTIMAL_DIST * 3) {
            const force = (REPULSION_STR / d2) * alphaRef.current;
            fx += force * dx;
            fy += force * dy;
          }
        }

        // 2. Attractive Force (spring)
        let connectedEdgesCount = 0;
        for (let k = 0; k < currentEdges.length; k++) {
          const edge = currentEdges[k];
          let otherId: string | null = null;
          
          if (edge.source === node.id) otherId = edge.target;
          if (edge.target === node.id) otherId = edge.source;
          
          if (!otherId) continue;
          connectedEdgesCount++;
          
          const otherNode = currentNodes.find(n => n.id === otherId);
          if (!otherNode) continue;

          let dx = otherNode.position.x - node.position.x;
          let dy = otherNode.position.y - node.position.y;
          let d = Math.sqrt(dx * dx + dy * dy);
          if (d === 0) { d = 0.01; dx = 0.01; }
          
          // Hooks law
          const force = SPRING_STR * (d - OPTIMAL_DIST) * alphaRef.current;
          fx += force * (dx / d);
          fy += force * (dy / d);
        }

        // 3. Gravity pulling orphans closer to center than big clusters
        const mass = Math.max(1, connectedEdgesCount);
        const gravity = CENTER_STR / mass;
        fx -= gravity * node.position.x * alphaRef.current;
        fy -= gravity * node.position.y * alphaRef.current;

        // 4. Strict bounding box to ensure everything fits inside 52% viewport zoom
        const BOUND_X = 900;
        const BOUND_Y = 500;
        if (node.position.x > BOUND_X) fx -= (node.position.x - BOUND_X) * alphaRef.current * 0.8;
        if (node.position.x < -BOUND_X) fx += (-BOUND_X - node.position.x) * alphaRef.current * 0.8;
        if (node.position.y > BOUND_Y) fy -= (node.position.y - BOUND_Y) * alphaRef.current * 0.8;
        if (node.position.y < -BOUND_Y) fy += (-BOUND_Y - node.position.y) * alphaRef.current * 0.8;

        // Update velocity
        const vel = velocities.current[node.id] || { vx: 0, vy: 0 };
        vel.vx = (vel.vx + fx) * DAMP;
        vel.vy = (vel.vy + fy) * DAMP;
        velocities.current[node.id] = vel;
        
        // Root node anchoring
        if (node.data.isRoot) {
           vel.vx = 0;
           vel.vy = 0;
        }

        if (Math.abs(vel.vx) > 0.05 || Math.abs(vel.vy) > 0.05) moved = true;

        return {
          ...node,
          position: {
            x: node.position.x + vel.vx,
            y: node.position.y + vel.vy
          }
        };
      });

      if (moved && alphaRef.current >= 0.005) {
        useStore.getState().setNodes(nextNodes);
      }
      
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [fitView]); 
}
