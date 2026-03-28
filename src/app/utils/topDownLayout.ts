import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../store/useStore';

/**
 * Hybrid Top-Down Layout:
 *
 * Level 0 (Root):  Centered at top
 * Level 1 (Hubs):  Spread horizontally, each owns a column
 * Level 2+ (Leaves): Stacked VERTICALLY in each hub's column
 *
 * expandedLeafId: when set, that leaf gets extra height allocated,
 *   pushing all siblings below it down — used on hover.
 */

const NODE_W        = 240;   // node width (matches .node-box width)
const NODE_H        = 92;    // base collapsed node height (matches CSS max-height)
const NODE_H_EXPANDED = 320; // must match .node-box:hover max-height in CSS exactly
const HUB_GAP       = 80;    // horizontal gap between hub columns
const LEAF_V        = 28;    // vertical gap between sibling leaves (enough breathing room)
const ROOT_HUB_Y    = 0;     // root y
const HUB_Y         = 140;   // hub y (below root, enough for root box height)
const FIRST_LEAF_Y  = HUB_Y + NODE_H + 70; // first leaf y below hub

export function computeTopDownLayout(
  nodes: Node<NodeData>[],
  edges: Edge[],
  expandedLeafId: string | null = null
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  // ── 1. Build adjacency ──────────────────────────────────────────────────
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }

  // ── 2. Find root ────────────────────────────────────────────────────────
  const rootNode = nodes.find(n => n.data.isRoot) ?? nodes[0];

  // ── 3. BFS depth assignment ──────────────────────────────────────────────
  const depthMap = new Map<string, number>();
  const queue: string[] = [rootNode.id];
  depthMap.set(rootNode.id, 0);
  const visited = new Set<string>([rootNode.id]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const ch of childMap.get(cur) ?? []) {
      if (!visited.has(ch)) {
        visited.add(ch);
        depthMap.set(ch, (depthMap.get(cur) ?? 0) + 1);
        queue.push(ch);
      }
    }
  }

  // ── 4. Classify hubs (depth 1) ──────────────────────────────────────────
  const hubs = nodes.filter(n => depthMap.get(n.id) === 1);

  const posMap = new Map<string, { x: number; y: number }>();
  let curX = 0;

  // ── 5. Per-hub column layout ────────────────────────────────────────────
  for (const hub of hubs) {
    const leaves = (childMap.get(hub.id) ?? [])
      .map(id => nodes.find(n => n.id === id)!)
      .filter(Boolean);

    posMap.set(hub.id, { x: curX, y: HUB_Y });

    let leafY = FIRST_LEAF_Y;

    for (const leaf of leaves) {
      posMap.set(leaf.id, { x: curX, y: leafY });

      // Compute how much vertical space this leaf occupies
      const thisLeafH = leaf.id === expandedLeafId ? NODE_H_EXPANDED : NODE_H;
      leafY += thisLeafH + LEAF_V;

      // Handle grandchildren (depth >= 3) — placed in a sub-column to the right
      const grandchildren = (childMap.get(leaf.id) ?? [])
        .map(id => nodes.find(n => n.id === id)!)
        .filter(Boolean);

      let gcY = posMap.get(leaf.id)!.y;
      const gcX = curX + NODE_W + 32;

      for (const gc of grandchildren) {
        posMap.set(gc.id, { x: gcX, y: gcY });
        gcY += NODE_H + LEAF_V;
        if (gcY > leafY) leafY = gcY; // ensure column doesn't overlap with gc tail
      }
    }

    // Width of this column — if any leaf has grandchildren, add room for them
    const hasGrandchildren = leaves.some(l => (childMap.get(l.id)?.length ?? 0) > 0);
    curX += NODE_W + (hasGrandchildren ? NODE_W + 32 + HUB_GAP : HUB_GAP);
  }

  // ── 6. Root — centered over hubs ────────────────────────────────────────
  const hubXs = hubs.map(h => posMap.get(h.id)?.x ?? 0);
  if (hubXs.length > 0) {
    const leftEdge  = Math.min(...hubXs);
    const rightEdge = Math.max(...hubXs) + NODE_W;
    posMap.set(rootNode.id, { x: (leftEdge + rightEdge) / 2 - NODE_W / 2, y: ROOT_HUB_Y });
  } else {
    posMap.set(rootNode.id, { x: 0, y: ROOT_HUB_Y });
  }

  // ── 7. Orphaned nodes ───────────────────────────────────────────────────
  let orphanX = curX + HUB_GAP;
  for (const n of nodes.filter(n => !posMap.has(n.id))) {
    posMap.set(n.id, { x: orphanX, y: HUB_Y });
    orphanX += NODE_W + HUB_GAP;
  }

  // ── 8. Center horizontally ───────────────────────────────────────────────
  const allX   = Array.from(posMap.values()).map(p => p.x);
  const minX   = Math.min(...allX);
  const maxX   = Math.max(...allX) + NODE_W;
  const offset = -((minX + maxX) / 2);

  return nodes.map(n => {
    const pos = posMap.get(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: { x: pos.x + offset, y: pos.y },
    };
  });
}

/**
 * Left-to-Right Horizontal Tree Layout (Rotated Hybrid)
 */
