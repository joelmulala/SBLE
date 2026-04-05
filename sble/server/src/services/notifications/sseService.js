/**
 * Server-Sent Events (SSE) notification service.
 * Clients connect to GET /api/notifications/stream and receive real-time events.
 */

// Map<userId, res>
const clients = new Map();

const addClient = (userId, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.set(userId, res);

  res.on('close', () => {
    clients.delete(userId);
  });
};

const sendToUser = (userId, event, data) => {
  const res = clients.get(userId);
  if (res) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
};

const broadcast = (event, data) => {
  clients.forEach((res) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
};

module.exports = { addClient, sendToUser, broadcast };
