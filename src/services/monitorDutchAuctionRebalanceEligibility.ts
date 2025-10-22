import { BaseError, ContractFunctionRevertedError, getContract, parseEventLogs } from "viem";
import { LeverageToken, LogLevel, RebalanceStatus } from "../types";
import { getPaddedGas, publicClient, walletClient } from "../utils/transactionHelpers";

import { DutchAuctionRebalancerAbi } from "../../abis/DutchAuctionRebalancer";
import { CHAIN_ID, LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { CREATE_AUCTION_TIMEOUT } from "../constants/values";
import { sendAlert } from "../utils/alerts";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { getCreateAuctionLock } from "../utils/locks";
import { startPreLiquidationRebalanceInInterval } from "./preLiquidationRebalance";
import { getLeverageTokenLendingAdapter, getLeverageTokenRebalanceAdapter } from "../utils/contractHelpers";
import { getDutchAuctionInterval, startNewDutchAuctionInterval } from "../subscribers/auctionCreated";
import { Pricer } from "./pricers/pricer";
import { createComponentLogger } from "../utils/logger";

const logger = createComponentLogger('monitorDutchAuctionRebalanceEligibility');

const getLeverageTokensByRebalanceStatus = async (rebalanceStatuses: RebalanceStatus[]): Promise<LeverageToken[]> => {
  const { DUTCH_AUCTION_REBALANCER: rebalancerAddress } = CONTRACT_ADDRESSES[CHAIN_ID];

  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  if (!leverageTokens.length) {
    logger.warn({ filePath: LEVERAGE_TOKENS_FILE_PATH }, "No LeverageTokens found in file");
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
    logger.info({ leverageToken: leverageToken.address }, "Attempting CreateAuction for LeverageToken");

    // Will throw an error if reverts
    const { request: simulationRequest } = await rebalancerContract.simulate.createAuction([leverageToken.address]);

    const tx = await rebalancerContract.write.createAuction([leverageToken.address], {
      gas: simulationRequest.gas ? getPaddedGas(simulationRequest.gas) : undefined,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
      timeout: CREATE_AUCTION_TIMEOUT,
    });

    const createAuctionEvent = parseEventLogs({
      abi: DutchAuctionRebalancerAbi,
      eventName: "AuctionCreated",
      logs: receipt.logs,
    })[0];

    if (receipt.status === "reverted") {
      logger.error({
        leverageToken: leverageToken.address,
        transactionHash: tx
      }, "Rebalancer.CreateAuction reverted, likely because auction was already created by another rebalancer");
      await sendAlert(
        `*Error creating DutchAuctionRebalance*\n• LeverageToken: \`${leverageToken.address}\`\n• Transaction Hash: \`${tx}\`\n• This likely ocurred because the auction was already created by another rebalancer.`,
        LogLevel.INFO
      );

      // If receipt status is reverted, re-simulate to get the error, as the receipt does not contain the error.
      // If the simulation succeeds, the another attempt of this `tryCreateDutchAuction` function will need to be made
      // (we will not try to create the auction again in this if statement)
      await rebalancerContract.simulate.createAuction([leverageToken.address]);
    } else {
      const { status } = createAuctionEvent.args;

      logger.info({
        leverageToken: leverageToken.address,
        transactionHash: tx,
        status
      }, "Rebalancer.CreateAuction successful, auction created");

      const statusMessage =
        status === RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE ? "Pre-liquidation eligible" : "Dutch auction eligible";

      await sendAlert(
        `*Rebalance auction created successfully*\n• LeverageToken: \`${leverageToken.address}\`\n• Transaction Hash: \`${tx}\`\n• Status: \`${statusMessage}\``,
        LogLevel.INFO
      );
    }
  } catch (error) {
    if (error instanceof BaseError) {
      const revertError = error.walk((error) => error instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName;
        if (errorName === "AuctionAlreadyExists") {
          logger.info({ leverageToken: leverageToken.address }, "Auction already exists, participating in Dutch auction");

          const dutchAuctionInterval = getDutchAuctionInterval(leverageToken.address);
          if (!dutchAuctionInterval) {
            logger.info({ leverageToken: leverageToken.address }, "No dutch auction interval found, starting new interval");
            startNewDutchAuctionInterval(getLeverageTokenLendingAdapter(leverageToken.address), getLeverageTokenRebalanceAdapter(leverageToken.address), pricers);
          }
        } else if (errorName === "IneligibleForRebalance") {
          logger.info({ leverageToken: leverageToken.address }, "LeverageToken is not eligible for rebalancing");
        } else {
          logger.error({ leverageToken: leverageToken.address, error, errorName }, "Error in tryCreateDutchAuction");
          throw error;
        }
      }
    } else {
      logger.error({ leverageToken: leverageToken.address, error }, "Error in tryCreateDutchAuction");
      throw error;
    }
  }
};

const monitorDutchAuctionRebalanceEligibility = (interval: number, pricers: Pricer[]) => {
  setInterval(async () => {
    try {
      logger.info("Checking dutch auction rebalance eligibility of LeverageTokens");

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
        const lock = getCreateAuctionLock(leverageToken.address);
        let leaseOwner: symbol;
        try {
          leaseOwner = lock.acquire();
        } catch (error) {
          logger.debug({ leverageToken: leverageToken.address }, "Lock for creating Dutch auction is occupied, skipping interval execution");
          return;
        }

        try {
          await tryCreateDutchAuction(leverageToken, pricers);
        } catch (handleError) {
          logger.error({ leverageToken: leverageToken.address, error: handleError }, "Error creating DutchAuctionRebalance");
          await sendAlert(
            `*Error creating DutchAuctionRebalance*\n• LeverageToken: \`${leverageToken.address}\`\n• Error Message: \`${(handleError as Error).message}\``,
            LogLevel.ERROR
          );
        } finally {
          lock.release(leaseOwner);
        }
      });
    } catch (err) {
      logger.error({ error: err }, "Error monitoring rebalance eligibility");
      await sendAlert(
        `*Error monitoring rebalance eligibility*\n• Error Message: \`${(err as Error).message}\``,
        LogLevel.ERROR
      );
    }
  }, interval);
};

export default monitorDutchAuctionRebalanceEligibility;
