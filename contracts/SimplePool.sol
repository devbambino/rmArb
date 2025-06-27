// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SimplePool
/// @notice A minimal constant-product AMM pool for two ERC-20s
contract SimplePool is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable token0;
    IERC20 public immutable token1;
    uint112 private reserve0;
    uint112 private reserve1;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address to);
    event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _token0, address _token1) ERC20("SimpleLP", "sLP") {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /// @dev Returns current reserves
    function getReserves() public view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    /// @notice Deposit proportional amounts of token0 & token1, mint LP tokens
    function mint(address to) external returns (uint liquidity) {
        (uint112 _r0, uint112 _r1) = (reserve0, reserve1);
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));
        uint amount0 = balance0 - _r0;
        uint amount1 = balance1 - _r1;

        if (totalSupply() == 0) {
            liquidity = sqrt(amount0 * amount1);
        } else {
            liquidity = min(
                (amount0 * totalSupply()) / _r0,
                (amount1 * totalSupply()) / _r1
            );
        }
        require(liquidity > 0, "Insufficient liquidity minted");
        _mint(to, liquidity);

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /// @notice Burn LP tokens to withdraw underlying tokens
    function burn(address to) external returns (uint amount0, uint amount1) {
        (uint112 _r0, uint112 _r1) = (reserve0, reserve1);
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));
        uint liquidity = balanceOf(address(this));

        amount0 = (liquidity * balance0) / totalSupply();
        amount1 = (liquidity * balance1) / totalSupply();
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");

        _burn(address(this), liquidity);
        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);

        balance0 = token0.balanceOf(address(this));
        balance1 = token1.balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /// @notice Swap tokens along the 0→1 or 1→0 path
    function swap(uint amount0Out, uint amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "Insufficient output");
        (uint112 _r0, uint112 _r1) = (reserve0, reserve1);
        require(amount0Out < _r0 && amount1Out < _r1, "Insufficient liquidity");

        if (amount0Out > 0) token0.safeTransfer(to, amount0Out);
        if (amount1Out > 0) token1.safeTransfer(to, amount1Out);

        // compute balances after transfer
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));

        // enforce constant product: (balance0 * balance1) >= (reserve0 * reserve1)
        require(
            uint(balance0) * balance1 >= uint(_r0) * _r1,
            "K"
        );

        _update(balance0, balance1);
        emit Swap(msg.sender, balance0 - (_r0 - amount0Out), balance1 - (_r1 - amount1Out), amount0Out, amount1Out, to);
    }

    /// @dev Update reserves and emit Sync
    function _update(uint balance0, uint balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    /// @dev Helper: sqrt
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) z = 1;
    }

    /// @dev Helper: min
    function min(uint x, uint y) internal pure returns (uint) {
        return x < y ? x : y;
    }
}
