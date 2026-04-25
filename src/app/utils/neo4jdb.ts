import neo4j, { Driver, Record, Session } from 'neo4j-driver';

const NEO4J_URI = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = import.meta.env.VITE_NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = import.meta.env.VITE_NEO4J_PASSWORD || 'password';

let driver: Driver | null = null;

/**
 * Singleton getter for the Neo4j Driver.
 */
export function getDriver() {
  if (!driver) {
    try {
      console.log('🔌 Connecting to Neo4j:', {
        uri: NEO4J_URI,
        user: NEO4J_USER,
        encrypted: NEO4J_URI.includes('+s')
      });

      if (!import.meta.env.VITE_NEO4J_URI && window.location.hostname !== 'localhost') {
        console.warn('⚠️ No VITE_NEO4J_URI found in Netlify environment variables!');
      }

      const isSecure = NEO4J_URI.includes('+s');

      driver = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
        isSecure ? { maxConnectionPoolSize: 50, connectionTimeout: 5000 } : { 
          encrypted: 'ENCRYPTION_OFF',
          trust: 'TRUST_ALL_CERTIFICATES',
          maxConnectionPoolSize: 50, 
          connectionTimeout: 5000
        }
      );
    } catch (error) {
      console.warn('❌ Failed to initialize Neo4j driver', error);
      return null;
    }
  }
  return driver;
}

/**
 * Reusable wrapper to handle Neo4j sessions.
 * Manages driver checks, session lifecycle, and error logging.
 */
async function withSession<T>(callback: (session: Session) => Promise<T>): Promise<T | null> {
  const drv = getDriver();
  if (!drv) return null;

  const session = drv.session();
  try {
    return await callback(session);
  } catch (error) {
    console.error('Neo4j Session Error:', error);
    return null;
  } finally {
    await session.close();
  }
}

export async function checkNeo4jConnection(): Promise<boolean> {
  const res = await withSession(async (session) => {
    const info = await session.run('RETURN 1');
    return !!info;
  });
  return !!res;
}

// Data structures
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  relevantChunks?: string[];
}

/**
 * Saves a completely serialized mindmap layout to Neo4j.
 */
export async function saveWorkspaceToNeo4j(topic: string, nodes: MinimalNode[], edges: MinimalEdge[]) {
  const isOk = await withSession(async (session) => {
    // 1. Delete prior associated nodes for this topic
    await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[r:CONTAINS_NODE]->(n)
      DETACH DELETE n
    `, { topic });
    
    // 2. Create the Mindmap root
    await session.run(`
      MERGE (m:Mindmap {topic: $topic})
      SET m.updatedAt = datetime()
    `, { topic });

    // 3. Insert nodes
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

    // 4. Insert edges
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

  });

  if (!isOk) {
    const savedStrs = localStorage.getItem('sparkmap_local_saves') || '{}';
    const saves = JSON.parse(savedStrs);
    saves[topic] = { topic, nodes, edges, updatedAt: new Date().toISOString() };
    localStorage.setItem('sparkmap_local_saves', JSON.stringify(saves));
  }
  return true;
}

/**
 * Retrieves the list of recent active Mindmaps.
 */
export async function getRecentMindmaps(): Promise<{topic: string, updatedAt: string}[]> {
  const res = await withSession(async (session) => {
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
  });

  if (!res) {
    const savedStrs = localStorage.getItem('sparkmap_local_saves') || '{}';
    const saves = JSON.parse(savedStrs);
    const list = Object.values(saves).map((s: any) => ({ topic: String(s.topic), updatedAt: String(s.updatedAt) }));
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list.slice(0, 15);
  }

  return res || [];
}

/**
 * Hydrates a pure React Flow state from Neo4j.
 */
export async function loadMindmapFromNeo4j(topic: string): Promise<{nodes: MinimalNode[], edges: MinimalEdge[]} | null> {
  const res = await withSession(async (session) => {
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
  });

  if (!res) {
    const savedStrs = localStorage.getItem('sparkmap_local_saves') || '{}';
    const saves = JSON.parse(savedStrs);
    if (saves[topic]) return saves[topic];
    return null;
  }
  return res;
}

/**
 * Saves chat history for a given topic.
 */
export async function saveChatToNeo4j(topic: string, messages: ChatMessage[]) {
  const isOk = await withSession(async (session) => {
    await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[:HAS_MESSAGE]->(msg:Message)
      DETACH DELETE msg
    `, { topic });

    const msgDataList = messages.map((m, idx) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      order: idx,
      chunks: m.relevantChunks ? JSON.stringify(m.relevantChunks) : '[]'
    }));

    await session.run(`
      MATCH (m:Mindmap {topic: $topic})
      UNWIND $msgList AS mData
      CREATE (msg:Message {
        id: mData.id,
        role: mData.role,
        content: mData.content,
        order: mData.order,
        chunks: mData.chunks
      })
      CREATE (m)-[:HAS_MESSAGE]->(msg)
    `, { topic, msgList: msgDataList });

    return true;
  });

  if (!isOk) {
    const chats = JSON.parse(localStorage.getItem('sparkmap_local_chats') || '{}');
    chats[topic] = messages;
    localStorage.setItem('sparkmap_local_chats', JSON.stringify(chats));
  }
  return true;
}

/**
 * Loads chat history for a given topic.
 */
export async function loadChatFromNeo4j(topic: string): Promise<ChatMessage[]> {
  const res = await withSession(async (session) => {
    const result = await session.run(`
      MATCH (m:Mindmap {topic: $topic})-[:HAS_MESSAGE]->(msg:Message)
      RETURN msg
      ORDER BY msg.order ASC
    `, { topic });

    return result.records.map((r: Record) => {
      const p = r.get('msg').properties;
      return {
        id: p.id,
        role: p.role,
        content: p.content,
        relevantChunks: JSON.parse(p.chunks || '[]')
      };
    });
  });
  
  if (!res) {
    const chats = JSON.parse(localStorage.getItem('sparkmap_local_chats') || '{}');
    return chats[topic] || [];
  }
  
  return res || [];
}
