/**
 * A SECOND LAPTOP — no cookie, no key, the address typed by hand.
 *
 * ---
 *
 * The photo wall is meant to stand on whatever screen is spare, and the
 * cheapest version of that is not an HDMI cable at all: *"I do actually have a
 * second laptop I can use for this purpose."* An HDMI SPLITTER cannot help —
 * one input, N identical outputs is its whole job — so a second browser on the
 * venue wifi is the version that needs no hardware and is what a real night is
 * most likely to run.
 *
 * **AND IT IS THE ONE COMBINATION NOTHING ELSE COVERS.** `second-screen.mjs`
 * opens the wall with no cookie but on the HOUSE room, where there is no join
 * code; `two-screens.mjs` uses a real `?g=` but from the tab that is already
 * signed in. **A real `?g=` from a browser that has never seen this app** —
 * exactly a second laptop — fell between the two, and it is the case where a
 * stray auth check would send a machine in a pub to a password box.
 *
 * It also pins the thing a typo must not do: a wrong code shows NOBODY's
 * photographs. `roomForPhone()` refuses an unknown code rather than falling
 * back to the house room — the rule a printed QR going stale after a deploy
 * already paid for — and this is that rule reaching a screen.
 *
 *     node scripts/second-laptop.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { startApp } from '/home/user/MusicQuizApp/scripts/helpers/live-app.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const KEY='second-laptop';
const { Accounts } = await import('/home/user/MusicQuizApp/src/accounts.js');
const { base: B, stop } = await startApp({ key: KEY, async seed(dir){
  const book = new Accounts(path.join(dir,'accounts.json'));
  book.create({email:'qm@example.com',password:'quizmaster passphrase',name:'Mark',role:'quizmaster',tier:'gold',status:'active'});
  book.save();
}});
let fails=0; const check=(n,ok,d='')=>{ if(!ok)fails++; console.log(`${ok?'  ok  ':'  FAIL'} ${n}${d?`  — ${d}`:''}`); };
const b = await chromium.launch();
try {
  // Laptop one: signed in, launches the night.
  const mine = await b.newContext(); const page = await mine.newPage();
  await page.goto(`${B}/login`); await page.fill('input[type=email]','qm@example.com');
  await page.fill('input[type=password]','quizmaster passphrase');
  await page.evaluate(()=>document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(2500);
  const lib = await page.evaluate(()=>fetch('/api/library').then(r=>r.json()));
  const pack = (lib.quiz||lib.text||[])[0]||(lib.quizzes||[])[0];
  await page.evaluate((id)=>fetch('/api/host/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:'quiz',packId:id,replace:true,venue:'The Laughing Dog'})}),pack.id);
  const code = (await page.evaluate(()=>fetch('/api/library').then(r=>r.json()))).running.joinCode;
  console.log(`\n  join code: ${code}\n`);

  // A phone sends a photo.
  const ph = await b.newPage({viewport:{width:390,height:844}});
  await ph.goto(`${B}/play?g=${code}`); await ph.fill('#nameInput','The Back Table'); await ph.click('#joinBtn');
  await ph.waitForTimeout(1200);
  await ph.evaluate(async ()=>{
    const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#e74c3c';x.fillRect(0,0,400,300);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
    const me=JSON.parse(localStorage.getItem('musicquiz.player')||'{}');
    const g=new URLSearchParams(location.search).get('g')||'';
    await fetch(`/api/photo?playerId=${me.id}&camera=1&g=${g}`,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob});
  });

  /* LAPTOP TWO — a brand new context. No cookie, no localStorage, no key. */
  const other = await b.newContext({ viewport:{width:1280,height:720} });
  const laptop2 = await other.newPage();
  const boom=[]; laptop2.on('pageerror',e=>boom.push(String(e)));
  const res = await laptop2.goto(`${B}/wall?g=${code}`);
  check('a laptop that has never seen the app gets the page', res.status() === 200, String(res.status()));
  check('and is NOT bounced to a login', !laptop2.url().includes('/login'), laptop2.url().replace(B,''));
  await laptop2.waitForSelector('.wall-qr img',{timeout:10000}).catch(()=>{});
  check('it draws the code', await laptop2.locator('.wall-qr img').count() === 1);
  check('and the photo already sent is on it',
    await laptop2.locator('.wall-shot').count() === 1,
    'it drew the frame but not the room\'s photographs');
  const brand = await laptop2.locator('#brandSlot').innerText();
  check('and it wears the right quizmaster\'s branding', /Mark/i.test(brand), brand.replace(/\n/g,' '));
  const cookies = await other.cookies();
  check('with no cookie needed at all', cookies.length === 0, JSON.stringify(cookies.map(c=>c.name)));

  // And it keeps updating — a second photo lands while it sits there.
  await ph.evaluate(async ()=>{
    const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#3498db';x.fillRect(0,0,400,300);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
    const me=JSON.parse(localStorage.getItem('musicquiz.player')||'{}');
    const g=new URLSearchParams(location.search).get('g')||'';
    await fetch(`/api/photo?playerId=${me.id}&camera=1&g=${g}`,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob});
  });
  await laptop2.waitForTimeout(1800);
  check('and it keeps updating while it sits there untouched',
    await laptop2.locator('.wall-shot').count() === 2,
    'it drew once and then went stale');

  // A WRONG code must not hand it somebody else's room.
  const wrong = await other.newPage();
  await wrong.goto(`${B}/wall?g=ZZZZ`);
  await wrong.waitForTimeout(1500);
  check('and a mistyped code shows NOBODY\'s photographs',
    await wrong.locator('.wall-shot').count() === 0,
    'a typo handed a stranger this room');
  check('nothing threw', boom.length===0, boom.join(' | '));
} finally { await b.close().catch(()=>{}); await stop(); }
console.log(fails?`\n${fails} FAILED`:'\nAll good.');
process.exit(fails?1:0);
