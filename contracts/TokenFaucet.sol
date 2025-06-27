// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenFaucet
 * @dev A smart contract that serves as a faucet for a custom ERC20 token,
 *      allowing users to receive tokens in exchange for ETH, up to a certain limit.
 *      Users can send ETH directly to the contract's address to trigger the exchange.
 */
contract TokenFaucet is Ownable {
    // --- Constants ---
    uint256 private constant CUSTOM_TOKEN_DECIMALS = 6;

    // Exchange rate: 1 ETH = 49000 Custom Tokens
    // This value represents the number of CUSTOM_TOKENS received for 1 unit of ETH (wei).
    // The formula will scale this correctly based on the custom token's decimals.
    uint256 private constant TOKEN_EXCHANGE_RATE = 49000;

    // Maximum tokens a single user can receive (4000 tokens).
    // This value is pre-scaled to the custom token's smallest unit (e.g., 4000 * 10^18 for 18 decimals).
    uint256 private constant MAX_TOKENS_PER_USER = 4000 * (10**CUSTOM_TOKEN_DECIMALS);


    // --- State Variables ---
    // ERC20 interface for the custom token.
    IERC20 public immutable customToken;

    // Mapping to keep track of the total custom tokens received by each user.
    // The amount is stored in the custom token's smallest unit (e.g., wei for 18 decimals).
    mapping(address => uint256) public userTokensReceived;


    // --- Events ---
    event CustomTokensDeposited(address indexed depositor, uint256 amount);
    event TokensWithdrawn(address indexed receiver, uint256 customTokenAmount, uint256 ethAmount);
    event TokensRequested(address indexed user, uint256 ethPaid, uint256 customTokensReceived);


    /**
     * @dev Constructor to initialize the faucet with the address of the custom token.
     * @param _customTokenAddress The address of the ERC20 custom token.
     */
    constructor(address _customTokenAddress) Ownable(msg.sender) {
        require(_customTokenAddress != address(0), "Faucet: Custom token address cannot be zero");

        customToken = IERC20(_customTokenAddress);
    }

    /**
     * @dev Allows the contract owner to deposit custom tokens into the faucet.
     *      The owner must have previously approved this contract to spend the specified
     *      amount of custom tokens using `customToken.approve(address(this), _amount)`.
     * @param _amount The amount of custom tokens to deposit (in their smallest unit, e.g., wei).
     */
    function depositCustomTokens(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Faucet: Deposit amount must be greater than zero");

        // Transfer tokens from the owner's address to this contract.
        // This relies on a prior `approve` call by the owner on the customToken contract.
        bool success = customToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Faucet: Custom token transfer failed");

        emit CustomTokensDeposited(msg.sender, _amount);
    }

    /**
     * @dev Allows the contract owner to withdraw all custom tokens and ETH
     *      currently held by the faucet contract.
     */
    function withdrawAll() external onlyOwner {
        // Get current balances of custom tokens and ETH held by this contract.
        uint256 customTokenBalance = customToken.balanceOf(address(this));
        uint256 ethBalance = address(this).balance;

        require(customTokenBalance > 0 || ethBalance > 0, "Faucet: No tokens or ETH to withdraw");

        // Transfer custom tokens to the owner, if any.
        if (customTokenBalance > 0) {
            bool success = customToken.transfer(msg.sender, customTokenBalance);
            require(success, "Faucet: Custom token withdrawal failed");
        }

        // Transfer ETH to the owner, if any.
        if (ethBalance > 0) {
            // Using `call` for ETH transfers is generally safer than `transfer` or `send`
            // as it forwards all available gas and prevents reentrancy by requiring
            // the recipient to be a contract that can handle raw calls (or an EOA).
            (bool success, ) = payable(msg.sender).call{value: ethBalance}("");
            require(success, "Faucet: ETH withdrawal failed");
        }

        emit TokensWithdrawn(msg.sender, customTokenBalance, ethBalance);
    }

    /**
     * @dev Checks the current balance of the custom token held by the faucet.
     * @return The amount of custom tokens (in their smallest unit).
     */
    function getCustomTokenBalance() external view returns (uint256) {
        return customToken.balanceOf(address(this));
    }

    /**
     * @dev Checks the current balance of ETH held by the faucet.
     * @return The amount of ETH (in wei).
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev This `receive` function is automatically triggered when a user sends
     *      ETH directly to the contract address without specifying a function.
     *      It serves as the main entry point for users to get custom tokens.
     *      The exchange rate is 1 ETH for 49000 custom tokens.
     *      Each user is limited to receiving a maximum of 4000 custom tokens in total.
     */
    receive() external payable {
        require(msg.value > 0, "Faucet: ETH amount must be greater than zero");

        // Calculate the amount of custom tokens to give based on the ETH sent (msg.value)
        // and the exchange rate, accounting for custom token decimals.
        // Formula: (ETH_amount_in_wei * TOKEN_EXCHANGE_RATE * 10^CUSTOM_TOKEN_DECIMALS) / 10^18 (wei per ETH)
        // Example: If msg.value = 1 ether (10^18 wei)
        //          tokensToGive = (10^18 * 49000 * 10^6) / 10^18 = 49000 * 10^18 (49000 custom tokens)
        uint256 tokensToGive = (msg.value * TOKEN_EXCHANGE_RATE * (10**CUSTOM_TOKEN_DECIMALS)) / (10**18);

        require(tokensToGive > 0, "Faucet: Calculated tokens to give is zero. Check input or decimals.");
        require(customToken.balanceOf(address(this)) >= tokensToGive, "Faucet: Not enough custom tokens in faucet");

        // Check and enforce the per-user token cap.
        uint256 currentReceived = userTokensReceived[msg.sender];
        uint256 newTotalReceived = currentReceived + tokensToGive;
        require(newTotalReceived <= MAX_TOKENS_PER_USER, "Faucet: User has reached maximum token limit");

        // Transfer custom tokens from this contract to the user.
        bool customTokenTransferSuccess = customToken.transfer(msg.sender, tokensToGive);
        require(customTokenTransferSuccess, "Faucet: Custom token transfer to user failed");

        // Update the amount of tokens received by the user.
        userTokensReceived[msg.sender] = newTotalReceived;

        emit TokensRequested(msg.sender, msg.value, tokensToGive);
    }
}