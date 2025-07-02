// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// IMPORTANT: LiquidityPool needs to expose a function to get totalAssets
interface ILiquidityPool {
    function totalShares() external view returns (uint256);
    function shares(address user) external view returns (uint256);
    function totalAssets() external view returns (uint256);
}

contract FeePool is Ownable {
    using SafeERC20 for IERC20;

    address public manager;
    IERC20 public immutable asset; // Fee token, e.g., MXNb (6 decimals)
    ILiquidityPool public immutable liquidityPool;
    address public treasury;

    uint256 public constant TREASURY_RATE_BPS = 1000; // 10% in basis points (1000/10000)
    
    // --- NEW REWARD LOGIC ---
    uint256 public accumulatedRewardsPerShare;
    mapping(address => uint256) public userRewardPerSharePaid;
    mapping(address => uint256) public rewards;
    // --- END NEW REWARD LOGIC ---

    uint256 public totalFeesCollected;

    event FeeCollected(uint256 amount);
    event FeeAccrued(uint256 userAmount, uint256 treasuryAmount);
    event FeeClaimed(address indexed user, uint256 amount);

    constructor(address _token, address _liquidityPool, address _treasury) {
        asset = IERC20(_token);
        liquidityPool = ILiquidityPool(_liquidityPool);
        treasury = _treasury;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "FeePool: Not manager");
        _;
    }

    /// @dev Modifier to update rewards for a user before their state changes
    modifier updateReward(address user) {
        accumulatedRewardsPerShare = rewardPerShare();
        rewards[user] = earned(user);
        userRewardPerSharePaid[user] = accumulatedRewardsPerShare;
        _;
    }

    function setupManagement(address _newManager) public onlyOwner {
        manager = _newManager;
    }

    /// @notice Collect loan fees from the MicroloanManager
    function collectFee(uint256 amount) external onlyManager {
        require(amount > 0, "FeePool: Zero fee");
        totalFeesCollected += amount;
        emit FeeCollected(amount);
        
        // Accrue fees immediately for distribution
        _accrueFee(amount);
    }

    /// @notice Internal function to distribute collected fees to lenders and treasury
    function _accrueFee(uint256 accruedFee) private {
        uint256 totalPoolShares = liquidityPool.totalShares();
        if (accruedFee == 0 || totalPoolShares == 0) {
            return;
        }

        uint256 treasuryCut = (accruedFee * TREASURY_RATE_BPS) / 10000;
        uint256 lenderAmount = accruedFee - treasuryCut;

        if (treasuryCut > 0) {
            asset.safeTransfer(treasury, treasuryCut);
        }
        
        // Update the global reward-per-share metric
        accumulatedRewardsPerShare += (lenderAmount * 1e18) / totalPoolShares;
        
        emit FeeAccrued(lenderAmount, treasuryCut);
    }

    /// @notice Calculates the total rewards earned by a user.
    /// @param user The address of the user.
    /// @return The amount of rewards earned.
    function earned(address user) public view returns (uint256) {
        uint256 userShares = liquidityPool.shares(user);
        return (userShares * (rewardPerShare() - userRewardPerSharePaid[user])) / 1e18 + rewards[user];
    }
    
    /// @notice Calculates the current reward per share value.
    function rewardPerShare() public view returns (uint256) {
        // This function is now simplified because fees are accrued instantly.
        return accumulatedRewardsPerShare;
    }


    /// @notice Claim owed rewards.
    /// User must have interacted with the LiquidityPool first (deposit/withdraw) to update their rewards.
    function claim() external updateReward(msg.sender) {
        uint256 amount = rewards[msg.sender];
        require(amount > 0, "FeePool: Nothing to claim");

        rewards[msg.sender] = 0;
        asset.safeTransfer(msg.sender, amount);
        emit FeeClaimed(msg.sender, amount);
    }

    /// @notice This function is crucial. The LiquidityPool must call it
    /// whenever a user's share balance changes (deposit/withdraw).
    function beforeShareTransfer(address user) external updateReward(user) {
        // We only allow LiquidityPool to call this
        require(msg.sender == address(liquidityPool), "FeePool: Caller is not LiquidityPool");
    }

    function feeBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}