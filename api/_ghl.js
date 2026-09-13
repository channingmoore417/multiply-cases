/* Shared GHL API helpers.
   Auth comes from the GHL_API_KEY env var — a Private Integration token with
   scopes: calendars.readonly, calendars/events.write, contacts.write. */

const BASE = "https://services.leadconnectorhq.com";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "rqfDKEvso1ofKq2wgy5d";
const CALENDAR_ID = process.env.GHL_CALENDAR_ID || "vi7CsC1AbMZIkfKJ0I1u";
const TIMEZONE = process.env.GHL_TIMEZONE || "America/Chicago";

/* GHL versions its APIs per domain; sending the wrong one returns 401. */
const VERSION = { calendars: "2021-04-15", contacts: "2021-07-28" };

function token() {
  const t = process.env.GHL_API_KEY;
  if (!t) throw new Error("GHL_API_KEY is not set");
  return t;
}

async function ghl(path, { method = "GET", version, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + token(),
      Version: version,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error("GHL " + res.status + " on " + path);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

/* Never leak the token or GHL internals to the browser. */
function fail(res, e, fallbackMessage) {
  const missingKey = /GHL_API_KEY is not set/.test(e.message || "");
  console.error("[ghl]", e.message, e.detail ? JSON.stringify(e.detail) : "");
  res.status(missingKey ? 503 : e.status === 409 ? 409 : 502).json({
    error: missingKey ? "not_configured" : "upstream_error",
    message: fallbackMessage,
  });
}

module.exports = { ghl, fail, LOCATION_ID, CALENDAR_ID, TIMEZONE, VERSION };
