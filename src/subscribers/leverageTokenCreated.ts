import { Log, decodeEventLog } from "viem";
import { findChainById, getContractAddressesByChainId } from "../utils/transactionHelpers";

import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "@/types";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";

const subscribeToLeverageTokenCreated = (chainId: number) => {
  console.log("Listening for LeverageTokenCreated events...");

  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;

  subscribeToEventWithWebSocket({
    chainId,
    contractAddress: leverageManagerAddress,
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
    onEvent: (event: Log) => {
      handleLeverageTokenCreatedEvent(event, chainId);
    },
  });
};

const handleLeverageTokenCreatedEvent = (event: Log, chainId: number) => {
  const { leverageTokensFilePath } = findChainById(chainId);

  const decodedEvent = decodeEventLog({
    abi: LeverageManagerAbi,
    data: event.data,
    topics: event.topics,
  });

  // When an abi includes multiple events, viem's `decodeEventLog` will return a union type, which causes a ts error
  // when accessing the args. This if statement is a workaround to ensure the args are the correct type to avoid
  // the ts error.
  if (decodedEvent.eventName === "LeverageTokenCreated") {
    const leverageToken: LeverageToken = {
      address: decodedEvent.args[0],
      collateralAsset: decodedEvent.args[1],
      debtAsset: decodedEvent.args[2],
      rebalanceAdapter: decodedEvent.args[3].rebalanceAdapter,
    };

    appendObjectToJsonFile(leverageTokensFilePath, leverageToken);
  }
};

export default subscribeToLeverageTokenCreated;
