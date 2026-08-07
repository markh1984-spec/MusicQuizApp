#!/usr/bin/env node
/**
 * Create and manage accounts from the command line.
 *
 * The first two accounts have to be made from here, because there is nobody
 * signed in yet to make them from the owner console — and because a public
 * "create the first owner" page is a door that only ever needs opening once
 * and can be walked through by anybody who finds it before you do.
 *
 * Usage:
 *   npm run accounts -- list
 *   npm run accounts -- add-owner --email you@example.com
 *   npm run accounts -- add --email dave@example.com --name "Dave" --comped
 *   npm run accounts -- password --email dave@example.com
 *   npm run accounts -- addon --email dave@example.com --add admin
 *   npm run accounts -- status --email dave@example.com --set active
 *
 * A password is typed at the prompt rather than passed as an argument, so it
 * does not end up in your shell history or in a process list.
 */

import readline from 'node:readline';
import { paths } from '../src/config.js';
import { Accounts } from '../src/accounts.js';
import { ADDONS, STATUSES, entitlements } from '../public/assets/plans.js';

const args = process.argv.slice(2);
const command = args[0] || 'list';
const has = (flag) => args.includes(flag);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const book = new Accounts(paths.accounts);

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => { rl.close(); resolve(answer); });
  });
}

/** Asked twice, because a typo in a password you cannot see locks somebody out. */
async function newPassword() {
  const first = await ask('New password (at least 10 characters): ');
  const again = await ask('And again: ');
  if (first !== again) throw new Error('Those did not match.');
  return first;
}

function find() {
  const email = argOf('--email');
  if (!email) throw new Error('Which account? Use --email');
  const account = book.byEmail(email);
  if (!account) throw new Error(`No account for ${email}`);
  return account;
}

function show(account) {
  const badge = account.role === 'owner'
    ? 'OWNER'
    : `${account.comped ? 'comped' : account.status}${account.addons.length ? ' + ' + account.addons.join(' + ') : ''}`;
  console.log(`  ${account.email.padEnd(32)} ${(account.name || '').padEnd(18)} ${badge}`);
  if (has('--verbose')) console.log(`      ${entitlements(account).features.join(', ') || 'nothing'}`);
}

async function main() {
  switch (command) {
    case 'list': {
      if (!book.all.length) {
        console.log('\nNo accounts yet. The host key still works meanwhile.');
        console.log('\nStart with:\n  npm run accounts -- add-owner --email you@example.com\n');
        return;
      }
      console.log('');
      for (const account of book.all) show(account);
      console.log(`\n${book.all.length} account${book.all.length === 1 ? '' : 's'} in ${paths.accounts}\n`);
      return;
    }

    case 'add-owner': {
      const password = await newPassword();
      const made = book.create({
        email: argOf('--email'), password, name: argOf('--name', 'Owner'), role: 'owner',
      });
      console.log('\nOwner account created. Sign in at /login and you land on /owner.\n');
      show(made);
      console.log('');
      return;
    }

    case 'add': {
      const password = await newPassword();
      const made = book.create({
        email: argOf('--email'),
        password,
        name: argOf('--name', ''),
        comped: has('--comped'),
        addons: argOf('--addons', '').split(',').map((a) => a.trim()).filter(Boolean),
        status: argOf('--status', has('--comped') ? 'active' : 'trialing'),
      });
      console.log('\nQuizmaster account created.\n');
      show(made);
      console.log('');
      return;
    }

    case 'password': {
      const account = find();
      const password = await newPassword();
      book.setPassword(account.id, password);
      console.log(`\nDone. Everything signed in as ${account.email} has been signed out.\n`);
      return;
    }

    case 'addon': {
      const account = find();
      const add = argOf('--add');
      const drop = argOf('--remove');
      if (add && !ADDONS[add]) throw new Error(`"${add}" is not an add-on. Use ${Object.keys(ADDONS).join(', ')}.`);
      const addons = new Set(account.addons || []);
      if (add) addons.add(add);
      if (drop) addons.delete(drop);
      show(book.update(account.id, { addons: [...addons] }));
      return;
    }

    case 'status': {
      const account = find();
      const set = argOf('--set');
      if (!STATUSES.includes(set)) throw new Error(`Use --set with one of ${STATUSES.join(', ')}`);
      show(book.update(account.id, { status: set }));
      return;
    }

    case 'comp': {
      const account = find();
      show(book.update(account.id, { comped: !has('--off') }));
      return;
    }

    default:
      console.log(`Unknown command "${command}". Try: list, add-owner, add, password, addon, status, comp`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
