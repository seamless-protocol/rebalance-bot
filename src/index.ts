import { Address } from "viem";
import { LogLevel } from "./types";
import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import { sendAlert } from "./utils/alerts";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";
import { addLeverageTokenToList } from "./backfill/addLeverageTokenToList";
import { ChainlinkPricer } from "./services/pricers/chainlink/chainlink";
import { Pricer } from "./services/pricers/pricer";

const main = async () => {
  try {
    console.log("Starting bot...");

    const pricers: Pricer[] = [
      new ChainlinkPricer(),
    ];

    const leverageTokens: Address[] = (process.env.BACKFILL_LEVERAGE_TOKENS?.split(",").filter(token => token.trim() !== "") ?? []) as Address[];

    for (const leverageToken of leverageTokens) {
      await addLeverageTokenToList(leverageToken);
    }

    subscribeToAllAuctionCreatedEvents(pricers);
    monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL, pricers);
  } catch (error) {
    console.error("Error caught in entrypoint:", error);
    await sendAlert(
      `*Error caught in entrypoint, bot has crashed*\n• Error Message: \`${(error as Error).message}\``,
      LogLevel.ERROR
    );
    throw error;
  }
};

main();
