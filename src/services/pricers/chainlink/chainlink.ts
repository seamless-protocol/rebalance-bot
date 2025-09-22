import {
  formatUnits,
  getAddress,
  type Address,
} from "viem";
import { readContract } from "viem/actions";
import { base, mainnet } from "viem/chains";
import ChainlinkFeedRegistryAbi from "../../../../abis/ChainlinkFeedRegistry";
import { CHAIN_ID } from "../../../constants/chain";
import type { Pricer } from "../pricer";
import { mainnetPublicClient } from "../../../utils/transactionHelpers";

type CoinKey = `${string}:${Address}`;

/**
 * ISO 4217 denominations used by Chainlink
 */
export const DENOMINATIONS = {
  EUR: "0x00000000000000000000000000000000000003d2",
  GBP: "0x000000000000000000000000000000000000033a",
  USD: "0x0000000000000000000000000000000000000348",
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  BTC: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
} as const;

// Maps from assets that are wrapped 1:1 to the underlying asset in cases where there is no data feed path to USD for the
// wrapped asset on Ethereum Mainnet.
// Also maps from asset addresses on other chains to the asset address on Ethereum Mainnet, since the Chainlink Feed Registry
// used to fetch prices is only available on Ethereum Mainnet.
const MAPPINGS: Record<number, Record<Address, Address>> = {
  [mainnet.id]: {
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": DENOMINATIONS.ETH, // WETH → ETH
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": DENOMINATIONS.BTC, // WBTC → BTC
  },
  [base.id]: {
    "0x4200000000000000000000000000000000000006": DENOMINATIONS.ETH, // WETH → ETH
    "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c": DENOMINATIONS.BTC, // WBTC → BTC
    "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A": "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", // weETH on Base -> weETH on Ethereum Mainnet
  }
};

// Maps from a base asset to a quote asset to fetch the price for before fetching the USD price, for assets that don't have a direct feed to USD.
// For example, to get the price of weETH, we first fetch weETH/ETH and then ETH/USD.
export const PRICE_PATH_TO_USD: Record<Address, Address> = {
  "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee": DENOMINATIONS.ETH, // weETH -> ETH -> USD
}

interface CachedPrice {
  price: number;
  fetchTimestamp: number;
}

// Implementation based off Morpho's Liquidator Bot implementation
// https://github.com/morpho-org/morpho-blue-liquidation-bot/blob/5cbefb1064ff03bf5dca2f0db5bf9072200cc14e/apps/client/src/pricers/chainlink/index.ts
// Fetches prices of assets from the Chainlink Feed Registry on Ethereum Mainnet.
export class ChainlinkPricer implements Pricer {
  private readonly FEED_REGISTRY_ADDRESS: Address = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";

  private readonly CACHE_TIMEOUT_MS = 30_000; // 30 seconds

  private priceCache = new Map<CoinKey, CachedPrice>();

  async price(
    baseAsset: Address
  ): Promise<number | undefined> {
    baseAsset = getAddress(baseAsset); // Always use checksummed address
    baseAsset = MAPPINGS[CHAIN_ID][baseAsset] ?? baseAsset;

    const coinKey: CoinKey = `${mainnetPublicClient.chain.name}:${baseAsset}`;
    const cachedPrice = this.priceCache.get(coinKey);

    // Return cached price if available and not expired
    if (cachedPrice && Date.now() - cachedPrice.fetchTimestamp < this.CACHE_TIMEOUT_MS) {
      return cachedPrice.price;
    }

    try {

      let rawPrice: bigint;
      let decimals: number;

      // Some assets don't have a direct feed to USD, so we need to fetch the price for the asset in another asset and then fetch the price for the other asset in USD.
      if (baseAsset in PRICE_PATH_TO_USD) {
        const pricePathAsset = PRICE_PATH_TO_USD[baseAsset];

        // Query price from Feed Registry
        const [roundDataA, decimalsA, roundDataB, decimalsB] = await Promise.all([
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "latestRoundData",
            args: [baseAsset, pricePathAsset],
          }),
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "decimals",
            args: [baseAsset, pricePathAsset],
          }),
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "latestRoundData",
            args: [pricePathAsset, DENOMINATIONS.USD],
          }),
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "decimals",
            args: [pricePathAsset, DENOMINATIONS.USD],
          }),
        ]);

        // Extract price from round data (answer is the price)
        const rawPriceA = roundDataA[1];
        const rawPriceB = roundDataB[1];

        // Scale so final result has decimals of the second data feed
        rawPrice = (rawPriceA * rawPriceB) / (10n ** BigInt(decimalsA));
        decimals = decimalsB;
      } else {
        // Query price from Feed Registry
        const [roundData, feedDecimals] = await Promise.all([
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "latestRoundData",
            args: [baseAsset, DENOMINATIONS.USD],
          }),
          readContract(mainnetPublicClient, {
            address: this.FEED_REGISTRY_ADDRESS,
            abi: ChainlinkFeedRegistryAbi,
            functionName: "decimals",
            args: [baseAsset, DENOMINATIONS.USD],
          }),
        ]);

        // Extract price from round data (answer is the price)
        rawPrice = roundData[1];
        decimals = feedDecimals;
      }

      // Ensure price is positive
      if (rawPrice <= 0n) {
        return undefined;
      }

      // Convert to proper decimal representation
      const price = Number(formatUnits(rawPrice, decimals));

      // Cache the result
      this.priceCache.set(coinKey, { price, fetchTimestamp: Date.now() });

      return price;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching Chainlink price for ${baseAsset} in USD:`, error);
      } else {
        console.error(`Error fetching Chainlink price for ${baseAsset} in USD:`, String(error));
      }
      return undefined;
    }
  }
}
