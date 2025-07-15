import { zeroAddress } from "viem";
import { StakeContext, StakeType } from "../../types";

import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { getEtherFiEthStakeQuote } from "./etherFi";

const getDummyStakeContext = (): StakeContext => {
  return {
    stakeType: StakeType.NONE,
    stakeTo: zeroAddress,
    assetIn: zeroAddress,
    amountIn: 0n,
  };
};

export const getStakeParams = async (
  stakeType: StakeType,
  takeAmount: bigint,
  requiredAmountIn: bigint
): Promise<{ stakeContext: StakeContext; isProfitable: boolean }> => {
  // if (stakeType == StakeType.ETHERFI_ETH_WEETH) {
  //   // The amount of WETH to stake is equal to the takeAmount, since if it's profitable the amount of WEETH received
  //   // by staking the takeAmount of WETH will be >= the requiredAmountIn. This also means that the full amount taken
  //   // from the auction is staked for WEETH.
  //   const weethAmountOut = await getEtherFiEthStakeQuote(takeAmount);
  //   return {
  //     isProfitable: requiredAmountIn <= weethAmountOut,
  //     stakeContext: {
  //       stakeType: StakeType.ETHERFI_ETH_WEETH,
  //       stakeTo: CONTRACT_ADDRESSES.ETHERFI_L2_MODE_SYNC_POOL,
  //       assetIn: CONTRACT_ADDRESSES.WETH,
  //       amountIn: takeAmount,
  //     },
  //   };
  // }

  return {
    isProfitable: false,
    stakeContext: getDummyStakeContext(),
  };
};
