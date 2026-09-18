# multiply-cases

Landing pages for Multiply — law firm marketing.

Both pages are self-contained static HTML: all CSS, JavaScript, and images
(inline base64) are embedded, with Google Fonts loaded from a CDN. They can be
served by any static host or opened directly in a browser.

## Pages

### `index.html` — $197/mo law firm website landing page

- Hero with a 7-step qualifying quiz (practice area, Google Business Profile,
  current website, zip, firm name, name/phone, email)
- Zip lookup via zippopotam.us, with a manual city/state fallback
- Lead posts to the GHL inbound webhook on the final step
- "What you get", small-markets explainer, founder section and footer

### `booking.html` — standalone "Book A Call" page

Booking flow against the GHL calendar via `/api/slots` and `/api/book`.

## Tracking

Both pages carry the Meta Pixel (`1276653241236782`) and Vercel Web Analytics.
`index.html` fires `PageView`, `InitiateCheckout` when the quiz starts, and
`Lead` plus a custom `QuizComplete` on submit.
