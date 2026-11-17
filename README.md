# multiply-cases

Landing pages for Multiply — law firm marketing.

The pages are self-contained static HTML: all CSS, JavaScript, and images
(inline base64) are embedded, with Google Fonts loaded from a CDN. They can be
served by any static host or opened directly in a browser. The one sibling
asset is `favicon.png`, referenced from the site root, so the tab icon only
resolves when served rather than opened over `file://`.

## Pages

### `index.html` — $197/mo law firm website landing page

- Hero with a 7-step qualifying quiz (practice area, Google Business Profile,
  current website, zip, firm name, name/phone, email)
- Zip lookup via zippopotam.us, with a manual city/state fallback
- Lead posts to the GHL inbound webhook on the final step
- Proof section showing three recent builds
- "What you get", small-markets explainer, founder section and footer

### `booking.html` — standalone "Book A Call" page

Booking flow against the GHL calendar via `/api/slots` and `/api/book`.

### `call.html` — workshop call booking page

The page pushed at the end of the local business workshop.

1. A ten-question application (Google Business Profile, lead sources,
   biggest challenge, revenue, budget, timeline, owner on call, will show up,
   services and area, contact details). Answers post to the GHL inbound
   webhook behind the Strategy Call Request form on multiplylocal.com/book.
2. A calendar for "Multiply Your Business Call", drawn from `/api/slots`
   and booked through `/api/book`. Those need `GHL_PRIVATE_TOKEN` set in
   the host's environment. Without it the page falls back to GHL's own
   embedded widget for the same calendar, so a real slot can always be booked.

Contact fields prefill from `?first_name=&last_name=&email=&phone=` or
from the `ml-lead` record the workshop registration form saves in
sessionStorage.

## Tracking

Both pages carry the Meta Pixel (`1276653241236782`) and Vercel Web Analytics.
`index.html` fires `PageView`, `InitiateCheckout` when the quiz starts, and
`Lead` plus a custom `QuizComplete` on submit.
