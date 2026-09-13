const { ghl, fail, LOCATION_ID, CALENDAR_ID, TIMEZONE, VERSION } = require("./_ghl");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  /* Vercel parses JSON bodies, but be tolerant of a raw string. */
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== "object") return res.status(400).json({ error: "bad_body" });

  const firstName = String(b.firstName || "").trim();
  const lastName  = String(b.lastName  || "").trim();
  const email     = String(b.email     || "").trim();
  const phone     = String(b.phone     || "").trim();
  const startTime = String(b.startTime || "").trim();
  const timezone  = String(b.timezone  || TIMEZONE).trim();

  if (!firstName || !email || !startTime) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "bad_email" });

  const when = new Date(startTime);
  if (isNaN(when.getTime())) return res.status(400).json({ error: "bad_start_time" });
  if (when.getTime() < Date.now()) return res.status(400).json({ error: "start_time_in_past" });

  try {
    /* 1. Upsert the contact, so the appointment attaches to the record the
          step-4 webhook already created rather than making a duplicate. */
    const upserted = await ghl("/contacts/upsert", {
      method: "POST",
      version: VERSION.contacts,
      body: {
        locationId: LOCATION_ID,
        firstName,
        lastName: lastName || undefined,
        email,
        phone: phone || undefined,
        source: "Multiply VSL Booking",
      },
    });

    const contactId =
      (upserted && upserted.contact && upserted.contact.id) ||
      (upserted && upserted.id);
    if (!contactId) {
      const e = new Error("upsert returned no contact id");
      e.detail = upserted;
      throw e;
    }

    /* 2. Book it. GHL derives endTime from the calendar's slot duration. */
    const appt = await ghl("/calendars/events/appointments", {
      method: "POST",
      version: VERSION.calendars,
      body: {
        calendarId: CALENDAR_ID,
        locationId: LOCATION_ID,
        contactId,
        startTime,
        selectedTimezone: timezone,
        title: firstName + (lastName ? " " + lastName : "") + " — Multiply Strategy Call",
        appointmentStatus: "confirmed",
        ignoreFreeSlotValidation: false,
      },
    });

    return res.status(200).json({
      ok: true,
      appointmentId: appt && (appt.id || (appt.event && appt.event.id)),
      contactId,
      startTime,
      timezone,
    });
  } catch (e) {
    /* A taken slot must surface as 409 so the page tells them to pick another
       rather than showing a confirmation for a booking that did not happen. */
    const detail = JSON.stringify(e.detail || "");
    if (e.status === 400 && /slot|available|conflict/i.test(detail)) {
      return res.status(409).json({ error: "slot_taken", message: "That time was just taken." });
    }
    return fail(res, e, "Could not complete the booking.");
  }
};
