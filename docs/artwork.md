# Artwork — the shared portrait library, and who draws it

The reasoning behind the artwork rules in CLAUDE.md. Read this before
changing anything about how round 2's pictures are made, priced or keyed —
every paragraph here is a mistake that was made once and cost either money or
a refusal nobody could explain.

**The rules themselves live in CLAUDE.md and are the short version.** This is
the why.

---

## The portrait library — one picture per musician, shared by every quiz

`src/portraits.js`. Artwork used to be filed per quiz — `images/eighties/
madonna.png` — so Madonna in the 80s quiz and Madonna in the Pop Divas quiz
were two files, drawn twice and **paid for twice**. Across a few hundred
musicians that was the largest avoidable cost in the app. A picture is now
named after the PERSON: `portraits/madonna.png`.

**The key is the musician's name and the style, and NOTHING else. That is the
load-bearing decision and it was arrived at by getting it wrong first.** The
obvious design keys off the question's own `imagePrompt` — but those are
written by *Claude* during quiz generation, so two quizzes wanting Madonna get
two slightly different sentences, two keys and two bills. The host never typed
either sentence, so he could not know it had happened, and the saving would
quietly evaporate looking exactly like success. A question's `imagePrompt`
still shapes the drawing, but **only on the first draw of that person in that
style**; every later pack reuses whatever is there.

So **a second version of somebody only ever comes from the host doing something
deliberate** — picking a different style, or asking for a redraw. Never from
Claude's wording. There is no numeric cap and no "2 versions per person" rule,
because a cap is the mess: it means deleting one the day you want a third, and
nothing on screen says which of the two you are looking at.

`generateImages()` **repoints a pack as it goes** and returns `repointed`; the
server saves the quiz when it is non-empty (`allowProblems: true`, same reason
ticking a review flag has it). So a pack written before the library existed
moves onto it the next time its pictures are made, and pays nothing to do so.

`imagePlan()` says what a press would cost **before** anything is spent —
"6 already in the library, free · 4 to draw — about 16p". That number is the
whole point of sharing, so it is read first rather than reported afterwards.

### ONE style, and that is a measured result

`STYLES`: **Cartoon**, and nothing else. The host's choice always beats
whatever Claude wrote, or choosing a style would silently do nothing on the
many questions where the generator wrote a prompt of its own, and would read as
a broken setting.

**Two of the three styles written have been refused by the supplier.**
`portrait` (painted, true to life) and `As a superhero` both came back with
*"the model could not generate the image based on the prompt provided"* in
Google's own playground. Putting a real musician into an invented costume is
apparently a step past a caricature of them, whatever register the words are
in. Both were deleted rather than reworded, on the host's own rule: do not ship
a setting that pretends we can do something we cannot.

So **adding a style is a line in the file and a minute in the playground
FIRST**, and the hit rate so far is one in three. Candidates worth trying, all
of which keep the person looking as they actually look: pop-art halftone,
black-and-white comic inking, cut-paper collage, 8-bit pixel art.

**Every style is a whole second library of the same people**, so five styles is
five times the bill for the same musicians — which hands straight back what
sharing just saved. Adding one is a line in that file; do it because a night
needs it, not for the sake of choice. `--<style>` is the filename suffix and
the default has none, so a library built before styles existed still fits.

**There is no photoreal option on purpose, and that is a legal decision.** The
on-screen caption "AI-generated illustration — not a real photograph" is doing
real work: UK fair dealing is a closed list and does not cover commercial
entertainment, so a convincing fake photograph of a real living musician in a
pack that is SOLD is the one version worth not having. `promptFor()` rules out
a photograph whatever the style says, and there is a test that every style
does. There is also a test that no style id contains "photo" or "real".

**There used to be a third, `portrait` — painted, true to life, and the
DEFAULT — and it is gone because the supplier will not draw it.** Tested by
hand in Google's own playground: *"do me a Michael Jackson cartoon"* is drawn,
and asking for an *illustration* of the same person is refused. The line is how
real the picture is trying to look, not who is in it. The host's call was:
**if we cannot do the realistic end, do not ship a setting that pretends we
can** — so it was deleted rather than reworded, and every remaining style is in
the cartoon register.

**And the refused word was in the prompt EVERY style sends.** `promptFor()`
appended *"It must clearly be an illustration and not a photograph"* — so all
three would have been refused, on every question, and from the console that
looks exactly like a bad key. It now says "It is a cartoon drawing, not a
photograph": same guarantee, and it leads with what IS wanted rather than with
what is not. There is a test that no prompt contains the word "illustration"
and that every one says "cartoon".

