// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.3/token/ERC20/ERC20.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.3/access/Ownable.sol";

/**
 * @title TestMXNe
 * @dev Simple ERC20 to mimic MXNe on Base mainnet:
 *  - 6 decimals
 *  - fixed initial supply minted at deploy
 *  - Ownable for future mint/burn controls
 */
contract TestUSDC is ERC20, Ownable {
    /// @notice Set decimals to 6, matching MXNe stablecoin
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @param initialSupply The total supply, in whole units (will be scaled by `decimals()`).
     *                      e.g. `1000000` → `1 000 000 × 10⁶` base‐units.
     */
    constructor(uint256 initialSupply) ERC20("Testnet USDC", "tUSDC") {
        // Mint scaled supply to deployer
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /**
     * @notice Optional: allow owner to mint new tokens
     * @dev by default only owner can call.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Optional: allow owner to burn tokens from an address
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
