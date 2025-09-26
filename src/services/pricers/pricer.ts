import type { Address, MaybePromise } from "viem";

/**
 * Pricers are used to price an asset in USD.
 * All pricers must implement this interface.
 */
export interface Pricer {
  /**
   * Get the price of the asset in USD.
   */
  price(
    baseAsset: Address,
  ): MaybePromise<number | undefined>;
}
