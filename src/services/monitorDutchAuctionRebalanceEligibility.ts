import { LeverageToken, RebalanceStatus } from "../types";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { publicClient, walletClient } from "../utils/transactionHelpers";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import rebalancerAbi from "../../abis/Rebalancer";
import { getContract } from "viem";

// Store whether or not a LeverageToken is already being handled by the dutch auction handling logic using a map.
// This is to prevent duplicate handling of the same LeverageToken.
const handledLeverageTokens = new Set<string>();

const getLeverageTokensByRebalanceStatus = async (rebalanceStatuses: RebalanceStatus[]): Promise<LeverageToken[]> => {
  const { LEVERAGE_MANAGER: leverageManagerAddress, REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES;

  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${LEVERAGE_TOKENS_FILE_PATH}`);
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
    if (tokenRebalanceStatus && rebalanceStatuses.includes(tokenRebalanceStatus as unknown as RebalanceStatus)) {
      return true;
    }
    return false;
  });
};

const tryCreateDutchAuction = async (leverageToken: LeverageToken) => {
  const { REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES;

  const rebalancerContract = getContract({
    address: rebalancerAddress,
    abi: rebalancerAbi,
    client: walletClient,
  });

  const tx = await rebalancerContract.write.tryCreateAuction([leverageToken.address]);

  console.log(`TryCreateAuction for ${leverageToken.address}:`, tx);

  await publicClient.waitForTransactionReceipt({
    hash: tx,
  });

  console.log(`TryCreateAuction successful for LeverageToken ${leverageToken.address}`);
};

const monitorDutchAuctionRebalanceEligibility = (interval: number) => {
  setInterval(async () => {
    try {
      console.log("Checking dutch auction rebalance eligibility of LeverageTokens...");

      const eligibleTokens = await getLeverageTokensByRebalanceStatus([RebalanceStatus.DUTCH_AUCTION_ELIGIBLE]);

      eligibleTokens.forEach(async (leverageToken) => {
        if (!handledLeverageTokens.has(leverageToken.address)) {
          handledLeverageTokens.add(leverageToken.address);
          try {
            await tryCreateDutchAuction(leverageToken);

            handledLeverageTokens.delete(leverageToken.address);
          } catch (handleError) {
            console.error(`Error handling DutchAuctionRebalance for ${leverageToken.address}:`, handleError);
            handledLeverageTokens.delete(leverageToken.address);
          }
        }
      });
    } catch (err) {
      console.error("Error monitoring rebalance eligibility:", err);
    }
  }, interval);
};

export default monitorDutchAuctionRebalanceEligibility;
