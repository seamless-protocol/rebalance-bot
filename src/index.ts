import { CHAIN_IDS } from "./constants/chains";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
