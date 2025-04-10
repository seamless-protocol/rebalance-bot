import { LeverageToken, LeverageTokenState } from "@/types";
import { findChainById, getPublicClient } from "../utils/transactionHelpers";

import { CHAIN_IDS } from "../constants/chains";
import leverageManagerAbi from "../../abis/LeverageManager";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import rebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import spawnDutchAuctionRebalanceWorker from "../workers/spawnDutchAuctionRebalanceWorker";

const getRebalanceEligibleLeverageTokens = async (chainId: number): Promise<LeverageToken[]> => {
  const publicClient = getPublicClient(chainId);
  const { leverageTokensFilePath } = findChainById(chainId);

  const leverageTokens = readJsonArrayFromFile(leverageTokensFilePath) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${leverageTokensFilePath} for chain ${chainId}`);
    return [];
  }

  // Get current state for all LeverageTokens
  const leverageTokenStates = await publicClient.multicall({
    contracts: leverageTokens.map((token) => ({
      address: token.address,
      abi: leverageManagerAbi,
      functionName: "getLeverageTokenState",
      args: [token.address],
    })),
  });

  // Check rebalance eligibility for each LeverageToken
  const rebalanceEligibilityResults = await publicClient.multicall({
    contracts: leverageTokens.map((token, index) => {
      const state = leverageTokenStates[index].result as LeverageTokenState;
      if (!state) {
        throw new Error(`Failed to get state for token ${token.address}`);
      }

      return {
        address: token.rebalanceAdapter,
        abi: rebalanceAdapterAbi,
        functionName: "isEligibleForRebalance",
        args: [
          token.address,
          [state.collateralInDebtAsset, state.debt, state.equity, state.collateralRatio],
          token.rebalanceAdapter,
        ],
      };
    }),
  });

  return leverageTokens.filter((_, index) => {
    const isEligible = rebalanceEligibilityResults[index].result;
    if (isEligible) {
      return true;
    }
    return false;
  });
};

const monitorLeverageTokenRebalanceEligibility = (interval: number) => {
  setInterval(async () => {
    try {
      console.log("Checking rebalance eligibility of LeverageTokens...");

      const eligibleTokens = await getRebalanceEligibleLeverageTokens(CHAIN_IDS.BASE);

      eligibleTokens.forEach((token) => {
        spawnDutchAuctionRebalanceWorker(token);
      });
    } catch (err) {
      console.error("Error monitoring rebalance eligibility:", err);
    }
  }, interval);
};

export default monitorLeverageTokenRebalanceEligibility;
