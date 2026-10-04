/**
 * A NAME OVER A CHARACTER'S HEAD — the staff games' (`staff-games.js`). The
 * name is the login's own, typed by the host on its row; the games ship with
 * none. Centred on `cx`, sitting on `bottom`, kept inside the picture.
 */
export function nameTag(g, text, cx, bottom, width, { bright = false } = {}) {
  if (!text) return;
  g.save();
  // BRIGHT is white with dark words — for a name somebody must read going
  // past (the cats, the zombies); the quiet dark one is for the players.
  g.font = bright ? '800 15px system-ui, sans-serif' : '700 13px system-ui, sans-serif';
  const w = Math.ceil(g.measureText(text).width) + (bright ? 16 : 14);
  const h = bright ? 25 : 22;
  const x = Math.max(4, Math.min(width - w - 4, cx - w / 2));
  const y = Math.max(4, bottom - h);
  g.fillStyle = bright ? '#ffffff' : 'rgba(8, 8, 14, 0.62)';
  g.beginPath();
  g.moveTo(x + 8, y);
  g.arcTo(x + w, y, x + w, y + h, 8);
  g.arcTo(x + w, y + h, x, y + h, 8);
  g.arcTo(x, y + h, x, y, 8);
  g.arcTo(x, y, x + w, y, 8);
  g.closePath();
  g.fill();
  if (bright) { g.strokeStyle = '#2a2a33'; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = bright ? '#1b1b22' : '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}

/** A heart for a life — filled while it is still there, an outline once spent. */
export function heart(g, cx, cy, r, full) {
  g.save();
  g.beginPath();
  g.moveTo(cx, cy + r * 0.9);
  g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.45);
  g.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.9);
  g.closePath();
  if (full) { g.fillStyle = '#ff4d5e'; g.fill(); }
  g.lineWidth = 2;
  g.strokeStyle = full ? '#7a1020' : 'rgba(255, 255, 255, 0.8)';
  g.stroke();
  g.restore();
}
