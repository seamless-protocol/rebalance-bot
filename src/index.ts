import { Address, zeroAddress } from "viem";
import { LogLevel } from "./types";
import { CHAIN_ID,REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import { CONTRACT_ADDRESSES } from "./constants/contracts";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import { sendAlert } from "./utils/alerts";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";
import { addLeverageTokenToList } from "./backfill/addLeverageTokenToList";
import { ChainlinkPricer } from "./services/pricers/chainlink/chainlink";
import { Pricer } from "./services/pricers/pricer";
import { createComponentLogger } from "./utils/logger";

const mainLogger = createComponentLogger('main');

const main = async () => {
  try {
    mainLogger.info("Starting bot...");

    if (CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER === zeroAddress) {
      throw new Error("Dutch auction rebalancer address is not set");
    }

    if (CONTRACT_ADDRESSES[CHAIN_ID].PRE_LIQUIDATION_REBALANCER === zeroAddress) {
      throw new Error("Pre-liquidation rebalancer address is not set");
    }

    const pricers: Pricer[] = [
      new ChainlinkPricer(),
    ];

    const leverageTokens: Address[] = (process.env.BACKFILL_LEVERAGE_TOKENS?.split(",").filter(token => token.trim() !== "") ?? []) as Address[];

    if (leverageTokens.length > 0) {
      mainLogger.info({ leverageTokenCount: leverageTokens.length }, "Backfilling leverage tokens");

      const backfillLogger = createComponentLogger('backfillLeverageTokens');
      for (const leverageToken of leverageTokens) {
        await addLeverageTokenToList(leverageToken, backfillLogger);
      }
    }

    mainLogger.info("Starting auction event subscriptions and monitoring");
    subscribeToAllAuctionCreatedEvents(pricers);
    monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL, pricers);
  } catch (error) {
    mainLogger.error({ error }, "Error caught in entrypoint");
    throw error;
  }
};

const handleCrash = async (error: Error, source: string) => {
  mainLogger.error({ error, source }, `Bot crashed due to ${source}`);

  try {
    await sendAlert(
      `*🚨 REBALANCE BOT CRASHED*\n• Source: \`${source}\`\n• Error: \`${error.message}\`\n• Stack: \`\`\`${error.stack?.substring(0, 500) || 'No stack trace available'}\`\`\``,
      LogLevel.ERROR
    );
  } catch (alertError) {
    mainLogger.error({ alertError }, "Failed to send crash alert to Slack");
  }

  // Give some time for the alert to be sent before exiting
  setTimeout(() => {
    process.exit(1);
  }, 3000);
};

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  await handleCrash(error, 'uncaught exception');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await handleCrash(error, 'unhandled promise rejection');
});

// Handle SIGTERM for graceful shutdown
process.on('SIGTERM', async () => {
  mainLogger.info("Received SIGTERM, shutting down gracefully");
  await sendAlert("*Rebalance Bot Shutdown*\n• Reason: SIGTERM received\n• Status: Graceful shutdown", LogLevel.INFO);
  process.exit(0);
});

// Handle SIGINT for graceful shutdown
process.on('SIGINT', async () => {
  mainLogger.info("Received SIGINT, shutting down gracefully");
  await sendAlert("*Rebalance Bot Shutdown*\n• Reason: SIGINT received (Ctrl+C)\n• Status: Graceful shutdown", LogLevel.INFO);
  process.exit(0);
});

main();
