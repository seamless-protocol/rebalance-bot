import { ethers, BigNumber } from "ethers";
import {
  SupportedChainId,
  OrderKind,
  TradeParameters,
  TradingSdk,
  SigningScheme,
  SwapAdvancedSettings,
} from "@cowprotocol/cow-sdk";
import LeverageManagerAbi from "./leverageManagerAbi.json";

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

// script.ts
const greet = async (name: string) => {
  console.log(`Hello, ${name}!`);

  const leverageManagerAddress = "0x38Ba21C6Bf31dF1b1798FCEd07B4e9b07C5ec3a8";
  const weETHAddress = "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A";
  const WETHAddress = "0x4200000000000000000000000000000000000006";
  const leverageTokenAddress = "0xA2fceEAe99d2cAeEe978DA27bE2d95b0381dBB8c";

  const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const leverageManager = new ethers.Contract(leverageManagerAddress, LeverageManagerAbi, provider);

  // 100000000000000 = 0.0001 weETH
  const equityInCallateral = ethers.utils.parseEther("0.0001");
  const { collateral, debt, equity, shares, tokenFee, treasuryFee }: ActionData = await leverageManager.previewMint(
    leverageTokenAddress,
    equityInCallateral
  );
  console.log("collateral", collateral);
  console.log("debt", debt.toString());
  console.log("equity", equity);
  console.log("shares", shares);
  console.log("tokenFee", tokenFee);
  console.log("treasuryFee", treasuryFee);

  const mintTx = leverageManager.interface.encodeFunctionData("mint", [
    leverageTokenAddress,
    equityInCallateral,
    shares,
  ]);

  const appData = {
    metadata: {
      flashloan: {
        // morpho vault
        lender: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        token: weETHAddress,
        amount: collateral.sub(equity).toString(), // 5,000 USDT
      },
      hooks: {
        pre: [
          {
            target: leverageManagerAddress,
            value: "0",
            callData: mintTx, // repay pre-hook data
            gasLimit: "500000",
          },
        ],
        post: [],
      },
      signer: signer.address,
    },
  };

  // Initialize the SDK
  const sdk = new TradingSdk({
    chainId: SupportedChainId.BASE,
    signer,
    appCode: "seamless",
  });

  const parameters: TradeParameters = {
    kind: OrderKind.BUY,
    sellToken: WETHAddress,
    sellTokenDecimals: 18,
    buyToken: weETHAddress,
    buyTokenDecimals: 18,
    amount: debt.toString(), // swap the WETH for weETH
    // receiver is always the settlement contract because the driver takes
    // funds from the settlement contract to pay back the loan
    receiver: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41", // cow settlement contract address on sepolia
  };

  const quote = await sdk.getQuote(parameters, {
    quoteRequest: {
      from: signer.address,
      signingScheme: SigningScheme.EIP712,
    },
  });

  console.log("quote", quote);

  const advancedParameters: SwapAdvancedSettings = {
    quoteRequest: {
      signingScheme: SigningScheme.EIP712,
    },
    appData,
  };
  const orderId = await sdk.postSwapOrder(parameters, advancedParameters);

  console.log("orderId", orderId);
};

greet("World");
