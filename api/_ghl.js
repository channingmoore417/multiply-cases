/**
 * Shared GHL helper for the public booking endpoints (/api/slots, /api/book).
 *
 * Dependency-free (global fetch, Node 20). The Private Integration token is
 * read here and never leaves the server — that is the whole reason these two
 * functions exist instead of the page talking to GHL directly.
 *
 * Pattern follows bayou-mortgage/api/_ghl.js, which has been running in
 * production against the same CRM.
 */

const API_BASE = (process.env.GHL_API_BASE || "https://services.leadconnectorhq.com").replace(/\/$/, "");

/* .trim() throughout: a value pasted into the Vercel dashboard with a trailing
   space or newline otherwise fails as an opaque 401, which is a miserable hunt. */
const TOKEN       = (process.env.GHL_PRIVATE_TOKEN || process.env.GHL_API_KEY || "").trim();
const LOCATION_ID = (process.env.GHL_LOCATION_ID || "rqfDKEvso1ofKq2wgy5d").trim();
const CALENDAR_ID = (process.env.GHL_CALENDAR_ID || "vi7CsC1AbMZIkfKJ0I1u").trim();

/* Must match an entry in the calendar's locationConfigurations.
   This calendar is configured kind:"custom" → meetingId "custom_0". */
const MEETING_LOCATION_ID = (process.env.GHL_MEETING_LOCATION_ID || "custom_0").trim();

const BOOKING_TAG   = (process.env.GHL_BOOKING_TAG || "booked-strategy-call").trim();
const CALENDAR_LABEL = "Multiply Your Business Call";
const DEFAULT_TIMEZONE = (process.env.DEFAULT_TIMEZONE || "America/Chicago").trim();
const BOOKING_DAYS = clampInt(process.env.GHL_BOOKING_DAYS, 17, 1, 60);

/* GHL versions its APIs per domain; the wrong one returns an opaque 401. */
const VERSION = { calendars: "2021-04-15", contacts: "2021-07-28" };

function clampInt(raw, fallback, min, max) {
  const n = parseInt(String(raw || "").trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

class GhlError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch (e) {
    return false;
  }
}

async function ghlFetch(path, { method = "GET", version = VERSION.calendars, query, body } = {}) {
  if (!TOKEN) throw new GhlError("GHL token is not configured", 503, null);

  let url = API_BASE + path;
  if (query) url += "?" + new URLSearchParams(query).toString();

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + TOKEN,
      Version: version,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }

  if (!res.ok) throw new GhlError("GHL " + res.status + " on " + path, res.status, data);
  return data;
}

module.exports = {
  ghlFetch, GhlError, isValidTimezone, clampInt,
  LOCATION_ID, CALENDAR_ID, MEETING_LOCATION_ID,
  BOOKING_TAG, CALENDAR_LABEL, DEFAULT_TIMEZONE, BOOKING_DAYS, VERSION,
};
