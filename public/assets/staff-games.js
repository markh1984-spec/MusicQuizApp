/**
 * THE GAMES A STAFF LOGIN CAN HAVE — one each, chosen by the host on the
 * login's row (Community › Venues), drawn on that person's page as a Play
 * button. Read by the SERVER, which refuses an id not on this list, and by
 * both pages, so the three can never disagree about what exists.
 *
 * Blockyard was for Evie and Walkies for Tabby (3 October 2026), but nothing
 * here knows a name: any login can have either, or none.
 */
export const STAFF_GAMES = [
  { id: 'blockyard', name: 'Blockyard', line: 'dig and build', module: './blockyard-play.js', open: 'openBlockyard', named: 'character' },
  // THE NAME BOX IS THE DOG'S HERE — the walker is the login and already has
  // a name. "Character's name" on Walkies got the walker's own name typed in.
  { id: 'walkies', name: 'Walkies', line: 'a dog in the park', module: './walkies-play.js', open: 'openWalkies', named: 'dog' },
];

export const staffGame = (id) => STAFF_GAMES.find((g) => g.id === id) || null;
