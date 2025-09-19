import { API_ENDPOINTS } from "../constants/api";
import { COINGECKO_API_KEY } from "../constants/values";

// Map our chain IDs to CoinGecko platform IDs
const COINGECKO_PLATFORMS: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
};

export function getCoingeckoPlatform(chainId: number): string {
  const platform = COINGECKO_PLATFORMS[chainId];
  if (!platform) {
    throw new Error(
      `Unsupported chain for CoinGecko: ${chainId}. Supported: ${Object.keys(COINGECKO_PLATFORMS).join(', ')}`,
    );
  }
  return platform;
}

/**
 * Fetch USD prices for a set of ERC-20 contract addresses from CoinGecko.
 * Returns a map of lowercase address -> usd price (number).
 */
export async function fetchCoingeckoTokenUsdPrices(
  chainId: number,
  addresses: Array<string>,
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(addresses.map((a) => a.toLowerCase())));
  if (unique.length === 0) return {};

  const platform = getCoingeckoPlatform(chainId);

  const bases = normalizeBaseVariants(API_ENDPOINTS.coingecko);

  let lastErr: unknown;
  for (const baseUrl of bases) {
    const url = new URL(`${baseUrl}/simple/token_price/${platform}`);
    url.searchParams.set('contract_addresses', unique.join(','));
    url.searchParams.set('vs_currencies', 'usd');

    const res = await fetch(url.toString(), { method: 'GET', headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY || '' } });
    if (res.ok) {
      const json = (await res.json()) as Record<string, { usd?: number }>;

      const out: Record<string, number> = {};
      for (const [addr, { usd }] of Object.entries(json)) {
        if (typeof usd === 'number' && Number.isFinite(usd)) {
          out[addr.toLowerCase()] = usd;
        }
      }
      return out;
    }
    lastErr = new Error(`CoinGecko HTTP ${res.status}`);
    // If path is wrong (likely 404), try next variant
    if (res.status !== 404) break;
  }
  throw lastErr instanceof Error ? lastErr : new Error('CoinGecko request failed');
}

function normalizeBaseVariants(base: string): Array<string> {
  const clean = base.replace(/\/$/, '');
  const hasApiV3 = /\/api\/v3$/.test(clean);
  const withApi = hasApiV3 ? clean : `${clean}/api/v3`;
  const withoutApi = hasApiV3 ? clean.replace(/\/api\/v3$/, '') : clean;
  // prefer configured, then the alternate
  return [clean, hasApiV3 ? withoutApi : withApi];
}