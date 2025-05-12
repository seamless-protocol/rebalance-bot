import { LogLevel } from "./types";
import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import { sendAlert } from "./utils/alerts";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";

const main = async () => {
  try {
    subscribeToAllAuctionCreatedEvents();
    monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
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
