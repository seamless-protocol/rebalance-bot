import LeverageManagerAbi from "../../abis/LeverageManager";
import { Log } from "viem";
import { createWebSocketConnection } from "../utils/websocketHelpers";
import { getContractAddressesByChainId } from "../utils/transactionHelpers";
import { logWithPrefix } from "../utils/logHelpers";

const subscribeToWithdraw = (chainId: number) => {
  logWithPrefix("Withdraw", "Listening for events...");

  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;

  createWebSocketConnection({
    chainId,
    contractAddress: leverageManagerAddress,
    abi: LeverageManagerAbi,
    eventName: "Withdraw",
    onEvent: handleWithdrawEvent,
  });
};

const handleWithdrawEvent = (_event: Log) => {
  // TODO: Execute handler logic
};

export default subscribeToWithdraw;
