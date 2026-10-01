/**
 * THE LINE UNDER A STORY'S PHOTOGRAPH — when the next quiz is, worded for a
 * stranger scrolling past.
 *
 * Asked for with the Instagram Story export (1 October 2026, layout B, "the
 * poster"): every Story a pub posts is an advert for the next night, which is
 * the whole reason to post it. So the line is read off what the app already
 * knows rather than typed:
 *
 * - a residency is **"Every Thursday"** — evergreen, so a Story posted on a
 *   Monday is still true;
 * - otherwise the next booked night there, **"Next quiz: Thursday 8 October ·
 *   8pm"**, the time only when somebody typed one (a residency has none);
 * - otherwise **nothing** — *silence where there is nothing true to say*.
 *
 * A LEAF, pure: no DOM, the clock injected.
 */
import { WEEKDAY_LABELS, upcoming } from './diary.js';

/** 'thu' -> 'Thursday', from the diary's own labels. */
const DAY = Object.fromEntries(WEEKDAY_LABELS.map(([id, label]) => [id, label.replace(/s$/, '')]));

/** '20:00' -> '8pm', '19:30' -> '7.30pm' — how a British poster says it. */
export function clockWords(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(time || ''));
  if (!m) return '';
  const h = Number(m[1]);
  const min = m[2];
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${min === '00' ? '' : `.${min}`}${h < 12 ? 'am' : 'pm'}`;
}

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

export function storyLine(venueName, { venues = [], bookings = [], now = Date.now() } = {}) {
  if (!String(venueName || '').trim()) return '';
  const rec = venues.find((v) => sameName(v.name, venueName));
  if (rec && DAY[rec.usualNight]) return `Every ${DAY[rec.usualNight]}`;
  const next = upcoming({ venues, bookings, now }).find((n) => sameName(n.venue, venueName));
  if (!next) return '';
  const [y, mo, d] = next.date.split('-').map(Number);
  const day = new Date(y, mo - 1, d, 12).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const at = clockWords(next.time);
  return `Next quiz: ${day.replace(',', '')}${at ? ` · ${at}` : ''}`;
}
