const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');

/**
 * WebRTC Signaling Server
 * Handles offer/answer/ICE candidate exchange between peers in a room.
 * Room peer state is tracked in-process; Redis pub/sub is used for
 * cross-process broadcast (supports multiple server instances).
 */
const initWebRTC = (httpServer, redisClient) => {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/' });

  // Local peer registry: Map<roomToken, Map<peerId, ws>>
  const rooms = new Map();

  // Redis pub/sub — only enabled if redisClient is provided
  if (redisClient) {
    const subscriber = redisClient.duplicate();
    subscriber.subscribe('webrtc', (err) => {
      if (err) logger.error('Redis subscribe error:', err);
    });

    subscriber.on('message', (channel, message) => {
      try {
        const { roomToken, senderId, msg } = JSON.parse(message);
        const room = rooms.get(roomToken);
        if (!room) return;
        if (msg.to && room.has(msg.to)) {
          room.get(msg.to).send(JSON.stringify(msg));
        } else if (!msg.to) {
          broadcast(room, senderId, msg);
        }
      } catch (err) {
        logger.error('Redis message parse error:', err);
      }
    });
    logger.info('WebRTC Redis pub/sub enabled');
  } else {
    logger.warn('Redis not configured — WebRTC signaling is single-instance only');
  }

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/ws/?', ''));
    const roomToken = params.get('room');
    const peerId = uuidv4();

    if (!roomToken) {
      ws.close(1008, 'Room token required');
      return;
    }

    // Join room
    if (!rooms.has(roomToken)) rooms.set(roomToken, new Map());
    const room = rooms.get(roomToken);
    room.set(peerId, ws);

    logger.info(`Peer ${peerId} joined room ${roomToken}`);

    // Notify existing peers of new peer
    broadcast(room, peerId, { type: 'peer-joined', peerId });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        msg.from = peerId;

        switch (msg.type) {
          case 'offer':
          case 'answer':
          case 'ice-candidate':
            // Forward to specific peer
            if (msg.to && room.has(msg.to)) {
              room.get(msg.to).send(JSON.stringify(msg));
            }
            break;
          case 'chat':
            // Broadcast chat to all in room
            broadcast(room, peerId, msg);
            break;
          default:
            logger.warn(`Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        logger.error('WebRTC message parse error:', err);
      }
    });

    ws.on('close', () => {
      room.delete(peerId);
      broadcast(room, peerId, { type: 'peer-left', peerId });
      if (room.size === 0) rooms.delete(roomToken);
      logger.info(`Peer ${peerId} left room ${roomToken}`);
    });

    // Send peer their own ID
    ws.send(JSON.stringify({ type: 'connected', peerId }));
  });

  logger.info('WebRTC signaling server initialized');
};

// Broadcast to all peers in room except sender
const broadcast = (room, senderId, message) => {
  const data = JSON.stringify(message);
  room.forEach((ws, id) => {
    if (id !== senderId && ws.readyState === 1) {
      ws.send(data);
    }
  });
};

module.exports = initWebRTC;
