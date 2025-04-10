import { LeverageToken, RebalanceStatus } from "../types";
import { findChainById, getContractAddressesByChainId, getPublicClient } from "../utils/transactionHelpers";

import { CHAIN_IDS } from "../constants/chains";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import rebalancerAbi from "../../abis/Rebalancer";
import spawnDutchAuctionRebalanceWorker from "../workers/spawnDutchAuctionRebalanceWorker";

const getDutchAuctionRebalanceEligibleLeverageTokens = async (chainId: number): Promise<LeverageToken[]> => {
  const publicClient = getPublicClient(chainId);
  const { leverageTokensFilePath } = findChainById(chainId);
  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;
  const rebalancerAddress = getContractAddressesByChainId(chainId).REBALANCER;

  const leverageTokens = readJsonArrayFromFile(leverageTokensFilePath) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${leverageTokensFilePath} for chain ${chainId}`);
    return [];
  }

  // Get rebalance status for all LeverageTokens
  const rebalanceStatuses = await publicClient.multicall({
    contracts: leverageTokens.map((token) => ({
      address: rebalancerAddress,
      abi: rebalancerAbi,
      functionName: "getRebalanceStatus",
      args: [leverageManagerAddress, token.address],
    })),
  });

  return leverageTokens.filter((_, index) => {
    const rebalanceStatus = rebalanceStatuses[index].result;
    if (rebalanceStatus === RebalanceStatus.DUTCH_ELIGIBLE) {
      return true;
    }
    return false;
  });
};

const monitorDutchAuctionRebalanceEligibility = (interval: number) => {
  setInterval(async () => {
    try {
      console.log("Checking rebalance eligibility of LeverageTokens...");

      const eligibleTokens = await getDutchAuctionRebalanceEligibleLeverageTokens(CHAIN_IDS.BASE);

      eligibleTokens.forEach((token) => {
        spawnDutchAuctionRebalanceWorker(token);
      });
    } catch (err) {
      console.error("Error monitoring rebalance eligibility:", err);
    }
  }, interval);
};

export default monitorDutchAuctionRebalanceEligibility;
