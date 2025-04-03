import LeverageManagerAbi from "../../abis/LeverageManager";
import { encodeEventTopics } from "viem";
import { getAlchemyClient } from "../utils/client";
import { getContractAddressesByChainId } from "../constants/contracts";

const subscribeToCreateNewLeverageToken = async (chainId: number) => {
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
    }
  );
};

export default subscribeToCreateNewLeverageToken;
