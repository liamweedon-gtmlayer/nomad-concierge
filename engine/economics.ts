// Deterministic economics engine.
// Rule of thumb for agents: never let the model do arithmetic that has to be right.
// The LLM judges taste; this module does the maths.

export type Channel = "marriott_hnv" | "booking_latam" | "wynwood_direct" | "airbnb";

export interface PointValues {
  bonvoy: number; // USD per point
  latam_miles: number;
  avios: number;
}

export interface StatusState {
  marriott: { enc_ytd: number; enc_target: number; must_retain: boolean };
  latam: { qualifying_points_ytd: number; qp_to_next_tier: number | null; chasing: boolean };
}

export interface OfferContext {
  bonvoy_multiplier: number; // promo multiple of BASE points: 1 = none, 3 = "3x points"
  bonus_points: number; // flat bonus (e.g. 40000) if thresholds met
  min_nights: number;
  min_spend_usd: number;
}

export interface ListingInput {
  channel: Channel;
  nightly_usd: number;
  nights: number;
  // Bonvoy
  earns_bonvoy: boolean;
  bonvoy_base_per_usd: number; // base points per USD before any bonus (H&V ~5)
  titanium_multiplier: number; // your elite earn, e.g. 1.75 (= +75% on base)
  // LATAM
  earns_latam: boolean;
  latam_miles_per_usd: number;
  latam_qp_per_usd: number;
  // Marriott Elite Night Credits (hotels + Homes & Villas only)
  earns_enc: boolean;
}

export interface EngineConfig {
  point_values_usd: PointValues;
  enc_value_usd_while_needed: number;
  qp_value_usd_while_chasing: number;
}

export interface Economics {
  cash_total_usd: number;
  cash_weekly_usd: number;
  bonvoy_earned: number;
  latam_miles_earned: number;
  latam_qp_earned: number;
  enc_earned: number;
  points_value_usd: number;
  effective_weekly_usd: number; // cash minus redeemable points value
  adjusted_weekly_usd: number; // status-aware: also credits ENC and QP you need now
  notes: string[];
}

const weeks = (nights: number) => nights / 7;

// Each ENC is worth real money while you still need nights to retain Titanium,
// because it protects status you would otherwise pay to keep. Zero once you hit target.
export function encMarginalValue(status: StatusState, cfg: EngineConfig): number {
  const needed = Math.max(0, status.marriott.enc_target - status.marriott.enc_ytd);
  if (!status.marriott.must_retain || needed === 0) return 0;
  return cfg.enc_value_usd_while_needed;
}

export function qpMarginalValue(status: StatusState, cfg: EngineConfig): number {
  if (!status.latam.chasing) return 0;
  return cfg.qp_value_usd_while_chasing;
}

export function computeEconomics(
  l: ListingInput,
  offer: OfferContext,
  status: StatusState,
  cfg: EngineConfig
): Economics {
  const notes: string[] = [];
  const cash_total_usd = l.nightly_usd * l.nights;
  const cash_weekly_usd = cash_total_usd / weeks(l.nights);

  // Bonvoy points: elite bonus and the promo are both computed on BASE points and
  // added together (standard Marriott stacking).
  //   total = base * (1 + elite_bonus_rate + offer_bonus_rate) + flat_bonus
  // With Titanium 1.75x -> elite_bonus_rate = 0.75; a "3x" offer -> offer_bonus_rate = 2.
  let bonvoy_earned = 0;
  if (l.earns_bonvoy) {
    const base = cash_total_usd * l.bonvoy_base_per_usd;
    const eliteBonusRate = Math.max(0, l.titanium_multiplier - 1);
    const meetsNights = l.nights >= offer.min_nights;
    const offerBonusRate = meetsNights ? Math.max(0, offer.bonvoy_multiplier - 1) : 0;
    bonvoy_earned = base * (1 + eliteBonusRate + offerBonusRate);
    notes.push(`Titanium ${l.titanium_multiplier}x earn`);
    if (offerBonusRate > 0) notes.push(`+${offer.bonvoy_multiplier}x offer on base`);
    if (offer.bonus_points && cash_total_usd >= offer.min_spend_usd && meetsNights) {
      bonvoy_earned += offer.bonus_points;
      notes.push(`+${offer.bonus_points.toLocaleString()} bonus points`);
    }
  }

  const latam_miles_earned = l.earns_latam ? cash_total_usd * l.latam_miles_per_usd : 0;
  const latam_qp_earned = l.earns_latam ? cash_total_usd * l.latam_qp_per_usd : 0;
  const enc_earned = l.earns_enc ? l.nights : 0;
  if (enc_earned > 0) notes.push(`+${enc_earned} Titanium nights`);

  const points_value_usd =
    bonvoy_earned * cfg.point_values_usd.bonvoy +
    latam_miles_earned * cfg.point_values_usd.latam_miles;

  const effective_total = cash_total_usd - points_value_usd;
  const effective_weekly_usd = effective_total / weeks(l.nights);

  // Status-aware adjustment: also credit the ENC and QP you actually need right now.
  const status_credit =
    enc_earned * encMarginalValue(status, cfg) +
    latam_qp_earned * qpMarginalValue(status, cfg);
  const adjusted_weekly_usd = (effective_total - status_credit) / weeks(l.nights);

  return {
    cash_total_usd,
    cash_weekly_usd,
    bonvoy_earned,
    latam_miles_earned,
    latam_qp_earned,
    enc_earned,
    points_value_usd,
    effective_weekly_usd,
    adjusted_weekly_usd,
    notes,
  };
}

// Rank lowest adjusted weekly cost first, among listings that pass the taste gates.
export function rankByAdjustedCost<T extends { economics: Economics; taste_score: number }>(
  options: T[]
): T[] {
  return [...options].sort((a, b) => a.economics.adjusted_weekly_usd - b.economics.adjusted_weekly_usd);
}
