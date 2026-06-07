# Nomad Concierge

A personal travel concierge agent. Tell it where and when you will be; it sweeps your
booking channels in order (Marriott Homes & Villas, Booking.com via LATAM, Wynwood
House, Airbnb), scores places against your taste, does the points and status maths, and
hands back a ranked shortlist with photos and the reasoning. It runs itself on a
schedule and only ever recommends. You make the final booking.

See [DESIGN.md](DESIGN.md) for the full agent design.

## See it now (no build needed)

Open `docs/index.html` in your browser. It renders the sample shortlist for a Mexico
City trip so you can see the speedometer gauges, offers, and recommendation cards.

## Layout

- `agent/` — the agent loop (Claude Agent SDK) and its tools.
- `engine/` — pure, testable maths for points and status (`economics.ts`).
- `config/profile.yml` — your taste rules, point valuations, channel order, budget.
- `state/` — `status.json`, `trips.json`, `offers.json`, and history snapshots.
- `docs/` — the dashboard (deploys to GitHub Pages from `/docs`).
- `docs/data/results.json` — what the dashboard reads.
- `ops/sweep.yml` — the twice-weekly sweep workflow (template). To enable it, run
  `gh auth refresh -h github.com -s workflow`, then move it to `.github/workflows/`.

## Status

Phase 0: scaffold + engine + dashboard on sample data. Next: wire the Marriott Homes &
Villas channel end to end.
