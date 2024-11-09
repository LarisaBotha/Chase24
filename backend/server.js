// The file that needs to be hosted

import express from 'express';
import path from 'path';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
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
import playerRoutes from './routes/playerRoutes.js';
app.use('/api/players', playerRoutes);

//////////////
// Session
/////////////
import sessionRoutes from './routes/sessionRoutes.js';
app.use('/api/session', sessionRoutes);

//////////////
// Teams
/////////////
import teamRoutes, { setWss } from './routes/teamRoutes.js';
app.use('/api/teams', teamRoutes);

//////////////
// Leg
/////////////
import legRoutes from './routes/legRoutes.js';
app.use('/api/legs', legRoutes);


// Use Websockets
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setWss(wss); // Set the WebSocket server instance in teamRoutes

wss.on('connection', (ws, req) => {
  const sessionKey = req.url.split('?session_key=')[1];
  console.log(`WebSocket client connected to session: ${sessionKey}`);

  ws.on('message', (message) => {
    console.log('Received:', message);
  });

  ws.on('close', () => {
    console.log(`WebSocket client disconnected from session: ${sessionKey}`);
  });
});

// Start
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});