# Nomad Concierge — agent design

A personal travel concierge agent. You tell it where and when you will be; it sweeps
your booking channels in your preferred order, scores places against your real taste,
does the points and status maths, and hands back a ranked shortlist with photos, the
reasoning, and deep links to book. It runs itself on a schedule and only ever
recommends. You click the final booking step so your loyalty tracking stays intact.

## Why this is an agent, not a scraper

A scraper fetches pages. An agent has a goal, perceives the world, reasons, acts
through tools, and remembers, on a loop.

1. **Memory / state** — what it knows about you (below).
2. **Perceive** — discrete tools it calls to read offers, search channels, fetch a
   listing and its photos, read your loyalty balances.
3. **Reason** — a deterministic engine for the maths it must get exactly right, plus
   an LLM pass for the judgement a filter cannot do (reading photos for "modern, good
   light, a real desk not a shelf in a dark corner").
4. **Act + explain** — a ranked shortlist with a one-line "why" per option.
5. **Loop** — runs twice a week, re-ranks as offers appear and expire, flags deadlines,
   and remembers what it already showed you so it surfaces what is new.

## Memory / state (the backbone)

Four files. `profile` is set once. The agent maintains `offers` and `results` each run;
you confirm the numbers in `status`.

- `config/profile.yml` — taste rules, point valuations, channel order, budget.
- `state/status.json` — Titanium ENC ledger + LATAM tier/qualifying-points ledger.
- `state/trips.json` — where and when you will be.
- `state/offers.json` — live promotions, refreshed each run.
- `data/results.json` — the ranked recommendations the dashboard renders.
- `state/history/` — past snapshots, so the agent can mark options as new.

## Tools (the heart of it)

Each is a discrete, typed tool the agent invokes. Building these as separate tools,
rather than one big script, is the whole point of the exercise.

- `read_offers(channel)` -> Offer[]                — reads live promo pages.
- `search_listings({channel, city, checkin, checkout, guests})` -> ListingStub[]
- `get_listing_details(url)` -> { photos, description, amenities, floor, area, nightly }
- `score_taste({photos, description, amenities}, profile)` -> { score, notes, passesGates }
- `compute_economics({listing, offers, status, profile})` -> Economics   (deterministic)
- `read_status_pages()` -> partial status      (best effort; falls back to manual entry)
- `write_results(tripId, recommendations)`     — persists JSON + a history snapshot.

## Reasoning

**Deterministic engine** (`engine/economics.ts`) — never let the model do arithmetic
that has to be right. It computes, per listing:
- cash total and weekly,
- points earned (Bonvoy base x offer multiplier, plus flat bonus if eligible; LATAM
  miles and qualifying points where the channel earns them),
- Elite Night Credits earned (Marriott-credited channels only),
- points value in USD, effective weekly cost (cash minus points value),
- a status-aware adjusted weekly cost (below).

**LLM judgement** (`score_taste`) — given the listing photos and text, return whether
it passes the hard gates (modern, real work surface, natural light, kitchen) and a
0-10 soft score weighted by your profile (windows, view, high floor, balcony, area).
Few-shot it with your reference listings so "good" means *your* good.

## The status logic (the core intelligence)

You have two status goals that pull in opposite directions:

- **Titanium retention** (hard requirement, 75 ENC/year) earns only on Marriott-credited
  stays: hotels and Homes & Villas. Booking.com, Wynwood-direct and Airbnb earn zero ENC.
- **LATAM tier climb** (wanted, not mandatory) earns on Booking.com qualifying points.

So every Booking.com night helps LATAM but does nothing for the Titanium you must keep.
The engine holds `enc_needed = max(0, target - enc_ytd)` and, while it is above zero,
treats each ENC as worth real money (it protects a status you would otherwise pay to
keep). That folds into the ranking as:

    adjusted_weekly = effective_weekly
                      - (enc_earned x enc_value_while_needed)
                      - (latam_qp x qp_value_while_chasing)

ENC value is dynamic: high while you still need nights, zero once you hit 75. After
that the agent flips to pure value optimisation and leans into Booking.com for the
LATAM climb you want. Every card shows this out loud: "clears 21 of your 40 remaining
Titanium nights."

## Channel order

Marriott Homes & Villas -> Booking.com (via your LATAM link) -> Wynwood House direct
-> Airbnb (last resort, 2-week / monthly). The agent searches in this order and only
drops to the next channel when the one above has nothing that clears your taste bar.

## Output / dashboard

GitHub Pages static site. Pinned at the top: a Titanium tracker (ENC so far / 75, and
what the recommended trip adds) and a LATAM tracker (current tier, qualifying points,
distance to next tier). Then live offers. Then recommendation cards: real listing
photo, effective vs cash price, taste score, offer badges, the "why" line, and a deep
link to book.

## Architecture / hosting

The agent (Claude Agent SDK worker) runs in GitHub Actions on a twice-weekly cron. It
writes `data/results.json` and commits it. GitHub Pages renders the dashboard from that
file. Free, no server, lives in one public repo.

    nomad-concierge/
      agent/            the agent loop (Agent SDK) + tools/
      engine/           pure, testable maths (points / status)
      config/profile.yml
      state/            status.json, trips.json, offers.json, history/
      docs/             the dashboard -> GitHub Pages (served from /docs)
      docs/data/results.json   what the dashboard reads
      .github/workflows sweep.yml (cron)

## Honest constraints

- Scraping is the fragile part. Marriott offers are visible pre-login (good). Booking,
  Wynwood and Airbnb are JS-heavy and bot-defended; a headless browser handles them but
  will break periodically and cannot see account-specific offers behind your login.
  Treat the sweep as strong candidate discovery, not a guaranteed full-market scan.
- Booking stays manual on purpose. LATAM miles credit only through your specific link;
  the Marriott 3x credits only when you are logged in. The agent finds and ranks; you
  do the final click so the tracking holds and you are the one moving money.

## Build phases

0. Scaffold: repo + engine + dashboard on sample data. (clickable today)
1. Marriott H&V adapter end to end (offers pre-login + listing + photos). first real data.
2. Booking.com/LATAM adapter, then Wynwood, then Airbnb.
3. Taste LLM scoring wired to your reference listings; status-aware ranking tuned.
4. Schedule (Actions cron) + Pages deploy + new/history tracking.

## Inputs needed to go from sample to real

- 4-5 links to places you have loved (and any you disliked, for contrast).
- Current numbers: Titanium ENC year-to-date; LATAM tier, qualifying points, miles
  balance, and qualifying points to the next tier.
- Your LATAM Booking.com link.
- Your personal GitHub username (for the repo and remote). Not gtmlayer.
- Confirm the point valuations in profile.yml or accept the defaults.
