import { LeverageToken, RebalanceStatus } from "../types";
import { publicClient, walletClient } from "../utils/transactionHelpers";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { RebalancerAbi } from "../../abis/Rebalancer";
import { getContract } from "viem";
import { notifySlackChannel } from "../utils/alerts";
import { readJsonArrayFromFile } from "../utils/fileHelpers";

// Store whether or not a LeverageToken is already being handled by the dutch auction handling logic using a map.
// This is to prevent duplicate handling of the same LeverageToken.
const handledLeverageTokens = new Set<string>();

const getLeverageTokensByRebalanceStatus = async (rebalanceStatuses: RebalanceStatus[]): Promise<LeverageToken[]> => {
  const { REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES;

  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${LEVERAGE_TOKENS_FILE_PATH}`);
    return [];
  }

  // Get rebalance status for all LeverageTokens
  const tokenRebalanceStatuses = await publicClient.multicall({
    contracts: leverageTokens.map((token) => ({
      address: rebalancerAddress,
      abi: RebalancerAbi,
      functionName: "getRebalanceStatus",
      args: [token.address],
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
    abi: RebalancerAbi,
    client: walletClient,
  });

  const tx = await rebalancerContract.write.tryCreateAuction([leverageToken.address]);

  console.log(`TryCreateAuction for ${leverageToken.address}:`, tx);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: tx,
  });

  const message =
    receipt.status === "success"
      ? `TryCreateAuction successful for LeverageToken ${leverageToken.address}. Transaction hash: ${tx}`
      : `TryCreateAuction failed for LeverageToken ${leverageToken.address}. Transaction hash: ${tx}`;

  console.log(message);
  await notifySlackChannel(message);
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
