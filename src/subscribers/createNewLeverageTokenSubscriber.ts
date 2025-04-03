import LeverageManagerAbi from "../../abis/LeverageManager";
import { encodeEventTopics } from "viem";
import { getAlchemyClient } from "../utils/client";
import { getContractAddressesByChainId } from "../utils/transactionHelpers";

const subscribeToCreateNewLeverageToken = async (chainId: number): Promise<void> => {
  console.log("Listening for CreateNewLeverageToken events...");

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

      // TODO: parse event, save leverage token and rebalance adapter addresses somewhere:
      //       1. it should be persistent
      //       2. we should be able to read it while updates are occurring to the data set
      //       3. we should be able to backfill the data set in case of outages
    }
  );
};

export default subscribeToCreateNewLeverageToken;
