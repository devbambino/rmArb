// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";

interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}

// FeePool interface to call the reward hook
interface IFeePool {
    function beforeShareTransfer(address user) external;
}

contract LiquidityPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Decimals;

    address public manager;
    IFeePool public feePool;
    // Removed loanPool dependency, manager is enough
    
    IERC20Decimals public immutable usdc; // For receiving seized collateral
    IERC20Decimals public immutable asset;   // e.g., MXNb - the single asset of this pool
    
    uint256 public totalShares;
    
    // FIX: These two variables are now crucial for calculating the true pool value.
    uint256 public totalDisbursed; // Total asset tokens loaned out
    uint256 public totalCollected; // Total asset tokens repaid or seized
    
    // Oracle and a Swapper needed for this in production
    // For now, manager can handle it
    address public swapper; 

    mapping(address => uint256) public shares;

    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 amount, uint256 sharesBurned);
    event Disburse(address indexed user, uint256 principal);
    event Collect(address indexed user, uint256 paymentAmount);
    event SwappedCollateral(uint256 collateralIn, uint256 assetOut);

    constructor(address _usdc, address _token) {
        usdc = IERC20Decimals(_usdc);
        asset = IERC20Decimals(_token);
    }
    
    function setup(address _manager, address _feePool, address _swapper) public onlyOwner {
        manager = _manager;
        feePool = IFeePool(_feePool);
        swapper = _swapper;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "LP: Not manager");
        _;
    }

    /// @notice The total value of the pool, including assets currently on loan.
    function totalAssets() public view returns (uint256) {
        // True value = liquid assets + loaned assets
        return asset.balanceOf(address(this)) + (totalDisbursed - totalCollected);
    }
    
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "LP: Zero deposit");
        feePool.beforeShareTransfer(msg.sender);

        // FIX: The share calculation now uses the true total value of the pool.
        uint256 _totalAssets = totalAssets();
        uint256 _totalShares = totalShares;
        uint256 _shares;

        if (_totalShares == 0 || _totalAssets == 0) {
            _shares = amount;
        } else {
            _shares = (amount * _totalShares) / _totalAssets;
        }
        
        require(_shares > 0, "LP: Amount too small for a share");

        shares[msg.sender] += _shares;
        totalShares += _shares;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount, _shares);
    }

    function withdraw(uint256 shareAmount) external nonReentrant {
        uint256 userShares = shares[msg.sender];
        require(shareAmount > 0 && shareAmount <= userShares, "LP: Invalid or insufficient shares");

        feePool.beforeShareTransfer(msg.sender);
        
        // FIX: Calculate the entitled amount based on the pool's true total value.
        uint256 amountToWithdraw = (shareAmount * totalAssets()) / totalShares;
        
        // FIX: CRITICAL CHECK - ensure there are enough liquid assets to fulfill the withdrawal.
        // If not, the tx reverts, but the user's shares are safe and still hold their full value.
        // They can try again when utilization is lower.
        require(asset.balanceOf(address(this)) >= amountToWithdraw, "LP: Not enough liquid assets available");
        
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        asset.safeTransfer(msg.sender, amountToWithdraw);
        emit Withdraw(msg.sender, amountToWithdraw, shareAmount);
    }
    
    /// --- Functions Called by Manager ---

    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external onlyManager {
        require(asset.balanceOf(address(this)) >= principalAmount, "LP: Not enough liquidity");

        asset.safeTransfer(merchant, principalAmount - fee);
        asset.safeTransfer(manager, fee);
        
        // FIX: Track total disbursed amount.
        totalDisbursed += principalAmount;
        emit Disburse(user, principalAmount);
    }


    function collect(address user, uint256 paymentAmount) external onlyManager {
        asset.safeTransferFrom(user, address(this), paymentAmount);
        // FIX: Track total collected amount.
        totalCollected += paymentAmount;
        emit Collect(user, paymentAmount);
    }

    function receiveSeizedCollateral(address user, uint256 seizedCollateral) external onlyManager {
        // The manager transfers seized USDC here.
        // It's best practice to swap it for the pool's native `asset` immediately.
        // This keeps the pool's value logic simple (based on one asset only).
        // For production, this requires an integrated swapper (e.g., Uniswap Router).
        
        // This is a placeholder for the swap logic
        // require(msg.sender == swapper, "LP: Not swapper");
        // uint256 assetGained = IUniswap(swapper).swap(seizedCollateral, usdc, asset);
        // emit SwappedCollateral(seizedCollateral, assetGained);

        // For now, we'll just hold it. But this complicates `totalAssets` calculation.
        // The best path is to have the manager/a keeper perform the swap.
    }

    function liquidityBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}