export function computeHorizontalLayout(
  nodes: Node<NodeData>[],
  edges: Edge[]
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }

  const rootNode = nodes.find(n => n.data.isRoot) ?? nodes[0];
  const depthMap = new Map<string, number>();
  const queue: string[] = [rootNode.id];
  depthMap.set(rootNode.id, 0);
  const visited = new Set<string>([rootNode.id]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const ch of childMap.get(cur) ?? []) {
      if (!visited.has(ch)) {
        visited.add(ch);
        depthMap.set(ch, (depthMap.get(cur) ?? 0) + 1);
        queue.push(ch);
      }
    }
  }

  const hubs = nodes.filter(n => depthMap.get(n.id) === 1);
  const posMap = new Map<string, { x: number; y: number }>();
  
  // Left-to-Right Constants
  const DEPTH_GAP = 300; // X gap between levels
  const NODE_V_GAP = 120; // Y gap between brothers

  let currentY = 0;
  
  // Place root at the left center
  posMap.set(rootNode.id, { x: 0, y: 0 });

  // For each hub, we create a vertical cluster to the right of root
  hubs.forEach((hub, hIdx) => {
    const leaves = (childMap.get(hub.id) ?? [])
      .map(id => nodes.find(n => n.id === id)!)
      .filter(Boolean);

    const hubX = DEPTH_GAP;
    const hubY = currentY;
    posMap.set(hub.id, { x: hubX, y: hubY });

    let leafYStart = hubY - ((leaves.length - 1) * NODE_V_GAP) / 2;
    
    leaves.forEach((leaf, lIdx) => {
      const leafX = hubX + DEPTH_GAP;
      const leafY = leafYStart + (lIdx * NODE_V_GAP);
      posMap.set(leaf.id, { x: leafX, y: leafY });

      // Grandchildren
      const grandchildren = (childMap.get(leaf.id) ?? [])
        .map(id => nodes.find(n => n.id === id)!)
        .filter(Boolean);
      
      const gcX = leafX + DEPTH_GAP;
      let gcYStart = leafY - ((grandchildren.length - 1) * (NODE_V_GAP/1.5)) / 2;
      
      grandchildren.forEach((gc, gIdx) => {
        posMap.set(gc.id, { x: gcX, y: gcYStart + (gIdx * (NODE_V_GAP/1.5)) });
      });
    });

    currentY += Math.max(leaves.length, 1) * NODE_V_GAP + 100;
  });

  // Re-center Y axis around root
  const allY = Array.from(posMap.values()).map(p => p.y);
  const midY = (Math.min(...allY) + Math.max(...allY)) / 2;

  return nodes.map(n => {
    const pos = posMap.get(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: { x: pos.x, y: pos.y - midY }
    };
  });
}

/**
 * Symmetric (Radial) Layout:
 * Distributes nodes in circles around the root.
 */
export function computeSymmetricLayout(
  nodes: Node<NodeData>[],
  edges: Edge[]
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }

  const rootNode = nodes.find(n => n.data.isRoot) ?? nodes[0];
  const depthMap = new Map<string, number>();
  const queue: string[] = [rootNode.id];
  depthMap.set(rootNode.id, 0);
  const visited = new Set<string>([rootNode.id]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const ch of childMap.get(cur) ?? []) {
      if (!visited.has(ch)) {
        visited.add(ch);
        depthMap.set(ch, (depthMap.get(cur) ?? 0) + 1);
        queue.push(ch);
      }
    }
  }

  const hubs = nodes.filter(n => depthMap.get(n.id) === 1);
  const posMap = new Map<string, { x: number; y: number }>();
  
  // Radial Constants
  const HUB_RADIUS = 500;
  const LEAF_RADIUS = 300;

  posMap.set(rootNode.id, { x: 0, y: 0 });

  hubs.forEach((hub, hIdx) => {
    const angle = (hIdx / hubs.length) * 2 * Math.PI;
    const hubX = Math.cos(angle) * HUB_RADIUS;
    const hubY = Math.sin(angle) * HUB_RADIUS;
    posMap.set(hub.id, { x: hubX, y: hubY });

    const leaves = (childMap.get(hub.id) ?? [])
      .map(id => nodes.find(n => n.id === id)!)
      .filter(Boolean);

    // Spread leaves around the hub
    leaves.forEach((leaf, lIdx) => {
      // Calculate arc spread centered around hub angle
      const arcWidth = Math.PI / 1.5; // Hubs sweep ~120 degrees
      const leafAngleStart = angle - arcWidth/2;
      const leafAngle = leaves.length > 1 
        ? leafAngleStart + (lIdx / (leaves.length - 1)) * arcWidth
        : angle;
      
      const lx = hubX + Math.cos(leafAngle) * LEAF_RADIUS;
      const ly = hubY + Math.sin(leafAngle) * LEAF_RADIUS;
      posMap.set(leaf.id, { x: lx, y: ly });

      // Grandchildren
      const grandchildren = (childMap.get(leaf.id) ?? [])
        .map(id => nodes.find(n => n.id === id)!)
        .filter(Boolean);
      
      grandchildren.forEach((gc, gIdx) => {
        const gcAngle = leafAngle; // For now just radiate further out
        const gcx = lx + Math.cos(gcAngle) * (LEAF_RADIUS * 0.7);
        const gcy = ly + Math.sin(gcAngle) * (LEAF_RADIUS * 0.7);
        posMap.set(gc.id, { x: gcx, y: gcy });
      });
    });
  });

  // Handle orphans
  let orphanIdx = 0;
  const orphans = nodes.filter(n => !posMap.has(n.id));
  orphans.forEach(o => {
    posMap.set(o.id, { x: 1200 + (orphanIdx * 300), y: 0 });
    orphanIdx++;
  });

  return nodes.map(n => {
    const pos = posMap.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}
