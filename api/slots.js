const { ghl, fail, CALENDAR_ID, TIMEZONE, VERSION } = require("./_ghl");

/* GET /api/slots?startDate=<epochms>&endDate=<epochms>&timezone=&calendarId=
   Returns GHL's free-slots shape unchanged: { "YYYY-MM-DD": { slots: [iso] } } */
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const q = req.query || {};
  const now = Date.now();

  /* Clamp the window. Never offer a slot in the past, and cap the range so a
     crafted query cannot ask GHL for a decade of availability. */
  const startDate = Math.max(Number(q.startDate) || now, now);
  const maxEnd = startDate + 60 * 86400000;
  const endDate = Math.min(Number(q.endDate) || startDate + 17 * 86400000, maxEnd);

  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || endDate <= startDate) {
    return res.status(400).json({ error: "bad_range" });
  }

  /* The calendar is ours, not the caller's choice. */
  const calendarId = CALENDAR_ID;
  const timezone = typeof q.timezone === "string" && q.timezone ? q.timezone : TIMEZONE;

  const params = new URLSearchParams({
    startDate: String(startDate),
    endDate: String(endDate),
    timezone,
  });

  try {
    const data = await ghl(
      "/calendars/" + calendarId + "/free-slots?" + params.toString(),
      { version: VERSION.calendars }
    );

    /* Strip GHL's traceId so the response is purely date keys. */
    const out = {};
    for (const k of Object.keys(data || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) out[k] = data[k];
    }

    /* Short cache: availability changes, but not second to second. */
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return res.status(200).json(out);
  } catch (e) {
    return fail(res, e, "Could not load available times.");
  }
};
