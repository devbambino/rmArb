// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface ILiquidityPool {
    function totalShares() external view returns (uint256);
    function shares(address user) external view returns (uint256);
}

contract FeePool is Ownable {
    using SafeERC20 for IERC20;

    address public manager;
    IERC20 public immutable asset;       // fee token, e.g., TestMXNb
    ILiquidityPool public immutable liquidityPool;
    address public treasury;

    uint256 public treasuryRate = 10; // 10% of all claimable fees
    uint256 public claimableFees; // Total fees available for users

    // --- NEW: Fee-per-share distribution variables ---
    uint256 public accFeePerShare; // Accumulated fees per share (with 1e18 precision)
    mapping(address => uint256) public rewards; // Rewards earned by user but not yet claimed
    mapping(address => uint256) public rewardDebt; // Tracks rewards accounted for per user

    event FeeCollected(uint256 amount);
    event FeeAccrued(uint256 amount);
    event FeeTransferredTreasury(uint256 amount);
    event FeeClaimed(address indexed user, uint256 amount);
    event RewardUpdated(address indexed user, uint256 newRewards);

    constructor(address _token, address _liquidityPool, address _treasury) {
        asset = IERC20(_token);
        liquidityPool = ILiquidityPool(_liquidityPool);
        treasury = _treasury;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    function setupManagement(address _newManager) public onlyOwner {
        manager = _newManager;
    }

    /// @notice Collect loan fees from customer's purchase payment
    function collectFee(uint256 amount) external onlyManager {
        require(amount > 0, "Zero fee");
        //totalFees += amount;
        emit FeeCollected(amount);
    }

    /// @notice Release loan fees for lender claims
    function accrueFee(uint256 accruedFee) external onlyManager {
        require(accruedFee > 0, "Zero accruedFee");
        // compute treasury cut
        uint256 treasuryCut = (accruedFee * treasuryRate) / 100;
        require(asset.balanceOf(address(this)) >= treasuryCut, "Not enough liquidity in the fee pool for treasury fee");
        asset.safeTransfer(treasury, treasuryCut);
        // [4.1] Emit the actual amount sent to treasury
        emit FeeTransferredTreasury(treasuryCut);

        uint256 userAmount = accruedFee - treasuryCut;
        claimableFees += userAmount;

        // [1.3] Update the global fee-per-share accumulator
        uint256 _totalShares = liquidityPool.totalShares();
        if (_totalShares > 0) {
            // Use 1e18 for precision to avoid rounding errors
            accFeePerShare += (userAmount * 1e18) / _totalShares;
        }
        emit FeeAccrued(accruedFee);
    }

    /// @notice Calculates pending rewards for a user.
    function earned(address _user) public view returns (uint256) {
        uint256 userShares = liquidityPool.shares(_user);
        uint256 newAccruedValue = (userShares * accFeePerShare);
        uint256 debt = rewardDebt[_user];
        uint256 newlyEarned;
        
        // This check prevents underflow for new depositors
        if(newAccruedValue >= debt) {
            newlyEarned = (newAccruedValue - debt) / 1e18;
        }

        return rewards[_user] + newlyEarned;
    }

    /// @notice Updates a user's reward balance.
    /// This function should be called by the LiquidityPool before a user's shares change.
    function updateReward(address _user) external {
        require(msg.sender == address(liquidityPool), "Not LiquidityPool");
        uint256 claimable = earned(_user);
        rewardDebt[_user] = (liquidityPool.shares(_user) * accFeePerShare) / 1e18;
        rewards[_user] = claimable;
        if (claimable > 0) {
            emit RewardUpdated(_user, claimable);
        }
    }

    /// @notice Called by LiquidityPool AFTER a new deposit to correctly set the initial debt for the new share amount.
    function updateDebt(address _user) external {
        require(msg.sender == address(liquidityPool), "Not LiquidityPool");
        rewardDebt[_user] = (liquidityPool.shares(_user) * accFeePerShare) / 1e18;
    }


    /// @notice Claim pro-rata share of fees
    function claim() external {
        // First, update rewards to capture any fees accrued since the last interaction
        uint256 claimableAmount = earned(msg.sender);
        rewardDebt[msg.sender] = (liquidityPool.shares(msg.sender) * accFeePerShare) / 1e18;
        rewards[msg.sender] = claimableAmount;
        require(claimableAmount > 0, "Nothing to claim");
        if (claimableAmount > 0) {
            emit RewardUpdated(msg.sender, claimableAmount);
        }

        rewards[msg.sender] = 0;
        claimableFees -= claimableAmount;
        asset.safeTransfer(msg.sender, claimableAmount);
        emit FeeClaimed(msg.sender, claimableAmount);
    }

    /// @notice Treasury withdrawal of its accumulated share
    function withdrawTreasury(uint256 amount) external {
        require(msg.sender == treasury, "Forbidden");
        asset.safeTransfer(treasury, amount);
    }

    function feeBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}