import { encodeEventTopics } from "viem";
import erc20Abi from "../../abis/ERC20";
import { getAlchemyClient } from "../helpers/client";

const subscribeToCreateNewLeverageToken = async () => {
    console.log("Listening for CreateNewLeverageToken events...");

    const alchemy = getAlchemyClient();

    const encodedTopic = encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
    });

    alchemy.ws.on({
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        topics: [...encodedTopic],
    }, (event) => {
        console.log(event);
    });
};

export default subscribeToCreateNewLeverageToken;
