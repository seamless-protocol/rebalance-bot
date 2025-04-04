import { decodeEventLog, encodeEventTopics } from "viem";
import { getAlchemyClient, getContractAddressesByChainId } from "../utils/transactionHelpers";

import LeverageManagerAbi from "../../abis/LeverageManager";
import { LeverageToken } from "@/types";
import { appendObjectToJsonFile } from "../utils/fileHelpers";
import path from "path";

const LEVERAGE_TOKENS_FILE_PATH = path.join(__dirname, "..", "data", "leverageTokens.json");

const subscribeToLeverageTokenCreated = (chainId: number) => {
  console.log("Listening for LeverageTokenCreated events...");

  const alchemy = getAlchemyClient(chainId);
  const leverageManagerAddress = getContractAddressesByChainId(chainId).LEVERAGE_MANAGER;
  const encodedTopic = encodeEventTopics({
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
  });

  alchemy.ws.on(
    {
      address: leverageManagerAddress,
      topics: [...encodedTopic],
    },
    (event) => {
      console.log(event);
      saveLeverageToken(event);
    }
  );
};

const saveLeverageToken = (event: any) => {
  const decodedEvent = decodeEventLog({
    abi: LeverageManagerAbi,
    data: event.data,
    topics: event.topics,
  });
  const leverageToken: LeverageToken = {
    address: decodedEvent.args[0],
    collateralAsset: decodedEvent.args[1],
    debtAsset: decodedEvent.args[2],
    rebalanceAdapter: decodedEvent.args[3].rebalanceAdapter,
  };

  appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, leverageToken);
};

export default subscribeToLeverageTokenCreated;
