// Booking.com (via LATAM link) channel adapter.
//
// VALIDATED LIVE 2026-06-07 against a real logged-in session (CDMX, 30 Jun-14 Jul).
// Key learnings, baked in below:
//  - Plain server fetches 403. You MUST drive a real browser (the agent uses the
//    connected Chrome / a Playwright session), ideally logged in so Genius prices show.
//  - Search via the LATAM affiliate URL so miles + qualifying points attribute. The
//    aid + label are the tracking params that matter.
//  - Opening a listing's deep link COLD hits a Booking sign-in wall. Do not log in.
//    Instead click the card from inside the search session (keeps auth, shows photos).
//  - The on-page LATAM banner currently shows 8 miles + 6 qualifying points per USD
//    (a "33% more miles" promo is live). Base is lower; re-read the banner each run.
//  - Prices render in MXN on this account. Each card's "Consigue N millas" divided by
//    the miles-per-USD rate recovers the USD price and a clean FX (~17.4 MXN/USD).
//  - Booking earns NO Marriott Elite Night Credits. Good for the LATAM climb, useless
//    for Titanium retention. The engine handles that.

export const LATAM_BASE =
  "https://sp.booking.com/searchresults.html" +
  "?aid=2441557&label=br_latamtravel-booking_latampass_reservar-hotel";

export function buildSearchUrl(city: string, checkin: string, checkout: string) {
  const p = new URLSearchParams({
    ss: city,
    checkin,
    checkout,
    group_adults: "1",
    no_rooms: "1",
    group_children: "0",
    nflt: "ht_id=201", // apartments only
  });
  return `${LATAM_BASE}&${p.toString()}`;
}

// Runs in the page context (browser). Extracts the result cards. Clean the image and
// link URLs (strip query strings) so the privacy guard does not block the payload.
export const EXTRACT_CARDS_JS = `
(() => {
  const clean = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return null; } };
  return [...document.querySelectorAll('[data-testid="property-card"]')].slice(0, 25).map(c => {
    const q = (s) => { const e = c.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
    const a = c.querySelector('a[href*="/hotel/"]');
    const img = c.querySelector('img');
    const milesEl = [...c.querySelectorAll('span,div')].find(el => el.children.length === 0 && /mill?as/i.test(el.textContent));
    return {
      title: q('[data-testid="title"]'),
      dist: q('[data-testid="distance"]'),
      priceMXN: Number((q('[data-testid="price-and-discounted-price"]') || '').replace(/[^\\d]/g, '')),
      score: (q('[data-testid="review-score"]') || '').match(/\\d+\\.?\\d?/)?.[0],
      miles: Number((milesEl ? milesEl.textContent : '').replace(/\\D/g, '')),
      slug: clean(a ? a.href : null),
      img: clean(img ? img.src : null),
    };
  });
})()
`;

export interface BookingCard {
  title: string;
  dist: string | null;
  priceMXN: number;
  score: string | null;
  miles: number;
  slug: string | null;
  img: string | null;
}

// Recover USD + FX from the miles the page quotes (8 miles per USD currently).
export function withUsd(card: BookingCard, milesPerUsd = 8) {
  const priceUSD = card.miles ? Math.round(card.miles / milesPerUsd) : null;
  const fx = priceUSD ? card.priceMXN / priceUSD : null;
  return { ...card, priceUSD, fx };
}
