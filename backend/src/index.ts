import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import type { WebSocket } from 'ws';
import { World, type CustomLevel, type WorldState } from './world.js';
import { renderHomePage } from './pages/home.js';

const { app } = expressWs(express());

const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for worlds
const worlds: Map<string, World> = new Map();

// Helper type for the home page (adapts World instances to the format expected by renderHomePage)
function getWorldsForHomePage() {
  const result: Record<string, { state: WorldState; wsClients: Set<WebSocket> }> = {};
  for (const [worldId, world] of worlds) {
    result[worldId] = {
      state: world.getWorldState(),
      wsClients: new Set(), // Not used by home page rendering
    };
  }
  return result;
}

// Routes

// Home page - list all running games
app.get('/', (_req, res) => {
  const worldsData = getWorldsForHomePage();
  // Get max players from first world, or default to 4
  const firstWorld = worlds.values().next().value;
  const maxPookies = firstWorld?.getWorldState().level.maxPlayers ?? 4;
  res.send(renderHomePage(worldsData, maxPookies, PORT));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /worlds/create - Create a new world
app.post('/worlds/create', (req, res) => {
  const { worldId, level } = req.body as { worldId?: string; level?: CustomLevel };
  
  if (!worldId) {
    res.status(400).json({ error: 'worldId is required' });
    return;
  }
  
  if (!level) {
    res.status(400).json({ error: 'level is required' });
    return;
  }
  
  if (worlds.has(worldId)) {
    res.status(400).json({ error: 'World already exists' });
    return;
  }
  
  const world = new World(level);
  worlds.set(worldId, world);
  
  res.status(201).json({ worldId, message: 'World created successfully' });
});

// POST /worlds/:worldId/join
app.post('/worlds/:worldId/join', (req, res) => {
  const { worldId } = req.params;
  const world = worlds.get(worldId);
  
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  
  const result = world.join();
  
  if (result === 'max-players-reached') {
    res.status(400).json({
      error: 'Maximum number of pookies reached',
      maxPookies: world.getWorldState().level.maxPlayers,
    });
    return;
  }
  
  res.status(200).json({ pookieName: result.pookieName });
});

// GET /worlds/:worldId/state
app.get('/worlds/:worldId/state', (req, res) => {
  const { worldId } = req.params;
  const world = worlds.get(worldId);
  
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  
  res.json(world.getWorldState());
});

// WebSocket /worlds/:worldId/state/listen
app.ws('/worlds/:worldId/state/listen', (ws, req) => {
  const { worldId } = req.params;
  const world = worlds.get(worldId);
  
  if (!world) {
    ws.close(1008, 'World not found');
    return;
  }
  
  // Send current state immediately
  ws.send(JSON.stringify(world.getWorldState()));
  
  // Subscribe to state changes
  const subscription = world.onWorldStateChange((worldState) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(worldState));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    subscription.unsubscribe();
  });
  
  ws.on('error', () => {
    subscription.unsubscribe();
  });
});

// POST /worlds/:worldId/pookies/:pookieName/guardian-angel/chat
app.post('/worlds/:worldId/pookies/:pookieName/guardian-angel/chat', (req, res) => {
  const { worldId, pookieName } = req.params;
  const { imageUrl } = req.body;
  
  const world = worlds.get(worldId);
  
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' });
    return;
  }
  
  const result = world.sendGuardianAngelMessage(pookieName, imageUrl);
  
  if (result === 'pookie-not-found') {
    res.status(404).json({ error: 'Pookie not found' });
    return;
  }
  
  res.status(200).json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
