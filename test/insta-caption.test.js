/**
 * THE SOCIALS CAPTION — drafted off what the app already knows.
 *
 * A pure leaf, so it is tested here rather than in a browser: no DOM, no
 * fetch, and `upcoming()` injected so nothing is on a clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { captionFor, whenWords, playedOn, townOf } = await import('../public/assets/insta-caption.js');

const NIGHT = {
  night: '2026-08-20',
  venue: 'The Station Tap, Wokingham',
  games: [{ players: 58 }, { players: 41 }],
};
const diary = () => [{ date: '2026-08-27', venue: 'The Station Tap, Wokingham' }];

test('the whole caption, with everything to say', () => {
  const out = captionFor({ night: NIGHT, gallery: 'https://q.co.uk/g/station-tap-wokingham/2026-08-20', nextNight: diary });
  assert.match(out, /Another one at The Station Tap, Wokingham/);
  assert.match(out, /58 playing\./);
  assert.match(out, /Back Thursday 27th — same time, same place\./);
  assert.match(out, /All the photos: https:\/\/q\.co\.uk\/g\//);
  assert.match(out, /#pubquiz #quiznight #wokingham/);
});

test('THE HEADCOUNT IS THE MAX ACROSS THE GAMES, NEVER THE SUM', () => {
  // A quiz and the bingo after it are the same forty people — `headcounts.js`
  // has held this rule for months and a second reader must not disagree.
  assert.equal(playedOn(NIGHT), 58);
  assert.doesNotMatch(captionFor({ night: NIGHT, nextNight: diary }), /99/);
});

test('SILENCE WHERE THERE IS NOTHING TRUE TO SAY', () => {
  const bare = captionFor({ night: { night: '2026-08-20', venue: '', games: [] } });
  assert.match(bare, /Another quiz night/);
  assert.doesNotMatch(bare, /playing/, 'it invented a headcount');
  assert.doesNotMatch(bare, /Back /, 'it invented a date');
  assert.doesNotMatch(bare, /photos:/, 'it invented an address');
  // The two that are always true still go on.
  assert.match(bare, /#pubquiz #quiznight/);
});

test('the next date is the one AT THIS PUB, and never in the past', () => {
  /*
   * A caption under photographs of one pub saying "back Tuesday" about another
   * reads as carelessness to the venue it names.
   */
  const elsewhere = () => [{ date: '2026-08-25', venue: 'The Crown, Reading' }];
  assert.doesNotMatch(captionFor({ night: NIGHT, nextNight: elsewhere }), /Back /);
  const gone = () => [{ date: '2026-08-13', venue: 'The Station Tap, Wokingham' }];
  assert.doesNotMatch(captionFor({ night: NIGHT, nextNight: gone }), /Back /);
});

test('THE WINNING TEAM IS NOT IN IT, and that is the decision', () => {
  /*
   * A team's name in a caption HE posts is a public naming they never agreed
   * to, and `clean-names.js` is on the SERVER by design — so the browser holds
   * the real name and has no safe way to judge it. He reads the caption; if he
   * wants to name them he knows them.
   */
  const withWinner = { ...NIGHT, games: [{ players: 58, winner: 'Beer Pressure' }] };
  assert.doesNotMatch(captionFor({ night: withWinner, nextNight: diary }), /Beer Pressure/);
});

test('a town becomes a hashtag, and a pub with no town does not invent one', () => {
  assert.equal(townOf('The Station Tap, Wokingham'), 'Wokingham');
  assert.equal(townOf('The Crown'), '');
  const noTown = captionFor({ night: { ...NIGHT, venue: 'The Crown' } });
  assert.match(noTown, /#pubquiz #quiznight$/, 'it invented a place');
  // Punctuation and spaces cannot break a hashtag.
  assert.match(captionFor({ night: { ...NIGHT, venue: "Paddy's Bar, Milton-under-Wychwood" } }), /#miltonunderwychwood/);
});

test('the date reads the way the comeback slide already words it', () => {
  assert.equal(whenWords('2026-08-27'), 'Thursday 27th');
  assert.equal(whenWords('2026-09-01'), 'Tuesday 1st');
  assert.equal(whenWords('2026-09-02'), 'Wednesday 2nd');
  assert.equal(whenWords('2026-09-03'), 'Thursday 3rd');
  assert.equal(whenWords('2026-09-11'), 'Friday 11th');
  assert.equal(whenWords('2026-09-22'), 'Tuesday 22nd');
  assert.equal(whenWords('not a date'), '');
});
