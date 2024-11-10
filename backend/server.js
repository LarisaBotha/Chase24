// The file that needs to be hosted

import express from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url'; // Required for ES modules

// Get the current directory name (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8080; 
const app = express();

// Allow all origins
app.use(cors());

// Allow JSON payloads
app.use(express.json());

// Used to understand URL-encoded form data
app.use(express.urlencoded({ extended: true })); 

// Serve static resources
app.use(express.static(path.join(__dirname, 'public'))); 

////////////////////////////////////////
// Devide the endpoints into categories
////////////////////////////////////////

//////////////
// Player
/////////////
import playerRoutes, { fetchSortedPlayersBySession } from './routes/playerRoutes.js';
app.use('/api/players', playerRoutes);

//////////////
// Session
/////////////
import sessionRoutes from './routes/sessionRoutes.js';
app.use('/api/session', sessionRoutes);

//////////////
// Teams
/////////////
import teamRoutes from './routes/teamRoutes.js';
app.use('/api/teams', teamRoutes);

//////////////
// Leg
/////////////
import legRoutes from './routes/legRoutes.js';
app.use('/api/legs', legRoutes);

// Use Websockets
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clientsBySession = new Map(); // Map to track clients by session_key

export const sendUpdateToSessionClients = async (session_key) => {
  if (!wss || !wss.clients) {
    console.error('WebSocket server not initialized');
    return;
  }

  const message = await fetchSortedPlayersBySession(session_key);
  
  const sessionClients = clientsBySession.get(session_key);
  if (sessionClients) {
    sessionClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } else {
    console.log(`No clients connected for sessionKey: ${session_key}`);
  }
};

wss.on('connection', (ws, req) => {
  const sessionKey = req.url.split('?session_key=')[1];
  console.log(`WebSocket client connected to session: ${sessionKey}`);

  // Add client to the session map
  if (!clientsBySession.has(sessionKey)) {
    clientsBySession.set(sessionKey, new Set());
  }
  clientsBySession.get(sessionKey).add(ws);

  // Send initial player data
  sendUpdateToSessionClients(sessionKey);

  // Handle incoming messages
  ws.on('message', (message) => {
    console.log('Received:', message);
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`WebSocket client disconnected from session: ${sessionKey}`);
    const sessionClients = clientsBySession.get(sessionKey);
    if (sessionClients) {
      sessionClients.delete(ws);
      if (sessionClients.size === 0) {
        clientsBySession.delete(sessionKey); // Remove session if no clients remain
      }
    }
  });
});

// Start
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});