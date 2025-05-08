import { REBALANCE_ELIGIBILITY_POLL_INTERVAL } from "./constants/chain";
import monitorDutchAuctionRebalanceEligibility from "./services/monitorDutchAuctionRebalanceEligibility";
import { subscribeToAllAuctionCreatedEvents } from "./subscribers/auctionCreated";

subscribeToAllAuctionCreatedEvents();
monitorDutchAuctionRebalanceEligibility(REBALANCE_ELIGIBILITY_POLL_INTERVAL);
