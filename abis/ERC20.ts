import { parseAbi } from "viem";

const erc20Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export default erc20Abi;
