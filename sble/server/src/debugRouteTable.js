/**
 * TEMPORARY: walk Express app stack and log registered methods + paths.
 * Remove after LiveKit / 404 debugging is complete.
 */

function joinPaths(base, segment) {
  if (!segment || segment === '/') return base || '/';
  const b = (base || '').replace(/\/+$/, '');
  const s = segment.startsWith('/') ? segment : `/${segment}`;
  if (!b) return s.replace(/\/+/g, '/') || '/';
  return `${b}${s}`.replace(/\/+/g, '/');
}

function collectRoutes(stack, basePath, out) {
  if (!stack) return;
  for (let i = 0; i < stack.length; i += 1) {
    const layer = stack[i];
    if (layer.route) {
      const path = joinPaths(basePath, layer.route.path);
      const methods = layer.route.methods || {};
      Object.keys(methods).forEach((m) => {
        if (methods[m]) out.push({ method: m.toUpperCase(), path });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mountPath = typeof layer.path === 'string' ? layer.path : '';
      const nextBase = joinPaths(basePath, mountPath === '/' ? '' : mountPath);
      collectRoutes(layer.handle.stack, nextBase, out);
    }
  }
}

function logRegisteredRoutes(app, log) {
  const out = [];
  const rootStack = app._router && app._router.stack;
  const write = log && typeof log.info === 'function' ? (m) => log.info(m) : console.log;

  if (!rootStack) {
    write('[SBLE DEBUG] No app._router.stack — cannot list routes.');
    return;
  }

  collectRoutes(rootStack, '', out);
  const lines = out.map((r) => `${r.method.padEnd(7)} ${r.path}`).sort();
  write(`[SBLE DEBUG] Registered HTTP routes (${lines.length} entries). Verify POST /api/rooms/:roomToken/livekit-token exists.`);
  write(lines.join('\n'));

  const liveKit = out.filter((r) => r.path.includes('livekit-token'));
  write(`[SBLE DEBUG] Routes containing "livekit-token" (${liveKit.length}): ${JSON.stringify(liveKit)}`);
}

module.exports = { logRegisteredRoutes, collectRoutes };
