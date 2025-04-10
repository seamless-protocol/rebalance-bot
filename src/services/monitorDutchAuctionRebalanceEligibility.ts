import { LeverageToken, RebalanceStatus } from "../types";

import { CHAIN } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { publicClient } from "../utils/transactionHelpers";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import rebalancerAbi from "../../abis/Rebalancer";

const getLeverageTokensByRebalanceStatus = async (rebalanceStatuses: RebalanceStatus[]): Promise<LeverageToken[]> => {
  const { leverageTokensFilePath } = CHAIN;
  const { LEVERAGE_MANAGER: leverageManagerAddress, REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES;

  const leverageTokens = readJsonArrayFromFile(leverageTokensFilePath) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${leverageTokensFilePath}`);
    return [];
  }

  // Get rebalance status for all LeverageTokens
  const tokenRebalanceStatuses = await publicClient.multicall({
    contracts: leverageTokens.map((token) => ({
      address: rebalancerAddress,
      abi: rebalancerAbi,
      functionName: "getRebalanceStatus",
      args: [leverageManagerAddress, token.address],
    })),
  });

  return leverageTokens.filter((_, index) => {
    const { result: tokenRebalanceStatus } = tokenRebalanceStatuses[index];
    if (tokenRebalanceStatus && rebalanceStatuses.includes(tokenRebalanceStatus)) {
      return true;
    }
    return false;
  });
};

const monitorDutchAuctionRebalanceEligibility = (interval: number) => {
  setInterval(async () => {
    try {
      console.log("Checking rebalance eligibility of LeverageTokens...");

      const eligibleTokens = await getLeverageTokensByRebalanceStatus([RebalanceStatus.DUTCH_AUCTION_ELIGIBLE]);

      eligibleTokens.forEach(async (_leverageToken) => {
        // TODO: Handle dutch auction for the LeverageToken
      });
    } catch (err) {
      console.error("Error monitoring rebalance eligibility:", err);
    }
  }, interval);
};

export default monitorDutchAuctionRebalanceEligibility;