**Adding a style is a line in the file and a minute in the playground FIRST.**
A style that gets refused is a control that does nothing, which is the fault
this file keeps recording. Candidates worth trying, roughly in order of how
likely they are to be allowed: pop-art halftone, black-and-white comic inking,
cut-paper collage, 8-bit pixel art.

### Moving the default style was free exactly once

The default has no filename suffix — `portraits/madonna.png` — so changing
which style is the default silently changes what every unsuffixed file MEANS.
`images/portraits/` was empty when this happened (there has never been an image
key on this app), so there was nothing to rename and nothing to orphan.

Do it after a library exists and every painted picture quietly becomes "the
cartoon of that person", while every `--cartoon` file already on disk is
orphaned and paid for twice. **If the default ever moves again it is a rename
job, not a one-word edit.**

### The picture round runs on GOOGLE

`src/generate-images.js`. Imagen 4 on `GOOGLE_API_KEY`, via the plain Gemini
API. The host's OpenAI account was deactivated with no route back, and
Anthropic has no image API — so this is the only working supplier, not a
preference. The OpenAI code stays because it works and costs nothing to keep.

**The AI Studio door rather than Vertex AI, and that is the no-dependencies
rule deciding it.** Vertex authenticates with a service-account JWT that has to
be signed and refreshed hourly; this is one header on one POST. Same models,
same prices, same Google Cloud project, a tenth of the code.

**Nobody picks a supplier on a button.** `artProvider()` returns whichever key
is set, cheapest first, and the console has one "Make real portraits" press.
The console used to send the literal string `"openai"` in the request body — a
request body choosing who gets billed, which is the same shape of hole
`POST /api/quiz` had, and it would have gone on calling a dead account after
the switch. The server works it out now and the old value still maps through,
so a stale page in somebody's tab keeps working.

**Imagen's three tiers ARE the quality setting.** Fast, Standard and Ultra
against low, medium and high — so there was no second control to build and no
new word for the host to learn. About 2p, 4p and 5p a picture, so a ten-picture
round is 16p to 50p.

Two request fields are load-bearing and neither is obvious:

- **`personGeneration: 'allow_adult'`.** Left unset it defaults to blocking
  people — and the round is "whose face is this", so every picture would come
  back refused and it would read as a bad key.
- **`includeRaiReason: true`.** Without it a refusal arrives as an empty
  prediction list, indistinguishable from a network problem. With it the reason
  is said in words and the message adds "try a different style", because a
  refusal is nearly always the STYLE and that is only obvious if somebody says
  so. Same rule as the Spotify 403.

**None of it could be checked from the container it was written in** — the
egress policy blocks Google — so the request shape is pinned against a stubbed
`fetch` instead: the model per quality, the header, both parameters above, and
that a refusal is reported per question while the rest of the round carries on.

### The prices were three times too high, and it was Claude's row

`PRICES.claude['claude-opus-5']` said `{ in: 1.2, out: 6.0 }` per 1,000 tokens,
which is a $15/$75 model. Opus 5 is $5/$25, so at the 80p-to-the-dollar rate
every other row in that table already used, it is `{ in: 0.4, out: 2.0 }`.

**Every Claude figure the Money tab ever showed was inflated by three**,
including the "about £2 a topical pack" the tier arithmetic was sanity-checked
against — the real number is nearer 70p. Rows already written keep their stored
pence, which is the point of storing them, so the history stays true to what
was reported at the time.

The image prices are **per supplier** now, because Imagen and gpt-image-1 are
nothing like each other at the top of the range (5p against 14p) and one table
would have reported whichever supplier you were not using. Note it is not
"Google is cheaper everywhere" — gpt-image-1's bottom tier is genuinely under
Imagen Fast — and there is a test that says so, because the first version of it
asserted the tidier thing and was wrong.

**The console had its own copy of the price table**, which is exactly the drift
the ledger's own comment says it prevents. The prices come down with the
payload now.

### Quality is a console setting, and it never was one

`gpt-image-1` was called with **no `quality` parameter at all**, so every
picture ever made used OpenAI's own default — the expensive end. It is now
`low`/`medium`/`high` on the Pictures panel, **medium by default**, and the
panel prices the press before you make it. Low is defensible: the picture is
zoomed, pixelated, blurred or behind tiles for most of its twenty seconds and
is then looked at from the back of a pub.

---
