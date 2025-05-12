import { StakeData, StakeType } from "@/types";

import { Address, zeroAddress } from "viem";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";
import RebalanceAdapterAbi from "abis/RebalanceAdapter";
import { getEtherFiEthStakeQuote } from "./etherFi";
import { publicClient } from "@/utils/transactionHelpers";

const getDummyStakeData = (): StakeData => {
  return {
    stakeType: StakeType.NONE,
    stakeTo: zeroAddress,
    assetIn: zeroAddress,
  };
};

export const getStakeParams = async (
  rebalanceAdapter: Address,
  stakeType: StakeType,
  takeAmount: bigint
): Promise<{ stakeData: StakeData; isProfitable: boolean }> => {
  if (stakeType == StakeType.ETHERFI_ETH_WEETH) {
    const [requiredAmountIn, weethAmountOut] = await Promise.all([
      publicClient.readContract({
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "getAmountIn",
        args: [takeAmount],
      }),
      getEtherFiEthStakeQuote(takeAmount),
    ]);

    return {
      isProfitable: requiredAmountIn <= weethAmountOut,
      stakeData: {
        stakeType: StakeType.ETHERFI_ETH_WEETH,
        stakeTo: CONTRACT_ADDRESSES.ETHERFI_L2_MODE_SYNC_POOL,
        assetIn: CONTRACT_ADDRESSES.WETH,
      },
    };
  }

  return {
    isProfitable: false,
    stakeData: getDummyStakeData(),
  };
};
