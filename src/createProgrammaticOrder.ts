import { ethers, BigNumber } from "ethers";
import {
  SupportedChainId,
  SigningScheme,
  OrderBookApi,
  OrderKind,
  SellTokenSource,
  BuyTokenDestination,
} from "@cowprotocol/cow-sdk";
import ComposableCowAbi from "./composableCowAbi.json";
import { MetadataApi } from "@cowprotocol/app-data";
import Safe from "@safe-global/protocol-kit";
import { MetaTransactionData } from "@safe-global/types-kit";

import LeverageManagerAbi from "./leverageManagerAbi.json";
// import ERC20Abi from "./erc20Abi.json";

import { config } from "dotenv";
config();

interface ActionData {
  collateral: BigNumber;
  debt: BigNumber;
  equity: BigNumber;
  shares: BigNumber;
  tokenFee: BigNumber;
  treasuryFee: BigNumber;
}

interface TrasableOrder {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: BigNumber;
  buyAmount: BigNumber;
  validTo: number;
  appData: string;
  feeAmount: BigNumber;
  kind: string;
  partiallyFillable: boolean;
  sellTokenBalance: string;
  buyTokenBalance: string;
}

// 0x6a76120200000000000000000000000004c0599ae5a44757c0af6f9ec3b93da8976c150a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000018ff6f81d8718d97c379c86dd11a4953a3d5e0aa00000000000000000000000000000000000000000000000000003faa25226000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041ad843a5d2343f6f2da91c3ed8b4e363e4cb220771db117431e357e164ea0da8c60099cbf5abb524a1265acd2773a7d1a3a4194dc320f360dcb2186041d9911a41b00000000000000000000000000000000000000000000000000000000000000

// 0x6a76120200000000000000000000000004c0599ae5a44757c0af6f9ec3b93da8976c150a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000044a9059cbb00000000000000000000000018ff6f81d8718d97c379c86dd11a4953a3d5e0aa0000000000000000000000000000000000000000000000000000065dd083700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004186c404ae6b6b46e5cd99418f0ee8f570f94356718f1564e57ea0b1246d9e1799033c9711ff770fdb6478d16e98746c6750da12f9e7df102ca927422634fc88951b00000000000000000000000000000000000000000000000000000000000000

// {
//   "domain": {
//     "verifyingContract": "0x00329eeb09eeec0b7513dde76dbed168807a114f",
//     "chainId": 8453
//   },
//   "message": {
//     "to": "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a",
//     "value": "0",
//     "data": "0xa9059cbb00000000000000000000000018ff6f81d8718d97c379c86dd11a4953a3d5e0aa0000000000000000000000000000000000000000000000000000065dd0837000",
//     "operation": 0,
//     "baseGas": "0",
//     "gasPrice": "0",
//     "gasToken": "0x0000000000000000000000000000000000000000",
//     "refundReceiver": "0x0000000000000000000000000000000000000000",
//     "nonce": 12,
//     "safeTxGas": "0"
//   },
//   "primaryType": "SafeTx",
//   "types": {
//     "EIP712Domain": [
//       {
//         "name": "chainId",
//         "type": "uint256"
//       },
//       {
//         "name": "verifyingContract",
//         "type": "address"
//       }
//     ],
//     "SafeTx": [
//       {
//         "type": "address",
//         "name": "to"
//       },
//       {
//         "type": "uint256",
//         "name": "value"
//       },
//       {
//         "type": "bytes",
//         "name": "data"
//       },
//       {
//         "type": "uint8",
//         "name": "operation"
//       },
//       {
//         "type": "uint256",
//         "name": "safeTxGas"
//       },
//       {
//         "type": "uint256",
//         "name": "baseGas"
//       },
//       {
//         "type": "uint256",
//         "name": "gasPrice"
//       },
//       {
//         "type": "address",
//         "name": "gasToken"
//       },
//       {
//         "type": "address",
//         "name": "refundReceiver"
//       },
//       {
//         "type": "uint256",
//         "name": "nonce"
//       }
//     ]
//   }
// }

