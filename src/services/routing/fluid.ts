import { Address, encodeFunctionData, getAddress } from "viem";
import FluidDexReservesResolverAbi from "../../../abis/FluidDexReservesResolver";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { CHAIN_ID } from "../../constants/chain";
import { publicClient } from "../../utils/transactionHelpers";
import FluidDexT1Abi from "../../../abis/FluidDexT1";
import { Call } from "../../types";

export class FluidDex {

    // Maps from token pair `tokenA-tokenB` to an array of pool addresses that serve the pair
    private tokenPairToPoolsCache = new Map<string, Address[]>();

    // Maps from pool address to the token pair it serves, in the order returned by the `FLUID_DEX_RESERVES_RESOLVER` contract
    private poolsToTokenPairCache = new Map<Address, Address[]>();

    async getEstimateSwapIn(fromToken: Address, toToken: Address, fromAmount: bigint) {
        const pools = await this.getPools(fromToken, toToken);

        if (!pools) {
            return 0n;
        }

        const estimates = await publicClient.multicall({
            contracts: pools.map((pool: Address) => ({
                address: CONTRACT_ADDRESSES[CHAIN_ID].FLUID_DEX_RESERVES_RESOLVER as Address,
                abi: FluidDexReservesResolverAbi,
                functionName: 'estimateSwapIn',
                args: [pool, this.poolsToTokenPairCache.get(pool)?.[0] === fromToken, fromAmount, 0n],
            })),
        });

        let bestEstimate = 0n;
        estimates.forEach((estimate) => {
            if (estimate.status === 'success') {
                const result = estimate.result as bigint;

                if (result > bestEstimate) {
                    bestEstimate = result;
                }
            }
        });

        return bestEstimate;
    }

    prepareSwapCalldata(pool: Address, fromToken: Address, fromAmount: bigint): Call[] {
        const swap0to1 = this.poolsToTokenPairCache.get(pool)?.[0] === fromToken;

        return [
            {
                target: pool,
                data: encodeFunctionData({
                    abi: FluidDexT1Abi,
                    functionName: 'swapIn',
                    args: [swap0to1, fromAmount, 0n, CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER], // Recipient of the swap is the rebalancer contract
                }),
                value: 0n,
            },
        ];
    }

    private async getPools(tokenA: Address, tokenB: Address) {
        const tokenPair = [getAddress(tokenA), getAddress(tokenB)].sort();
        const tokenPairKey = tokenPair.join('-');

        if (this.tokenPairToPoolsCache.has(tokenPairKey)) {
            return this.tokenPairToPoolsCache.get(tokenPairKey);
        }
        const poolsResponse = await publicClient.readContract({
            address: CONTRACT_ADDRESSES[CHAIN_ID].FLUID_DEX_RESERVES_RESOLVER as Address,
            abi: FluidDexReservesResolverAbi,
            functionName: 'getAllPools',
        });

        // Find pools that contain the token pair
        const pools = poolsResponse.filter((pool: { token0: Address; token1: Address; }) => {
            const poolTokenPair = [getAddress(pool.token0), getAddress(pool.token1)].sort();
            return poolTokenPair[0] === tokenPair[0] && poolTokenPair[1] === tokenPair[1];
        });

        if (!this.tokenPairToPoolsCache.has(tokenPairKey)) {
            this.tokenPairToPoolsCache.set(tokenPairKey, []);
        }

        pools.forEach((pool: { pool: Address; token0: Address; token1: Address; }) => {
            this.tokenPairToPoolsCache.get(tokenPairKey)?.push(pool.pool);
            this.poolsToTokenPairCache.set(pool.pool, [pool.token0, pool.token1]);
        });

        return pools.map((pool: { pool: Address; token0: Address; token1: Address; }) => pool.pool);
    }
}

export const FLUID_DEX = new FluidDex();