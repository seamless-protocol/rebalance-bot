import { Client, Hex } from "viem";

type TSimulationRequestParams = [simulationRequest: {
    from: Hex,
    to: Hex,
    gas: Hex,
    gasPrice: Hex,
    value: Hex,
    data: Hex,
  }, blockNumber: "latest" | Hex];

  type AssetChange = {
    "assetInfo": {
      "standard": "ERC20" | "",
      "type": "Fungible" | "NonFungible",
      "contractAddress": Hex,
      "symbol": string,
      "name": string,
      "logo": string,
      "decimals": number,
      "dollarValue": string
    },
    "type": string,
    "from": Hex,
    "to": Hex,
    "rawAmount": Hex,
    "amount": `${number}`,
    "dollarValue": `${number}`,
  }

  type Log = {
    "name": String,
    "anonymous": boolean,
    "inputs": {
      "value": Hex,
      "type": string,
      "name": string
    }[],
    "raw": {
      "address": Hex,
      "topics": [
        Hex,
        Hex,
        Hex
      ],
      "data": Hex
    }
  }

  type Trace = {
    "type": string,
    "from": Hex,
    "to": Hex,
    "gas": Hex,
    "gasUsed": Hex,
    "value": Hex,
    "input": Hex,
    "decodedInput": {
      "value": Hex,
      "type": string,
      "name": string
    }[],
    "method": "string",
    "output": Hex,
    "decodedOutput": {
      "value": boolean,
      "type": string,
      "name": string
    }[],
    "subtraces": number,
    "traceAddress": any[]
  }

// Taken from Tenderly docs https://github.com/Tenderly/tenderly-examples/blob/e129ebd9921d255e546fa47faa8ad18011470f4a/virtual-testnets/src/viem-tenderly-actions.ts
export async function tenderlySimulateTransaction(client: Client, params: TSimulationRequestParams) {
  return client.request<
      {
      method: "tenderly_simulateTransaction",
      Parameters: TSimulationRequestParams,
      ReturnType: {
          trace: Trace[],
          logs: Log[],
          assetChanges: AssetChange[],
          balanceChanges: {
          "address": Hex
          "dollarValue": `${number}`,
          "transfers": any
          }[]
      }
      }
  >({
      method: "tenderly_simulateTransaction",
      params,
  });
}