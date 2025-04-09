import { CHAIN_IDS } from "./constants/chains";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreatedSubscriber";

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
