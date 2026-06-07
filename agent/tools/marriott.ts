// Homes & Villas by Marriott Bonvoy channel adapter.
//
// VALIDATED LIVE 2026-06-07 (CDMX, 30 Jun-30 Jul vs 30 Jun-14 Jul).
// Learnings:
//  - Drive a real browser. Prices render in USD (no FX needed, unlike Booking).
//  - Search URL uses fromDate / toDate (NOT checkInDate). dateSelectionType=exact.
//    Direct-URL loads are SLOW and flaky (skeleton for 10-20s, sometimes 0 results on
//    first paint). Setting dates via the calendar UI then Search is more reliable.
//  - Property pages: /en/properties/<id>-<slug>. Images: homes-and-villas.marriott.com/
//    hvmb-pictures/<id>/... (capture in-browser; do not assume hotlinkable on the site).
//  - The monthly rate is genuinely cheaper per night (e.g. one unit was $143/night for
//    a fortnight but $107/night over a month). Always price both.
//  - Earning (confirmed by the 3X banner + your 1.75x Titanium): base ~5 pts/USD, then
//    elite +75% and the 3X CALA promo both apply on base (book by 26 Jun, 5+ nights,
//    must be logged in). 40k bonus needs $2,000+ spend. A short fortnight under $2k
//    MISSES the 40k. Every Marriott night = 1 Elite Night Credit toward Titanium.

export function buildSearchUrl(opts: {
  locationName: string; lat: number; lng: number; fromDate: string; toDate: string; adults?: number;
}) {
  const p = new URLSearchParams({
    locationName: opts.locationName,
    lat: String(opts.lat),
    lng: String(opts.lng),
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    adults: String(opts.adults ?? 1),
  });
  const city = opts.locationName.toLowerCase().split(",")[0].trim().replace(/\s+/g, "-");
  return `https://homes-and-villas.marriott.com/en/search/${city}-home-and-villa-rental?${p.toString()}`;
}

// Runs in the page context. Wait for cards to hydrate first (poll until length > 0).
export const EXTRACT_CARDS_JS = `
(() => {
  const clean = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return null; } };
  const seen = new Set(); const out = [];
  for (const a of document.querySelectorAll('a[href*="/en/properties/"]')) {
    const href = clean(a.href); if (!href || seen.has(href)) continue; seen.add(href);
    let card = a; for (let i = 0; i < 5 && card.parentElement; i++) { card = card.parentElement; if (card.querySelectorAll('img').length) break; }
    const t = (card.innerText || '').replace(/\\s+/g, ' ').trim();
    const img = card.querySelector('img');
    out.push({
      slug: href.split('/properties/')[1],
      title: t.split(/ Mexico City, Mexico| Ciudad de M| \\d+ Bedroom/)[0].trim(),
      beds: Number((t.match(/(\\d+)\\s*Bedroom/) || [])[1]) || null,
      nightUsd: Number(((t.match(/\\$([\\d,]+)\\s*night/) || [])[1] || '').replace(/,/g, '')) || null,
      totalUsd: Number(((t.match(/\\$([\\d,]+)\\s*total/) || [])[1] || '').replace(/,/g, '')) || null,
      img: img ? clean(img.src) : null,
    });
  }
  return out;
})()
`;
