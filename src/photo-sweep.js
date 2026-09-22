/**
 * HOW OFTEN TO RETRY A PHOTOGRAPH THAT DID NOT REACH THE STORE — pure, and a
 * leaf, so a test can hold it without building the app's singletons.
 *
 * Five minutes while things are landing; doubling on every sweep that files
 * nothing, to an hour. That backoff is what makes a retry loop safe at all: the
 * reason there was no loop for a year was *"a loop on a bad token would hammer
 * GitHub all night for nothing"*, which is true of a fixed interval and not of
 * this one. The first success puts it straight back to five minutes, so a
 * GitHub blip clears itself before the night is over.
 *
 * `PHOTO_SWEEP_MS` is read from the environment only so a check can run a
 * sweep in a second rather than five minutes; nothing live should set it.
 */
export const PHOTO_SWEEP_MS = Number(process.env.PHOTO_SWEEP_MS) || 5 * 60_000;
export const PHOTO_SWEEP_MAX_MS = Math.max(PHOTO_SWEEP_MS, 60 * 60_000);

/** How long until the next sweep, given how the last one went. */
export function nextPhotoSweep(previousMs, { attempted = 0, filed = 0 } = {}) {
  if (!attempted || filed) return PHOTO_SWEEP_MS;
  return Math.min(PHOTO_SWEEP_MAX_MS, Math.max(PHOTO_SWEEP_MS, Number(previousMs) || 0) * 2);
}