// script.ts
const greet = async (name: string) => {
  console.log(`Hello, ${name}!`);

  const baseUrl = "https://mainnet.base.org";

  const leverageManagerAddress = "0x38Ba21C6Bf31dF1b1798FCEd07B4e9b07C5ec3a8";
  const weETHAddress = "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A";
  const WETHAddress = "0x4200000000000000000000000000000000000006";
  const leverageTokenAddress = "0xA2fceEAe99d2cAeEe978DA27bE2d95b0381dBB8c";
  const settlementContractAddress = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

  const composableCowAddress = "0xfdafc9d1902f4e0b84f65f49f244b32b31013b74";
  const safeAddress = "0x00329eeB09eeeC0B7513dDE76dBEd168807a114F";
  // const handlerAddress = "0xaeFB9b7FC0D97b51DeB86613d8F9Ce062c12bBBa";
  const handlerAddress = "0x41fE12B961726643959763959e98dBC0f65C2A9D";

  const provider = new ethers.providers.JsonRpcProvider(baseUrl);
  // const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

  // const weETH = new ethers.Contract(weETHAddress, ERC20Abi, provider);
  const leverageManager = new ethers.Contract(leverageManagerAddress, LeverageManagerAbi, provider);

  const appCode = "CoW Swap";
  const environment = "production";

  const quote = { slippageBips: 10, smartSlippage: false }; // Slippage percent, it's 0 to 100
  // const orderClass = { orderClass: "market" }; // "market" | "limit" | "liquidity"

  const equityInCallateral = ethers.utils.parseEther("0.00001");
  const { collateral, debt, equity, shares }: ActionData = await leverageManager.previewMint(
    leverageTokenAddress,
    equityInCallateral
  );

  const safe = await Safe.init({
    provider: baseUrl,
    signer: process.env.PRIVATE_KEY as string,
    safeAddress,
  });

  const mintTx = leverageManager.interface.encodeFunctionData("mint", [
    leverageTokenAddress,
    equityInCallateral,
    shares,
  ]);

  // const transferTx = weETH.interface.encodeFunctionData("transfer", [
  //   "0x18fF6f81d8718D97C379C86dd11A4953a3D5e0aa",
  //   ethers.utils.parseEther("0.000006"),
  // ]);

  const repaySafeTxData: MetaTransactionData = {
    to: leverageManagerAddress, // Aave pool address in Sepolia
    value: "0",
    data: mintTx, // created previously
    // operation: OperationType.Call,
  };

  const safeTransaction = await safe.createTransaction({ transactions: [repaySafeTxData] });
  const signedSafeTransaction = await safe.signTransaction(safeTransaction);
  const encodedSafeTransaction = await safe.getEncodedTransaction(signedSafeTransaction);

  const metadataApi = new MetadataApi();

  const appDataDoc = await metadataApi.generateAppDataDoc({
    appCode,
    environment,
    metadata: {
      flashloan: {
        // // aave vault
        // lender: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        // morpho vault
        lender: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        borrower: safeAddress,
        token: weETHAddress,
        amount: collateral.sub(equity).toString(),
      },
      hooks: {
        pre: [
          {
            target: safeAddress,
            callData: encodedSafeTransaction,
            gasLimit: "650000",
          },
        ],
        post: [],
      },
      signer: safeAddress,
      quote,
      orderClass: {
        orderClass: "market",
      },
    },
  });

  const { appDataContent, appDataHex, cid } = await metadataApi.getAppDataInfo(appDataDoc);

  console.log("appDataContent", appDataContent);
  console.log("appDataHex", appDataHex);
  console.log("cid", cid);

  const composableCow = new ethers.Contract(composableCowAddress, ComposableCowAbi, provider);
  const offchainInput = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "uint256", "uint256", "bytes32"],
    [
      WETHAddress,
      weETHAddress,
      settlementContractAddress,
      debt.mul(11000).div(10000),
      collateral.sub(equity).mul(10010).div(10000),
      appDataHex,
    ]
  );

  const trasableOrder: { order: TrasableOrder; signature: string } = await composableCow.getTradeableOrderWithSignature(
    safeAddress,
    [handlerAddress, "0x0000000000000000000000000000000000000000000000000000000000000001", "0x"],
    offchainInput,
    []
  );

  console.log("trasableOrder", trasableOrder);

  const orderBookApi = new OrderBookApi({
    chainId: SupportedChainId.BASE,
  });

  const signedOrder = {
    sellToken: trasableOrder.order.sellToken,
    buyToken: trasableOrder.order.buyToken,
    receiver: trasableOrder.order.receiver,
    sellAmount: trasableOrder.order.sellAmount.toString(),
    buyAmount: trasableOrder.order.buyAmount.toString(),
    validTo: trasableOrder.order.validTo,
    appData: appDataContent,
    feeAmount: trasableOrder.order.feeAmount.toString(),
    kind: OrderKind.SELL,
    partiallyFillable: trasableOrder.order.partiallyFillable,
    sellTokenBalance: SellTokenSource.ERC20,
    buyTokenBalance: BuyTokenDestination.ERC20,
    signature: trasableOrder.signature,
    signingScheme: SigningScheme.EIP1271,
    from: safeAddress,
  };

  const orderRes = await orderBookApi.sendOrder(signedOrder);

  console.log("order", orderRes);
};

greet("World");
