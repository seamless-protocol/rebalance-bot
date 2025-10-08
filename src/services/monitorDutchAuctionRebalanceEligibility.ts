import { BaseError, ContractFunctionRevertedError, getContract, parseEventLogs } from "viem";
import { LeverageToken, LogLevel, RebalanceStatus } from "../types";
import { getPaddedGas, publicClient, walletClient } from "../utils/transactionHelpers";

import { DutchAuctionRebalancerAbi } from "../../abis/DutchAuctionRebalancer";
import { CHAIN_ID, LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { sendAlert } from "../utils/alerts";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { startPreLiquidationRebalanceInInterval } from "./preLiquidationRebalance";
import { getLeverageTokenLendingAdapter, getLeverageTokenRebalanceAdapter } from "../utils/contractHelpers";
import { getDutchAuctionInterval, startNewDutchAuctionInterval } from "../subscribers/auctionCreated";
import { Pricer } from "./pricers/pricer";

// Store whether or not a LeverageToken is already being handled by the dutch auction handling logic using a map.
// This is to prevent duplicate handling of the same LeverageToken.
const handledLeverageTokens = new Set<string>();

const getLeverageTokensByRebalanceStatus = async (rebalanceStatuses: RebalanceStatus[]): Promise<LeverageToken[]> => {
  const { DUTCH_AUCTION_REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES[CHAIN_ID];

  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  if (!leverageTokens.length) {
    console.log(`No LeverageTokens found in ${LEVERAGE_TOKENS_FILE_PATH}`);
    return [];
  }

  // Get rebalance status for all LeverageTokens
  const tokenRebalanceStatuses = await publicClient.multicall({
    contracts: leverageTokens.map((token) => ({
      address: rebalancerAddress,
      abi: DutchAuctionRebalancerAbi,
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

const tryCreateDutchAuction = async (leverageToken: LeverageToken, pricers: Pricer[]) => {
  const { DUTCH_AUCTION_REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES[CHAIN_ID];

  const rebalancerContract = getContract({
    address: rebalancerAddress,
    abi: DutchAuctionRebalancerAbi,
    client: walletClient,
  });

  try {
    console.log(`Attempting CreateAuction for LeverageToken ${leverageToken.address}...`);

    // Will throw an error if reverts
    const { request: simulationRequest } = await rebalancerContract.simulate.createAuction([leverageToken.address]);

    const tx = await rebalancerContract.write.createAuction([leverageToken.address], {
      gas: simulationRequest.gas ? getPaddedGas(simulationRequest.gas) : undefined,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
    });

    const createAuctionEvent = parseEventLogs({
      abi: DutchAuctionRebalancerAbi,
      eventName: "AuctionCreated",
      logs: receipt.logs,
    })[0];
    const { status } = createAuctionEvent.args;

    console.log(
      `Rebalancer.CreateAuction successful for LeverageToken ${leverageToken.address}, auction created. Transaction hash: ${tx}`
    );

    const statusMessage =
      status === RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE ? "Pre-liquidation eligible" : "Dutch auction eligible";

    await sendAlert(
      `*Rebalance auction created successfully*\n• LeverageToken: \`${leverageToken.address}\`\n• Transaction Hash: \`${tx}\`\n• Status: \`${statusMessage}\``,
      LogLevel.INFO
    );
  } catch (error) {
    if (error instanceof BaseError) {
      const revertError = error.walk((error) => error instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName;
        if (errorName === "AuctionAlreadyExists") {
          console.log(
            `Rebalancer.CreateAuction unsuccessful for LeverageToken ${leverageToken.address}, auction already exists. Participating in Dutch auction...`
          );

          const dutchAuctionInterval = getDutchAuctionInterval(leverageToken.address);
          if (!dutchAuctionInterval) {
            console.log(`No dutch auction interval found for LeverageToken ${leverageToken.address}, starting new dutch auction interval...`);
            startNewDutchAuctionInterval(getLeverageTokenLendingAdapter(leverageToken.address), getLeverageTokenRebalanceAdapter(leverageToken.address), pricers);
          }
        } else if (errorName === "IneligibleForRebalance") {
          console.log(
            `Rebalancer.CreateAuction unsuccessful for LeverageToken ${leverageToken.address}, leverage token is not eligible for rebalancing.`
          );
        } else {
          console.error(`Error in tryCreateDutchAuction for LeverageToken ${leverageToken.address}: ${error}`);
          throw error;
        }
      }
    } else {
      console.error(`Error in tryCreateDutchAuction for LeverageToken ${leverageToken.address}: ${error}`);
      throw error;
    }
  }
};

const monitorDutchAuctionRebalanceEligibility = (interval: number, pricers: Pricer[]) => {
  setInterval(async () => {
    try {
      console.log("Checking dutch auction rebalance eligibility of LeverageTokens...");

      // Get all eligible tokens but also get tokens that are pre liquidation eligible
      // For pre liquidation eligible tokens we will still start dutch auction but we will also start pre liquidation rebalance
      // It might happen that pre liquidation is fast enough to rebalance token properly for small price
      const [eligibleTokens, preLiquidationEligibleTokens] = await Promise.all([
        getLeverageTokensByRebalanceStatus([
          RebalanceStatus.DUTCH_AUCTION_ELIGIBLE,
          RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE,
        ]),
        getLeverageTokensByRebalanceStatus([RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE]),
      ]);

      // Start interval. Inside of this interval we will try to execute pre liquidation rebalance and save the strategy
      // If the interval already exists for this leverage token function will not start the new one.
      preLiquidationEligibleTokens.forEach(async (leverageToken) => {
        startPreLiquidationRebalanceInInterval(leverageToken.address);
      });

      eligibleTokens.forEach(async (leverageToken) => {
        if (!handledLeverageTokens.has(leverageToken.address)) {
          handledLeverageTokens.add(leverageToken.address);
          try {
            await tryCreateDutchAuction(leverageToken, pricers);

            handledLeverageTokens.delete(leverageToken.address);
          } catch (handleError) {
            handledLeverageTokens.delete(leverageToken.address);
            console.error(`Error creating DutchAuctionRebalance for ${leverageToken.address}: ${handleError}`);
            await sendAlert(
              `*Error creating DutchAuctionRebalance*\n• LeverageToken: \`${leverageToken.address}\`\n• Error Message: \`${(handleError as Error).message}\``,
              LogLevel.ERROR
            );
          }
        }
      });
    } catch (err) {
      console.error("Error monitoring rebalance eligibility:", err);
      await sendAlert(
        `*Error monitoring rebalance eligibility*\n• Error Message: \`${(err as Error).message}\``,
        LogLevel.ERROR
      );
    }
  }, interval);
};

export default monitorDutchAuctionRebalanceEligibility;
