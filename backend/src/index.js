const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3001;
const MAX_POOKIES_PER_WORLD = 4;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for worlds and their state
const worlds = {};

// Helper to get current timestamp
const now = () => Date.now();

// Create mock world state
function createMockWorldState(worldId) {
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
            ripenesss: 'ripe',
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
function createPookie(pookieId) {
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
function getOrCreateWorld(worldId) {
  if (!worlds[worldId]) {
    worlds[worldId] = {
      state: createMockWorldState(worldId),
      wsClients: new Set(),
    };
  }
  return worlds[worldId];
}

// Broadcast state to all WebSocket clients for a world
function broadcastState(worldId) {
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
app.get('/', (req, res) => {
  const worldIds = Object.keys(worlds);
  const worldsHtml = worldIds.length === 0 
    ? '<p class="empty">No games currently running. Join a world to start one!</p>'
    : worldIds.map(worldId => {
        const world = worlds[worldId];
        const pookieCount = Object.keys(world.state.pookies).length;
        const startTime = new Date(world.state.startTimestampMillis).toLocaleString();
        return `
          <div class="world-card">
            <h2>${worldId}</h2>
            <div class="stats">
              <span class="stat">🐾 ${pookieCount}/${MAX_POOKIES_PER_WORLD} pookies</span>
              <span class="stat">🕐 Started: ${startTime}</span>
            </div>
            <div class="links">
              <a href="/worlds/${worldId}/state" class="btn">View State (JSON)</a>
              <code class="ws-url">ws://localhost:${PORT}/worlds/${worldId}/state/listen</code>
            </div>
          </div>
        `;
      }).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Guardian Angel - Game Server</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          min-height: 100vh;
          color: #e8e8e8;
          padding: 2rem;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        header {
          text-align: center;
          margin-bottom: 3rem;
        }
        h1 {
          font-size: 2.5rem;
          background: linear-gradient(90deg, #e94560, #f5a623);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          color: #8892b0;
          font-size: 1.1rem;
        }
        .world-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          backdrop-filter: blur(10px);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .world-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(233, 69, 96, 0.2);
        }
        .world-card h2 {
          color: #e94560;
          font-size: 1.4rem;
          margin-bottom: 0.75rem;
        }
        .stats {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .stat {
          color: #8892b0;
          font-size: 0.9rem;
        }
        .links {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #e94560, #f5a623);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          font-size: 0.9rem;
          transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .ws-url {
          background: rgba(0, 0, 0, 0.3);
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #64ffda;
        }
        .empty {
          text-align: center;
          color: #8892b0;
          padding: 3rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.1);
        }
        .api-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .api-section h3 {
          color: #f5a623;
          margin-bottom: 1rem;
        }
        .endpoint {
          background: rgba(0, 0, 0, 0.2);
          padding: 0.75rem 1rem;
          border-radius: 6px;
          margin-bottom: 0.5rem;
          font-family: 'Fira Code', monospace;
          font-size: 0.85rem;
        }
        .method {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: bold;
          margin-right: 0.5rem;
          font-size: 0.75rem;
        }
        .method.get { background: #3498db; }
        .method.post { background: #27ae60; }
        .method.ws { background: #9b59b6; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>👼 Guardian Angel</h1>
          <p class="subtitle">Game Server Dashboard</p>
        </header>
        
        <h3 style="color: #e94560; margin-bottom: 1rem;">Active Games (${worldIds.length})</h3>
        ${worldsHtml}
        
        <div class="api-section">
          <h3>API Endpoints</h3>
          <div class="endpoint">
            <span class="method post">POST</span>
            /worlds/:worldId/join
          </div>
          <div class="endpoint">
            <span class="method get">GET</span>
            /worlds/:worldId/state
          </div>
          <div class="endpoint">
            <span class="method ws">WS</span>
            /worlds/:worldId/state/listen
          </div>
          <div class="endpoint">
            <span class="method post">POST</span>
            /worlds/:worldId/pookies/:pookieId/guardian-angel/chat
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /worlds/:worldId/join
app.post('/worlds/:worldId/join', (req, res) => {
  const { worldId } = req.params;
  const world = getOrCreateWorld(worldId);
  
  const pookieCount = Object.keys(world.state.pookies).length;
  
  if (pookieCount >= MAX_POOKIES_PER_WORLD) {
    return res.status(400).json({
      error: 'Maximum number of pookies reached',
      maxPookies: MAX_POOKIES_PER_WORLD,
    });
  }
  
  const pookieId = `pookie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  world.state.pookies[pookieId] = createPookie(pookieId);
  
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
    return res.status(404).json({ error: 'World not found' });
  }
  
  const pookie = world.state.pookies[pookieId];
  
  if (!pookie) {
    return res.status(404).json({ error: 'Pookie not found' });
  }
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' });
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
