/**
 * GET /api/slots?timezone=America/Chicago
 *   → { "YYYY-MM-DD": { slots: [ISO…] } }
 *
 * Thin pass-through over GHL's free-slots endpoint, in the shape the page's
 * normalise() already expects. GHL applies the calendar's own rules — minimum
 * notice, booking window, buffer, per-day cap — so this does not re-filter.
 * Whatever GHL returns is what is bookable.
 */
const {
  ghlFetch, GhlError, isValidTimezone,
  CALENDAR_ID, DEFAULT_TIMEZONE, BOOKING_DAYS, VERSION,
} = require("./_ghl");

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requested = (req.query && req.query.timezone) || "";
  const timezone = isValidTimezone(requested) ? requested : DEFAULT_TIMEZONE;

  /* The window is ours, not the caller's: never offer a past slot, and never
     let a crafted query ask GHL for an unbounded range. */
  const startDate = Date.now();
  const endDate = startDate + BOOKING_DAYS * 86400000;

  try {
    const raw = await ghlFetch("/calendars/" + CALENDAR_ID + "/free-slots", {
      version: VERSION.calendars,
      query: { startDate, endDate, timezone },
    });

    /* Keep only date keys — GHL also returns bookkeeping like traceId. */
    const out = {};
    for (const k of Object.keys(raw || {})) {
      if (!DATE_KEY.test(k)) continue;
      const slots = Array.isArray(raw[k] && raw[k].slots) ? raw[k].slots : [];
      if (slots.length) out[k] = { slots };   // an empty day is noise for the picker
    }

    /* Availability is live. A cached grid books two people into one slot. */
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  } catch (err) {
    const status = err instanceof GhlError ? err.status : 502;
    console.error("[slots] failed:", err.message, err.detail ? JSON.stringify(err.detail) : "");
    res.setHeader("Cache-Control", "no-store");
    /* A bad or missing token is our problem, not an auth challenge to the
       visitor's browser — never surface it as 401/403. */
    return res.status(status === 401 || status === 403 || status === 503 ? 500 : status)
      .json({ error: "Could not load availability" });
  }
};
