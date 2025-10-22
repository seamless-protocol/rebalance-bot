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

const main = async () => {
  const mainLogger = createComponentLogger('main');

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

    mainLogger.info("Bot initialization completed successfully");
  } catch (error) {
    mainLogger.error({ error }, "Error caught in entrypoint, bot has crashed");
    await sendAlert(
      `*Error caught in entrypoint, bot has crashed*\n• Error Message: \`${(error as Error).message}\``,
      LogLevel.ERROR
    );
    throw error;
  }
};

main();
