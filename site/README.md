# The sales site

Three static pages. No build step, no dependencies, no server — the same rules
the app follows, for the same reason: this has to keep working with nobody
maintaining it.

    index.html        the two doors
    venues.html       book a night (Essex, Kent, Surrey)
    quizmasters.html  the software, for quizmasters AND pubs running their own
    assets/           one stylesheet, one script, the logo

## Where it goes

**Its own host, not the app.** `quizporium.co.uk` serves this; the app is
`app.quizporium.co.uk`. Deploy to Cloudflare Pages or Netlify: point it at this
repository, set the build command to nothing and the output directory to
`site`.

That split is not tidiness. **The app is on Render's free tier and sleeps**, so
a visitor arriving cold can wait half a minute — which on a sales page is the
sale gone. A static host never sleeps and costs nothing. The SEO argument
points the same way round: the searches all land on the marketing side, so the
content gets the apex and the app gets the subdomain, where nobody is
searching anyway.

## Before it goes live

- **`hello@quizporium.co.uk` has to exist.** Namecheap does free email
  forwarding — point it at your own inbox. Every call to action on the site
  uses it, and a personal address on a public page collects spam for ever.
- The app's own domain is hardcoded as `app.quizporium.co.uk` in the "Sign in"
  links. Add it in Render **before** pointing the apex here, so there is never
  a window where the live app is unreachable.

## The logo

`assets/brandmark.js` is a COPY of `public/assets/brandmark.js`, and
`test/brandmark.site.test.js` fails if the two ever differ. The app already
says a logo may not exist twice; this site is deployed elsewhere on purpose, so
it cannot import the app's copy over the network and the test is what stops the
copy drifting.

## What it deliberately does not say

There is no payment processor yet, so nothing here sells anything. The
quizmasters page says plainly that sign-ups are not open and asks people to get
in touch. **Do not add a Buy button before there is something behind it.**
