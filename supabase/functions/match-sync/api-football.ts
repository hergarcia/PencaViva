/**
 * API-Football HTTP client.
 * Thin wrapper around fetch — handles auth headers and response parsing.
 */

import type { ApiFixture } from "./mapper.ts";

const BASE_URL = "https://api-football-v3.p.rapidapi.com";

interface ApiFootballResponse {
  results: number;
  response: ApiFixture[];
}

export interface ApiClientConfig {
  apiKey: string;
}

export interface FetchResult {
  fixtures: ApiFixture[];
  quotaRemaining: number | null;
}

/**
 * Thrown when API-Football returns 429 (rate limit exceeded).
 * Callers should stop making further requests when this is caught.
 */
export class RateLimitError extends Error {
  constructor(quotaRemaining: number | null) {
    super(
      `API-Football rate limit exceeded (remaining: ${quotaRemaining ?? "unknown"})`,
    );
    this.name = "RateLimitError";
  }
}

async function callApi(
  endpoint: string,
  params: Record<string, string>,
  config: ApiClientConfig,
): Promise<FetchResult> {
  const url = new URL(endpoint, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-key": config.apiKey,
      "x-rapidapi-host": "api-football-v3.p.rapidapi.com",
    },
  });

  const quotaHeader = response.headers.get("x-ratelimit-requests-remaining");
  const quotaRemaining = quotaHeader ? parseInt(quotaHeader, 10) : null;

  if (response.status === 429) {
    throw new RateLimitError(quotaRemaining);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `API-Football error ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const data: ApiFootballResponse = await response.json();
  return { fixtures: data.response ?? [], quotaRemaining };
}

/**
 * Fetch all fixtures for a league/season (daily sync).
 */
export async function fetchFixturesByLeague(
  leagueId: number,
  season: string,
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { league: String(leagueId), season }, config);
}

/**
 * Fetch all currently live fixtures globally (live polling).
 */
export async function fetchLiveFixtures(
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { live: "all" }, config);
}

/**
 * Fetch a single fixture by its API-Football ID (single mode).
 */
export async function fetchFixtureById(
  fixtureId: number,
  config: ApiClientConfig,
): Promise<FetchResult> {
  return callApi("/fixtures", { id: String(fixtureId) }, config);
}
