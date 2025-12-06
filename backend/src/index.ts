import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import type { WebSocket } from 'ws';
import type { WorldState, WorldsStore, Pookie } from './types.js';
import { renderHomePage } from './pages/home.js';

const { app } = expressWs(express());

const PORT = Number(process.env.PORT) || 3001;
const MAX_POOKIES_PER_WORLD = 4;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for worlds and their state
const worlds: WorldsStore = {};

// Helper to get current timestamp
const now = () => Date.now();

// Create mock world state
function createMockWorldState(worldId: string): WorldState {
  const startTimestamp = now();
  return {
    level: {
      backgroundImage: {
        url: `https://example.com/worlds/${worldId}/background.png`,
        scale: 0.5,
      },
      facilities: {
        'facility-well': {
          x: 100,
          y: 200,
          displayName: 'Water Well',
          interactionPrompt: 'Press E to drink water',
          interactionName: 'drink',
          variables: {
            waterLevel: 80,
            isClean: true,
          },
        },
        'facility-campfire': {
          x: 300,
          y: 150,
          displayName: 'Campfire',
          interactionPrompt: 'Press E to warm up',
          interactionName: 'warm',
          variables: {
            isLit: true,
            fuel: 50,
          },
        },
        'facility-berry-bush': {
          x: 450,
          y: 300,
          displayName: 'Berry Bush',
          interactionPrompt: 'Press E to pick berries',
          interactionName: 'pick',
          variables: {
            berryCount: 12,
            ripeness: 'ripe',
          },
        },
        'facility-shelter': {
          x: 200,
          y: 400,
          displayName: 'Shelter',
          interactionPrompt: 'Press E to rest',
          interactionName: 'rest',
          variables: {
            capacity: 4,
            currentOccupants: 0,
          },
        },
      },
    },
    startTimestampMillis: startTimestamp,
    pookies: {},
  };
}

// Create a new pookie
function createPookie(): Pookie {
  const timestamp = now();
  return {
    currentAction: {
      type: 'idle',
      sinceTimestampMillis: timestamp,
    },
    inventory: [
      { id: 'berries', amount: 3 },
      { id: 'water-bottle', amount: 1 },
    ],
    thoughts: [
      {
        source: 'self',
        text: 'I just woke up in this strange world...',
        spokenLoudly: false,
        timestampMillis: timestamp,
      },
      {
        source: 'self-action',
        text: 'Looking around curiously',
        timestampMillis: timestamp + 1000,
      },
    ],
    health: 100,
    hunger: 70,
  };
}

// Get or create a world
function getOrCreateWorld(worldId: string) {
  if (!worlds[worldId]) {
    worlds[worldId] = {
      state: createMockWorldState(worldId),
      wsClients: new Set<WebSocket>(),
    };
  }
  return worlds[worldId];
}

// Broadcast state to all WebSocket clients for a world
function broadcastState(worldId: string) {
  const world = worlds[worldId];
  if (!world) return;
  
  const stateJson = JSON.stringify(world.state);
  for (const client of world.wsClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(stateJson);
    }
  }
}

// Routes

// Home page - list all running games
app.get('/', (_req, res) => {
  res.send(renderHomePage(worlds, MAX_POOKIES_PER_WORLD, PORT));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /worlds/:worldId/join
app.post('/worlds/:worldId/join', (req, res) => {
  const { worldId } = req.params;
  const world = getOrCreateWorld(worldId);
  
  const pookieCount = Object.keys(world.state.pookies).length;
  
  if (pookieCount >= MAX_POOKIES_PER_WORLD) {
    res.status(400).json({
      error: 'Maximum number of pookies reached',
      maxPookies: MAX_POOKIES_PER_WORLD,
    });
    return;
  }
  
  const pookieId = `pookie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  world.state.pookies[pookieId] = createPookie();
  
  // Broadcast updated state to all listeners
  broadcastState(worldId);
  
  res.status(200).json({ pookieId });
});

// GET /worlds/:worldId/state
app.get('/worlds/:worldId/state', (req, res) => {
  const { worldId } = req.params;
  const world = getOrCreateWorld(worldId);
  res.json(world.state);
});

// WebSocket /worlds/:worldId/state/listen
app.ws('/worlds/:worldId/state/listen', (ws, req) => {
  const { worldId } = req.params;
  const world = getOrCreateWorld(worldId);
  
  // Add client to the world's WebSocket clients
  world.wsClients.add(ws);
  
  // Send current state immediately
  ws.send(JSON.stringify(world.state));
  
  // Handle client disconnect
  ws.on('close', () => {
    world.wsClients.delete(ws);
  });
  
  ws.on('error', () => {
    world.wsClients.delete(ws);
  });
});

// POST /worlds/:worldId/pookies/:pookieId/guardian-angel/chat
app.post('/worlds/:worldId/pookies/:pookieId/guardian-angel/chat', (req, res) => {
  const { worldId, pookieId } = req.params;
  const { imageUrl } = req.body;
  
  const world = worlds[worldId];
  
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  
  const pookie = world.state.pookies[pookieId];
  
  if (!pookie) {
    res.status(404).json({ error: 'Pookie not found' });
    return;
  }
  
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' });
    return;
  }
  
  // Add guardian angel thought to pookie
  pookie.thoughts.push({
    source: 'guardian-angel',
    imageUrl,
    timestampMillis: now(),
  });
  
  // Broadcast updated state to all listeners
  broadcastState(worldId);
  
  res.status(200).json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

