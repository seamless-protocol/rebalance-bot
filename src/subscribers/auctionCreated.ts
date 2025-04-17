import { Address, decodeEventLog, erc20Abi, formatUnits, getContract, Log, maxUint256, parseEther } from "viem";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";
import { getWebSocketUrl, publicClient, walletClient } from "../utils/transactionHelpers";
import { getLeverageTokenForRebalanceAdapter } from "../utils/contractHelpers";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import leverageManagerAbi from "../../abis/LeverageManager";
import { aerodromeRouterAbi } from "../../abis/AerodromeRouter";
import RebalancerAbi from "../../abis/Rebalancer";

const subscribeToAuctionCreated = (rebalanceAdapter: Address) => {
  console.log("Listening for AuctionCreated events...");

  const rpcUrl = getWebSocketUrl();

  subscribeToEventWithWebSocket({
    contractAddress: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onEvent: (event: Log) => {
      setInterval(() => {
        handleAuctionCreatedEvent(rebalanceAdapter, event);
      }, 10_000);
    },
    rpcUrl,
  });
};

const handleAuctionCreatedEvent = async (rebalanceAdapter: Address, event: Log) => {
  const decodedEvent = decodeEventLog({
    abi: RebalanceAdapterAbi,
    data: event.data,
    topics: event.topics,
  });

  if (decodedEvent.eventName === "AuctionCreated") {
    console.log("AuctionCreated event received. Participating in Dutch auction...");

    const leverageToken = getLeverageTokenForRebalanceAdapter(rebalanceAdapter);
    const [leverageTokenStateResponse, targetRatioResponse, isAuctionValidResponse] = await publicClient.multicall({
      contracts: [
        {
          address: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
          abi: leverageManagerAbi,
          functionName: "getLeverageTokenState",
          args: [leverageToken],
        },
        {
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "getLeverageTokenTargetCollateralRatio",
        },
        {
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "isAuctionValid",
        },
      ],
    });

    const leverageTokenState = leverageTokenStateResponse.result;
    const debt = leverageTokenState?.[1] as bigint;
    const currentRatio = leverageTokenState?.[3] as bigint;
    const targetRatio = targetRatioResponse.result as bigint;
    const isAuctionValid = isAuctionValidResponse.result as boolean;

    if (!isAuctionValid) {
      console.log("Auction is not valid. Skipping rebalance...");

      console.log("collateral ratio:", currentRatio);

      return;
    }

    if (currentRatio > targetRatio) {
      console.log("Strategy is over-collateralized. Exchanging collateral for debt...");

      const baseRatio = parseEther("1");
      const debtMultiplier = (baseRatio * (currentRatio - baseRatio)) / (targetRatio - baseRatio);
      console.log("Debt multiplier:", debtMultiplier);
      const maxDebtChange = ((((debtMultiplier - baseRatio) * debt) / baseRatio) * 98n) / 100n;

      const requiredAmountIn = await publicClient.readContract({
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "getAmountIn",
        args: [maxDebtChange],
      });

      // TODO: Fetch this from the third party
      const aerodromeRouter = getContract({
        address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        abi: aerodromeRouterAbi,
        client: publicClient,
      });

      const dexAmountOutResponse = await aerodromeRouter.read.getAmountsOut([
        maxDebtChange,
        [
          {
            from: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
            to: "0x4200000000000000000000000000000000000006", // WETH
            stable: false,
            factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
          },
        ],
      ]);

      console.log(dexAmountOutResponse);

      const dexAmountOut = dexAmountOutResponse[1];

      if (dexAmountOut > requiredAmountIn) {
        console.log("Taking auction is profitable. Proceeding with rebalance...");
        console.log("Max debt change:", maxDebtChange);

        const approveTx = await walletClient.writeContract({
          address: "0x4200000000000000000000000000000000000006",
          abi: erc20Abi,
          functionName: "approve",
          args: [rebalanceAdapter, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({
          hash: approveTx,
        });

        console.log("Approved rebalance adapter.");

        const rebalancerContract = getContract({
          address: CONTRACT_ADDRESSES.REBALANCER,
          abi: RebalancerAbi,
          client: walletClient,
        });

        const isAuctionValid = await publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "isAuctionValid",
        });
        console.log("Auction valid:", isAuctionValid);

        try {
          const tx = await rebalancerContract.write.takeAuctionRebalanceDown([
            "0x97915c43511f8cB4Fbe7Ea03B96EEe940eC4AF12",
            "0x4200000000000000000000000000000000000006",
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            maxDebtChange,
          ]);

          console.log("Rebalance transaction sent:", tx);

          await publicClient.waitForTransactionReceipt({
            hash: tx,
          });
          console.log("Rebalance transaction confirmed.");

          const leverageTokenState = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
            abi: leverageManagerAbi,
            functionName: "getLeverageTokenState",
            args: [leverageToken],
          });
        } catch (error) {
          console.log("Rebalance transaction failed:", error);
        }

        console.log("Leverage token state:", leverageTokenState);
      } else {
        console.log("Amount out is less than required amount in. Skipping rebalance...");
        console.log(dexAmountOut);
        console.log(requiredAmountIn);
      }

      console.log("Max debt change:", formatUnits(maxDebtChange, 6));
    }
  }
};

export default subscribeToAuctionCreated;
