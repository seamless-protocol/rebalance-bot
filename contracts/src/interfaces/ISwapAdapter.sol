// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ISwapAdapter {
    error InvalidNumTicks();
    error InvalidNumFees();

    enum Exchange {
        AERODROME,
        AERODROME_SLIPSTREAM,
        UNISWAP_V2,
        UNISWAP_V3
    }

    struct ExchangeAddresses {
        address aerodromeRouter;
        address aerodromePoolFactory;
        address aerodromeSlipstreamRouter;
        address uniswapSwapRouter02;
        address uniswapV2Router02;
    }

    struct SwapContext {
        address[] path;
        bytes encodedPath;
        uint24[] fees;
        int24[] tickSpacing;
        Exchange exchange;
        ExchangeAddresses exchangeAddresses;
    }

    function swapExactInput(
        address inputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        SwapContext memory swapContext
    ) external returns (uint256 outputAmount);

    function swapExactOutput(
        address inputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        SwapContext memory swapContext
    ) external returns (uint256 inputAmount);
}
