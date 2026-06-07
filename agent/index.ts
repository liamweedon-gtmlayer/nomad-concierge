// The agent loop (skeleton). Built on the Claude Agent SDK.
// This is the shape, not yet the wired implementation. Phase 1 fills in the tools.
//
// The loop per trip:
//   1. refresh offers          (read_offers per channel)
//   2. for each channel in order:
//        search_listings -> get_listing_details -> score_taste (drop if gates fail)
//        -> compute_economics
//   3. rank by status-aware adjusted cost
//   4. dedup against history, mark what is new
//   5. write_results  (the dashboard reads this)

import { computeEconomics, rankByAdjustedCost } from "../engine/economics";
// import { query } from "@anthropic-ai/claude-agent-sdk";  // phase 1

type Channel = "marriott_hnv" | "booking_latam" | "wynwood_direct" | "airbnb";

// Each tool is a discrete capability the agent can call. Building them as separate,
// typed tools (rather than one monolithic script) is the core of agent design.
interface Tools {
  read_offers(channel: Channel): Promise<unknown[]>;
  search_listings(args: {
    channel: Channel; city: string; checkin: string; checkout: string; guests: number;
  }): Promise<unknown[]>;
  get_listing_details(url: string): Promise<unknown>;
  score_taste(args: { photos: string[]; description: string; amenities: string[] }): Promise<{
    score: number; notes: string; passesGates: boolean;
  }>;
  write_results(tripId: string, recommendations: unknown[]): Promise<void>;
}

export async function runConcierge(/* tools: Tools, config, status, trips */): Promise<void> {
  // 1. load profile.yml, state/status.json, state/trips.json, state/offers.json
  // 2. for each trip with status "searching":
  //      walk channel_order; gather candidates; score taste; compute economics
  //      rank with rankByAdjustedCost; dedup vs state/history; write data/results.json
  //
  // The Agent SDK gives the model the tools above and lets it decide when to drop to
  // the next channel ("nothing here clears the taste bar, try Booking next"), which is
  // exactly the judgement we want it making, while economics stays deterministic.
  void computeEconomics;
  void rankByAdjustedCost;
}
