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
    uint256 public totalFees;
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
        totalFees += amount;
        emit FeeCollected(amount);
    }

    /// @notice Release loan fees for lender claims
    function accrueFee(uint256 accruedFee) external onlyManager {
        require(accruedFee > 0, "Zero accruedFee");
        // compute treasury cut
        uint256 treasuryCut = (accruedFee * treasuryRate) / 100;
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
    /// @param _user The address of the user.
    /// @return The amount of rewards earned.
    function earned(address _user) public view returns (uint256) {
        uint256 userShares = liquidityPool.shares(_user);
        return (userShares * accFeePerShare) / 1e18 - rewardDebt[_user] + rewards[_user];
    }

    /// @notice Updates a user's reward balance.
    /// This function should be called by the LiquidityPool before a user's shares change.
    function updateReward(address _user) external {
        require(msg.sender == address(liquidityPool), "Not LiquidityPool");
        uint256 userShares = liquidityPool.shares(_user);
        uint256 pending = (userShares * accFeePerShare) / 1e18 - rewardDebt[_user];
        if (pending > 0) {
            rewards[_user] += pending;
            emit RewardUpdated(_user, rewards[_user]);
        }
        rewardDebt[_user] = (userShares * accFeePerShare) / 1e18;
    }


    /// @notice Claim pro-rata share of fees
    // [1.1] Overhauled claim logic
    function claim() external {
        // First, update rewards to capture any fees accrued since the last interaction
        uint256 userShares = liquidityPool.shares(msg.sender);
        uint256 pending = (userShares * accFeePerShare) / 1e18 - rewardDebt[msg.sender];
        if (pending > 0) {
            rewards[msg.sender] += pending;
        }
        rewardDebt[msg.sender] = (userShares * accFeePerShare) / 1e18;

        uint256 claimable = rewards[msg.sender];
        require(claimable > 0, "Nothing to claim");

        rewards[msg.sender] = 0;
        claimableFees -= claimable;

        asset.safeTransfer(msg.sender, claimable);
        emit FeeClaimed(msg.sender, claimable);
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