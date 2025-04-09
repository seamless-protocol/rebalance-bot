import LeverageManagerAbi from "../../abis/LeverageManager";
import { Log } from "viem";
import { createWebSocketConnection } from "../utils/websocketHelpers";
import { getContractAddressesByChainId } from "../utils/transactionHelpers";
import { logWithPrefix } from "../utils/logHelpers";

const subscribeToDeposit = (chainId: number) => {
  logWithPrefix("Deposit", "Listening for events...");

  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;

  createWebSocketConnection({
    chainId,
    contractAddress: leverageManagerAddress,
    abi: LeverageManagerAbi,
    eventName: "Deposit",
    onEvent: handleDepositEvent,
  });
};

const handleDepositEvent = (_event: Log) => {
  // TODO: Execute handler logic
};

export default subscribeToDeposit;
