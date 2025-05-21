import { LEVERAGE_TOKENS_FILE_PATH } from "@/constants/chain";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";
import { LeverageToken } from "@/types";
import { getHistoricalLogs } from "@/utils/contractHelpers";
import { appendObjectToJsonFile } from "@/utils/fileHelpers";
import { decodeEventLog } from "viem";
import { LeverageManagerAbi } from "../../abis/LeverageManager";

/**
 * Backfills LeverageToken JSON file for LeverageTokenCreated events emitted in a given block range
 * @dev Usage: npm run backfill:leverage-tokens <fromBlock> <toBlock>
 * @param fromBlock The block to start backfilling from
 * @param toBlock The block to stop backfilling at. If not provided, the latest block will be used.
 */
export const backfillLeverageTokens = async (fromBlock: number, toBlock?: number) => {
  const toBlockString = toBlock !== undefined ? toBlock.toString() : "latest";
  console.log(`Backfilling LeverageTokens from block ${fromBlock} to block ${toBlockString}`);

  const leverageTokenCreatedLogs = await getHistoricalLogs({
    contractAddress: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
    abi: LeverageManagerAbi,
    eventName: "LeverageTokenCreated",
    fromBlock,
    toBlock,
  });

  // For each log, decode the event and store the leverage token in the JSON file
  leverageTokenCreatedLogs.forEach((log) => {
    const decodedEvent = decodeEventLog({
      abi: LeverageManagerAbi,
      data: log.data,
      topics: log.topics,
    });

    if (decodedEvent.eventName !== "LeverageTokenCreated") {
      return;
    }

    const leverageToken: LeverageToken = {
      address: decodedEvent.args.token,
      collateralAsset: decodedEvent.args.collateralAsset,
      debtAsset: decodedEvent.args.debtAsset,
      rebalanceAdapter: decodedEvent.args.config.rebalanceAdapter,
      lendingAdapter: decodedEvent.args.config.lendingAdapter,
    };

    console.log(`Backfilling LeverageToken: ${leverageToken.address}`);

    appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, leverageToken);
  });

  console.log(`Backfilling of LeverageTokens from block ${fromBlock} to block ${toBlockString} complete`);

  process.exit(0);
};

// Get args from command line
const fromBlock = parseInt(process.argv[2], 10);
const toBlock = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

backfillLeverageTokens(fromBlock, toBlock);
