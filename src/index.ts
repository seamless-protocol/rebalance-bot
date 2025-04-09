import { CHAIN_IDS } from "./constants/chains";
import subscribeToDeposit from "./subscribers/deposit";
import subscribeToLeverageTokenCreated from "./subscribers/leverageTokenCreated";

subscribeToLeverageTokenCreated(CHAIN_IDS.BASE);
subscribeToDeposit(CHAIN_IDS.BASE);
