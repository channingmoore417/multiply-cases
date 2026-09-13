/**
 * POST /api/book
 *   { firstName, lastName, email, phone, startTime, timezone }
 *
 * Writes, in order: upsert contact → create appointment → add tag.
 * Upserting by email means the appointment attaches to the record the step-4
 * webhook already created, rather than making a duplicate.
 */
const {
  ghlFetch, GhlError, isValidTimezone,
  LOCATION_ID, CALENDAR_ID, MEETING_LOCATION_ID,
  BOOKING_TAG, CALENDAR_LABEL, DEFAULT_TIMEZONE, VERSION,
} = require("./_ghl");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* GHL reports a gone slot as a 400 whose body mentions the slot, not a 409. */
function isSlotTaken(err) {
  if (!(err instanceof GhlError)) return false;
  if (err.status === 409) return true;
  const detail = JSON.stringify(err.detail || "");
  return err.status === 400 && /slot|not available|unavailable|conflict/i.test(detail);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Bad request" });

  const firstName = String(body.firstName || "").trim();
  const lastName  = String(body.lastName  || "").trim();
  const email     = String(body.email     || "").trim();
  const phone     = String(body.phone     || "").trim();
  const slot      = String(body.startTime || "").trim();
  const timezone  = isValidTimezone(body.timezone) ? String(body.timezone).trim() : DEFAULT_TIMEZONE;

  if (!firstName || !email || !slot) return res.status(400).json({ error: "Missing required fields" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Invalid email" });

  const when = new Date(slot);
  if (isNaN(when.getTime())) return res.status(400).json({ error: "Invalid start time" });
  if (when.getTime() < Date.now()) return res.status(400).json({ error: "That time has passed" });

  let contactId = null;

  try {
    /* 1. Upsert the contact.
          No `tags` here on purpose: upsert OVERWRITES a contact's tag list.
          The tag is added additively in step 3. */
    const upsert = await ghlFetch("/contacts/upsert", {
      method: "POST",
      version: VERSION.contacts,
      body: {
        locationId: LOCATION_ID,
        firstName,
        lastName: lastName || undefined,
        email,
        phone: phone || undefined,
        timezone,
        source: "Booking Page — " + CALENDAR_LABEL,
      },
    });

    contactId = (upsert && upsert.contact && upsert.contact.id) || (upsert && upsert.id) || null;
    if (!contactId) throw new GhlError("GHL upsert returned no contact id", 502, upsert);

    /* 2. Create the appointment.
          No endTime: the calendar's 30 minute slot duration decides it.
          No title: the calendar's "{{contact.name}}" template decides that. */
    const appointment = await ghlFetch("/calendars/events/appointments", {
      method: "POST",
      version: VERSION.calendars,
      body: {
        locationId: LOCATION_ID,
        calendarId: CALENDAR_ID,
        contactId,
        startTime: slot,
        meetingLocationId: MEETING_LOCATION_ID,
        appointmentStatus: "confirmed",
      },
    });

    const appointmentId = (appointment && (appointment.id || appointment.appointmentId)) || null;

    /* 3. Tag. Best effort — the appointment is already real, and a tagging
          blip must not tell the visitor their call didn't book. */
    try {
      await ghlFetch("/contacts/" + contactId + "/tags", {
        method: "POST", version: VERSION.contacts, body: { tags: [BOOKING_TAG] },
      });
    } catch (tagErr) {
      console.error("[book] appointment " + appointmentId + " booked but tagging failed:", tagErr.message);
    }

    console.log("[book] " + email + " → " + slot + " (" + timezone + ") appointment=" + appointmentId + " contact=" + contactId);
    return res.status(200).json({ ok: true, appointmentId, startTime: slot, timezone });
  } catch (err) {
    if (isSlotTaken(err)) {
      console.warn("[book] slot " + slot + " gone:", err.message);
      return res.status(409).json({ error: "That time was just taken. Pick another." });
    }
    console.error("[book] failed:", err.message, contactId ? "(contact " + contactId + " was saved)" : "");
    return res.status(502).json({ error: "Could not finish booking that call." });
  }
};
