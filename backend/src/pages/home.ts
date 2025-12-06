import type { WorldState } from '../world.js';

export type WorldsViewData = Record<string, { state: WorldState }>;

export function renderHomePage(worlds: WorldsViewData, maxPookies: number, port: number): string {
  const worldIds = Object.keys(worlds);
  
  const worldsHtml = worldIds.length === 0 
    ? '<p class="empty">No games currently running. Create a world first using POST /worlds/create!</p>'
    : worldIds.map(worldId => {
        const world = worlds[worldId];
        const pookieNames = Object.keys(world.state.pookies);
        const pookieCount = pookieNames.length;
        const startTime = new Date(world.state.startTimestampMillis).toLocaleString();
        const pookieOptions = pookieNames.map(name => `<option value="${name}">${name}</option>`).join('');
        return `
          <div class="world-card">
            <h2>${worldId}</h2>
            <div class="stats">
              <span class="stat">🐾 ${pookieCount}/${maxPookies} pookies</span>
              <span class="stat">🕐 Started: ${startTime}</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="joinWorld('${worldId}')">Join World</button>
              <a href="/worlds/${worldId}/state" class="btn btn-secondary" target="_blank">View State</a>
              <button class="btn btn-secondary" onclick="connectWs('${worldId}')">Connect WS</button>
            </div>
            ${pookieCount > 0 ? `
              <div class="chat-form">
                <select id="pookie-${worldId}" class="input">
                  ${pookieOptions}
                </select>
                <input type="text" id="text-${worldId}" class="input" placeholder="Message for guardian angel">
                <button class="btn btn-small" onclick="sendChat('${worldId}')">Send Chat</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

  return `
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
        .actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .chat-form {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.1);
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
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-secondary {
          background: rgba(255,255,255,0.1);
        }
        .btn-small {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
        }
        .input, .textarea {
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.3);
          color: #e8e8e8;
          font-size: 0.9rem;
          flex: 1;
          min-width: 150px;
        }
        .textarea {
          min-height: 100px;
          font-family: 'Fira Code', monospace;
          font-size: 0.8rem;
        }
        .input:focus, .textarea:focus {
          outline: none;
          border-color: #e94560;
        }
        .empty {
          text-align: center;
          color: #8892b0;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.1);
        }
        .section {
          margin-bottom: 2rem;
        }
        .section h3 {
          color: #f5a623;
          margin-bottom: 1rem;
        }
        .form-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        .form-col {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }
        .result-box {
          background: rgba(0,0,0,0.4);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
          font-family: 'Fira Code', monospace;
          font-size: 0.85rem;
          max-height: 300px;
          overflow: auto;
          display: none;
        }
        .result-box.show { display: block; }
        .result-box pre { white-space: pre-wrap; word-break: break-all; }
        .result-box .success { color: #64ffda; }
        .result-box .error { color: #ff6b6b; }
        .ws-status {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          background: rgba(100,255,218,0.2);
          color: #64ffda;
        }
        .ws-status.disconnected {
          background: rgba(255,107,107,0.2);
          color: #ff6b6b;
        }
        .code-hint {
          font-size: 0.75rem;
          color: #8892b0;
          margin-top: 0.25rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>👼 Guardian Angel</h1>
          <p class="subtitle">Game Server Dashboard</p>
        </header>
        
        <div class="section">
          <h3>🆕 Create World</h3>
          <div class="form-row">
            <input type="text" id="createWorldId" class="input" placeholder="World ID (e.g., my-world)" style="max-width: 200px;">
            <button class="btn" onclick="createWorld()">Create World</button>
          </div>
          <div class="form-col" style="margin-top: 0.5rem;">
            <textarea id="levelJson" class="textarea" placeholder='Level JSON (CustomLevel object)'>{
  "maxPlayers": 4,
  "width": 800,
  "height": 600,
  "speechDistance": 100,
  "walkSpeedPerSecond": 50,
  "backgroundImage": {
    "url": "https://example.com/bg.png",
    "scale": 0.5
  },
  "itemTypes": {},
  "facilities": {
    "well": {
      "x": 100,
      "y": 200,
      "displayName": "Water Well",
      "interactionPrompt": "Press E to drink",
      "interactionName": "drink",
      "variables": { "waterLevel": 100 }
    }
  }
}</textarea>
          </div>
        </div>

        <div class="section">
          <h3>🌍 Active Games (${worldIds.length})</h3>
          ${worldsHtml}
        </div>
        
        <div class="section">
          <h3>💬 Guardian Angel Chat</h3>
          <div class="form-row">
            <input type="text" id="chatWorldId" class="input" placeholder="World ID" style="max-width: 200px;">
            <input type="text" id="chatPookieName" class="input" placeholder="Pookie Name" style="max-width: 200px;">
            <input type="text" id="chatText" class="input" placeholder="Message text">
            <button class="btn" onclick="sendChatManual()">Send</button>
          </div>
        </div>

        <div id="result" class="result-box">
          <pre></pre>
        </div>
        
        <div id="wsMessages" class="result-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <span>WebSocket Messages</span>
            <span id="wsStatus" class="ws-status disconnected">Disconnected</span>
          </div>
          <pre id="wsContent"></pre>
        </div>
      </div>

      <script>
        let ws = null;
        
        function showResult(content, isError = false) {
          const box = document.getElementById('result');
          const pre = box.querySelector('pre');
          pre.className = isError ? 'error' : 'success';
          pre.textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
          box.classList.add('show');
        }

        async function createWorld() {
          const worldId = document.getElementById('createWorldId').value;
          const levelJson = document.getElementById('levelJson').value;
          if (!worldId) return alert('Please enter a World ID');
          let level;
          try {
            level = JSON.parse(levelJson);
          } catch (e) {
            return alert('Invalid JSON for level: ' + e.message);
          }
          try {
            const res = await fetch('/worlds/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ worldId, level })
            });
            const data = await res.json();
            showResult(data, !res.ok);
            if (res.ok) setTimeout(() => location.reload(), 500);
          } catch (e) {
            showResult(e.message, true);
          }
        }

        async function joinWorld(worldId) {
          if (!worldId) return alert('Please enter a World ID');
          try {
            const res = await fetch('/worlds/' + worldId + '/join', { method: 'POST' });
            const data = await res.json();
            showResult(data, !res.ok);
            if (res.ok) setTimeout(() => location.reload(), 500);
          } catch (e) {
            showResult(e.message, true);
          }
        }

        function viewState(worldId) {
          if (!worldId) return alert('Please enter a World ID');
          window.open('/worlds/' + worldId + '/state', '_blank');
        }

        function connectWs(worldId) {
          if (ws) ws.close();
          const wsBox = document.getElementById('wsMessages');
          const wsContent = document.getElementById('wsContent');
          const wsStatus = document.getElementById('wsStatus');
          
          wsBox.classList.add('show');
          wsContent.textContent = 'Connecting...\\n';
          
          ws = new WebSocket('ws://localhost:${port}/worlds/' + worldId + '/state/listen');
          
          ws.onopen = () => {
            wsStatus.textContent = 'Connected: ' + worldId;
            wsStatus.classList.remove('disconnected');
            wsContent.textContent += 'Connected!\\n\\n';
          };
          
          ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            wsContent.textContent += new Date().toLocaleTimeString() + ':\\n' + JSON.stringify(data, null, 2) + '\\n\\n';
            wsContent.parentElement.scrollTop = wsContent.parentElement.scrollHeight;
          };
          
          ws.onclose = () => {
            wsStatus.textContent = 'Disconnected';
            wsStatus.classList.add('disconnected');
            wsContent.textContent += 'Disconnected.\\n';
          };
          
          ws.onerror = () => {
            wsContent.textContent += 'Error connecting.\\n';
          };
        }

        async function sendChat(worldId) {
          const pookieName = document.getElementById('pookie-' + worldId).value;
          const text = document.getElementById('text-' + worldId).value;
          if (!text) return alert('Please enter a message');
          try {
            const res = await fetch('/worlds/' + worldId + '/pookies/' + pookieName + '/guardian-angel/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            const data = await res.json();
            showResult(data, !res.ok);
          } catch (e) {
            showResult(e.message, true);
          }
        }

        async function sendChatManual() {
          const worldId = document.getElementById('chatWorldId').value;
          const pookieName = document.getElementById('chatPookieName').value;
          const text = document.getElementById('chatText').value;
          if (!worldId || !pookieName || !text) return alert('Please fill all fields');
          try {
            const res = await fetch('/worlds/' + worldId + '/pookies/' + pookieName + '/guardian-angel/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            const data = await res.json();
            showResult(data, !res.ok);
          } catch (e) {
            showResult(e.message, true);
          }
        }
      </script>
    </body>
    </html>
  `;
}
