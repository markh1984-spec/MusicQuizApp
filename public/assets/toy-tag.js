/**
 * A NAME OVER A CHARACTER'S HEAD — the staff games' (`staff-games.js`). The
 * name is the login's own, typed by the host on its row; the games ship with
 * none. Centred on `cx`, sitting on `bottom`, kept inside the picture.
 */
export function nameTag(g, text, cx, bottom, width) {
  if (!text) return;
  g.save();
  g.font = '700 13px system-ui, sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 14;
  const h = 22;
  const x = Math.max(4, Math.min(width - w - 4, cx - w / 2));
  const y = Math.max(4, bottom - h);
  g.fillStyle = 'rgba(8, 8, 14, 0.62)';
  g.beginPath();
  g.moveTo(x + 8, y);
  g.arcTo(x + w, y, x + w, y + h, 8);
  g.arcTo(x + w, y + h, x, y + h, 8);
  g.arcTo(x, y + h, x, y, 8);
  g.arcTo(x, y, x + w, y, 8);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}
