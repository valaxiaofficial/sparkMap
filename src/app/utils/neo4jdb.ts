import neo4j, { Driver, Record } from 'neo4j-driver';

const NEO4J_URI = (import.meta as any).env?.VITE_NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = (import.meta as any).env?.VITE_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = (import.meta as any).env?.VITE_NEO4J_PASSWORD || 'password';

let driver: Driver | null = null;

export function getDriver() {
  if (!driver) {
    try {
      driver = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
      );
    } catch (error) {
      console.warn('Failed to initialize Neo4j driver', error);
      return null;
    }
  }
  return driver;
}

export async function checkNeo4jConnection(): Promise<boolean> {
  const drv = getDriver();
  if (!drv) return false;
  try {
    await drv.getServerInfo();
    return true;
  } catch (error) {
    console.warn('Could not connect to Neo4j.', error);
    return false;
  }
}

// Data structures for React Flow
export interface MinimalNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export interface MinimalEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}

/**
 * Saves a completely serialized mindmap layout to Neo4j.
 * It creates a Root :Mindmap node, then attaches all :UI_Node and :UI_Edge records to it
 * so that the layout state can be perfectly reconstructed.
 */
export async function saveWorkspaceToNeo4j(topic: string, nodes: MinimalNode[], edges: MinimalEdge[]) {
  const drv = getDriver();
  if (!drv) return false;

  const session = drv.session();
  try {
    // 1. Delete prior associated nodes for this topic so we can cleanly overwrite
    await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[r]->(n)
      DETACH DELETE m, n
    `, { topic });
    
    // We also might have left over unbound nodes, but for safety we only delete those bound to the mindmap.

    // 2. Create the Mindmap root
    await session.run(`
      MERGE (m:Mindmap {topic: $topic})
      SET m.updatedAt = datetime()
    `, { topic });

    // 3. Serialize nodes and attach them
    // We use UNWIND for batch inserts of nodes
    const nodeDataList = nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: n.position.x,
      y: n.position.y,
      dataJson: JSON.stringify(n.data)
    }));

    await session.run(`
      MATCH (m:Mindmap {topic: $topic})
      UNWIND $nodeList AS nData
      CREATE (n:UI_Node { 
        id: nData.id, 
        type: nData.type, 
        x: nData.x, 
        y: nData.y, 
        data: nData.dataJson 
      })
      CREATE (m)-[:CONTAINS_NODE]->(n)
    `, { topic, nodeList: nodeDataList });

    // 4. Serialize edges and attach them (we also recreate the native Graph relations)
    const edgeDataList = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'default',
      animated: !!e.animated
    }));

    await session.run(`
      MATCH (m:Mindmap {topic: $topic})
      UNWIND $edgeList AS eData
      MATCH (m)-[:CONTAINS_NODE]->(src:UI_Node {id: eData.source})
      MATCH (m)-[:CONTAINS_NODE]->(tgt:UI_Node {id: eData.target})
      CREATE (src)-[:CONNECTED_TO {
        edgeId: eData.id, 
        type: eData.type, 
        animated: eData.animated
      }]->(tgt)
    `, { topic, edgeList: edgeDataList });

    return true;
  } catch (error) {
    console.error('Failed to save to Neo4j', error);
    return false;
  } finally {
    await session.close();
  }
}

/**
 * Retrieves the list of recent active Mindmaps stored in Neo4j
 */
export async function getRecentMindmaps(): Promise<{topic: string, updatedAt: string}[]> {
  const drv = getDriver();
  if (!drv) return [];

  const session = drv.session();
  try {
    const result = await session.run(`
      MATCH (m:Mindmap)
      RETURN m.topic AS topic, toString(m.updatedAt) AS updatedAt
      ORDER BY m.updatedAt DESC
      LIMIT 15
    `);
    
    return result.records.map((r: Record) => ({
      topic: r.get('topic'),
      updatedAt: r.get('updatedAt')
    }));
  } catch (error) {
    console.error('Failed to get recent mindmaps from Neo4j', error);
    return [];
  } finally {
    await session.close();
  }
}

/**
 * Hydrates a pure React Flow state (nodes, edges) by Topic from Neo4j
 */
export async function loadMindmapFromNeo4j(topic: string): Promise<{nodes: MinimalNode[], edges: MinimalEdge[]} | null> {
  const drv = getDriver();
  if (!drv) return null;

  const session = drv.session();
  try {
    // 1. Get nodes
    const nodeRes = await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[:CONTAINS_NODE]->(n:UI_Node)
      RETURN n
    `, { topic });
    
    if (nodeRes.records.length === 0) return null;

    const nodes: MinimalNode[] = nodeRes.records.map((r: Record) => {
      const p = r.get('n').properties;
      return {
        id: p.id,
        type: p.type,
        position: { x: Number(p.x), y: Number(p.y) },
        data: JSON.parse(p.data)
      };
    });

    // 2. Get edges
    const edgeRes = await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[:CONTAINS_NODE]->(src:UI_Node)-[r:CONNECTED_TO]->(tgt:UI_Node)
      RETURN src.id AS source, tgt.id AS target, r
    `, { topic });

    const edges: MinimalEdge[] = edgeRes.records.map((r: Record) => {
      const p = r.get('r').properties;
      return {
        id: p.edgeId,
        source: r.get('source'),
        target: r.get('target'),
        type: p.type,
        animated: p.animated
      };
    });

    return { nodes, edges };
  } catch (error) {
    console.error('Failed to load mindmap from Neo4j', error);
    return null;
  } finally {
    await session.close();
  }
}
