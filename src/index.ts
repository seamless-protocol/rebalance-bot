import { CHAIN_IDS } from "./constants/chains";
import { findChainById } from "./utils/transactionHelpers";
import monitorLeverageTokenRebalanceEligibility from "./services/monitorRebalanceEligibility";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
monitorLeverageTokenRebalanceEligibility(findChainById(CHAIN_IDS.BASE).rebalanceEligibilityPollInterval);
