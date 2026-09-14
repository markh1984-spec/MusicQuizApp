# Passwords — the minimum, and what pays for it

Split out of `docs/accounts.md` rather than added to it: that file was 94,812
bytes against a 100,000 ceiling, and the same rule that forbids a bucket in
`docs/` forbids squeezing one more area into a file already at its limit.

`docs/accounts.md` holds *Passwords and sessions* — scrypt, the per-account
salt, the timing-safe compare, and why a wrong password and an unknown address
give the identical message. This page is the one decision that page does not
cover: **how long a password has to be, and what the app checks instead.**

---

## Eight characters, and what bought the other four — `src/breached.js`

The minimum was ten. It came down to eight on 14 September 2026, and the
sentence that moved it is the whole argument:

> *"I think the issue is that this app requires a 10 character password and my
> standard password for apps is 8 characters… where can I change my password so
> it's only 8?"*

That is not somebody being careless. It is the failure mode a long minimum
actually has: it pushes a person off the password they will remember and onto
one they will not, and the session before this one was spent building a sign-in
link **because he had already forgotten the one this rule made him invent.** A
control that produces the thing it exists to prevent is the wrong control.

**But it is a REAL protection and could not simply be deleted.** So the four
characters were bought rather than given away, which is the only version of
this worth shipping.

### Length is a bad proxy and always was

`Password1` is nine characters. It satisfies the old rule, and it has been in
every cracking wordlist for twenty years. `correct horse` is thirteen and is
famous. Meanwhile a password nobody has ever used before is perfectly safe at
eight, because what takes an account is not brute force against a scrypt hash —
it is **reuse**: an address and a password lifted from somebody else's breach
and tried here.

That is also what NIST has said since SP 800-63B: drop the composition rules
and the long arbitrary minimum, and check the password against a list of ones
already known to be compromised. This app now does exactly that.

### How the check works, and the three things it must never do

`timesBreached()` hashes the password with SHA-1, sends **the first five hex
characters of that hash and nothing else**, and reads back the suffixes the
range holds. Have I Been Pwned's k-anonymity range API answers with every hash
in that bucket — some tens of thousands of accounts' worth — so the password,
its full hash and even its length never leave this server. `Add-Padding: true`
is set as well, which pads every response to a uniform size with decoy rows;
those arrive with a count of **0**, which is why the reader must compare the
count rather than merely finding the suffix.

- **IT FAILS OPEN.** `looksBreached()` answers *could not tell* as `false`. A
  timeout, a 503 or a proxy refusing the call lets the password through. The
  alternative is refusing to let somebody set a password because a third party
  is down — and the person doing that is, very often, **already locked out**,
  which is the state this whole area exists to get people out of. It is the
  same trade rule 4 makes at the join door: the cost of being too loose is a
  weak password, the cost of being too tight is a customer who cannot get in.
- **IT IS AT THE ROUTE, NOT IN `accounts.js`.** `checkPassword()` stays pure
  and synchronous: the rule about the SHAPE of a password is testable without
  a clock or a network, and the thing that can time out is not. This is the
  same boundary `applyBilling()` draws by having no send in it and `trials.js`
  draws by holding no clock.
- **EVERY ROUTE THAT SETS A PASSWORD ASKS IT**, and the test NAMES them rather
  than counting: the change on My account, the reset-link completion, and the
  create — **including the very first account, which is the owner's.** That one
  is the easiest to wave through and belongs to the person with the most to
  lose in the entire system.

### What it is not

It is not a strength meter, and there must never be one. A meter scores a
password on rules — a digit, a capital, a symbol — which is precisely the
advice that produced `Password1!` and a sticky note on a laptop. This asks one
question with a factual answer: *has this exact password already been in a
breach?* If it has, no amount of length helps; if it has not, eight characters
nobody else uses is fine.

And it is not a reason to put ten back. **The four characters and the breach
check are one trade.** Raising the minimum again without removing the check
takes back something that was paid for; removing the check and leaving eight
takes the protection away entirely. `test/breached.test.js` pins both halves.
