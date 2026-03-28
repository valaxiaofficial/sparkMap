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
