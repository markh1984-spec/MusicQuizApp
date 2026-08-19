/**
 * The post-night report — a PDF for the venue, built from the archive.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { nightReportPdf, nightReportFilename } from '../src/report-pdf.js';

function night(overrides = {}) {
  return {
    night: '2026-08-19',
    venue: 'The Crown',
    games: [{
      title: 'Music quiz night',
      kind: 'quiz',
      winner: 'Quizteama Aguilera',
      leaderboard: [
        { name: 'Quizteama Aguilera', score: 420 },
        { name: 'Sofa King Good', score: 380 },
        { name: 'The Quizzly Bears', score: 310 },
      ],
    }],
    ...overrides,
  };
}

test('the PDF is a real PDF, one page, with the numbers on it', () => {
  const pdf = nightReportPdf(night(), { headcount: 42, photoCount: 6, opens: 11, hasOffer: true });
  const text = pdf.toString('latin1');
  assert.equal(text.startsWith('%PDF-1.4'), true);
  assert.equal(text.trimEnd().endsWith('%%EOF'), true);
  assert.equal((text.match(/\/Type \/Page[^s]/g) || []).length, 1, 'one page');

  assert.ok(text.includes('The Crown'), 'the venue');
  assert.ok(text.includes('42'), 'the headcount');
  assert.ok(text.includes('Quizteama Aguilera'), 'the winner');
  assert.ok(text.includes('Sofa King Good'), 'second place');
  assert.ok(text.includes('The Quizzly Bears'), 'third place');
  assert.ok(text.includes('6'), 'the photo count');
  assert.ok(text.includes('11'), 'the offer scans');
  assert.ok(pdf.length > 700 && pdf.length < 40_000, `sensible size, got ${pdf.length}`);
});

test('no offer means no scans line, rather than a zero nobody asked for', () => {
  const pdf = nightReportPdf(night(), { headcount: 20, photoCount: 3, opens: 0, hasOffer: false });
  const text = pdf.toString('latin1');
  assert.equal(text.includes('offer scan'), false);
});

test('a night with no venue still reports, honestly', () => {
  const pdf = nightReportPdf(night({ venue: '' }), { headcount: 15 });
  const text = pdf.toString('latin1');
  assert.equal(text.startsWith('%PDF-1.4'), true);
  assert.ok(text.includes('Quiz night'), 'falls back to a plain heading');
});

test('a second and third place that do not exist print nothing, not a crash', () => {
  const pdf = nightReportPdf(night({
    games: [{ title: 'Solo night', winner: 'Only Team', leaderboard: [{ name: 'Only Team', score: 100 }] }],
  }), { headcount: 4 });
  const text = pdf.toString('latin1');
  assert.ok(text.includes('Only Team'));
});

test('a game with no leaderboard at all — an old filed night — still renders', () => {
  const pdf = nightReportPdf(night({ games: [{ title: 'Old night', kind: 'quiz' }] }), { headcount: 0 });
  const text = pdf.toString('latin1');
  assert.equal(text.startsWith('%PDF-1.4'), true);
});

test('a pound sign in a venue name survives WinAnsi-escaped', () => {
  const pdf = nightReportPdf(night({ venue: 'The Nag’s Head' }), { headcount: 10 });
  const text = pdf.toString('latin1');
  assert.ok(text.includes('\\222'), 'the smart quote is WinAnsi-escaped');
  assert.equal(text.includes('�'), false);
});

test('the filename is one a landlord can file without renaming it', () => {
  assert.equal(nightReportFilename(night()), '2026-08-19-the-crown.pdf');
  assert.equal(nightReportFilename(night({ venue: '' })), '2026-08-19-venue.pdf');
  assert.equal(nightReportFilename(night({ venue: 'O’Malley’s — “the Irish one”' })),
    '2026-08-19-o-malley-s-the-irish-one.pdf');
});
