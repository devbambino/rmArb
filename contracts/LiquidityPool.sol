// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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
    
    // Simplified accounting: totalBalances is now totalAssets()
    uint256 public totalBorrowed; // in asset tokens
    uint256 public totalRepaid;   // in asset tokens
    
    // Oracle and a Swapper needed for this in production
    // For now, manager can handle it
    address public swapper; 
    
    // Removed lock-in period for better UX. Can be added back with more robust logic if needed.
    uint256 public loanTermUnit = 2628000; // 1 month in seconds (for reference)

    mapping(address => uint256) public shares;

    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 amount, uint256 sharesBurned);
    event SwappedCollateral(uint256 collateralIn, uint256 assetOut);

    constructor(address _usdc, address _token) {
        usdc = IERC20Decimals(_usdc);
        asset = IERC20Decimals(_token);
    }
    
    function setup(address _manager, address _feePool, address _swapper, uint256 _loanTermUnit) public onlyOwner {
        manager = _manager;
        feePool = IFeePool(_feePool);
        swapper = _swapper;
        loanTermUnit = _loanTermUnit;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "LP: Not manager");
        _;
    }

    /// @notice Returns the total amount of the underlying asset managed by the pool.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }
    
    /// @notice Deposit tokens and receive shares
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "LP: Zero deposit");

        // IMPORTANT: Update rewards BEFORE changing share balance
        feePool.beforeShareTransfer(msg.sender);

        uint256 _totalAssets = totalAssets();
        uint256 _totalShares = totalShares;
        uint256 _shares;

        if (_totalShares == 0 || _totalAssets == 0) {
            _shares = amount; // First deposit: 1 token = 1 share
        } else {
            // Subsequent deposits: shares are proportional to pool value
            _shares = (amount * _totalShares) / _totalAssets;
        }
        
        require(_shares > 0, "LP: Amount too small for a share");

        shares[msg.sender] += _shares;
        totalShares += _shares;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount, _shares);
    }

    /// @notice Withdraw assets by burning shares
    function withdraw(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "LP: Zero shares");
        uint256 userShares = shares[msg.sender];
        require(shareAmount <= userShares, "LP: Insufficient shares");

        // IMPORTANT: Update rewards BEFORE changing share balance
        feePool.beforeShareTransfer(msg.sender);
        
        uint256 _totalAssets = totalAssets();
        uint256 _totalShares = totalShares;

        // Calculate amount to withdraw based on share value
        uint256 amountToWithdraw = (shareAmount * _totalAssets) / _totalShares;
        require(amountToWithdraw <= _totalAssets, "LP: Not enough liquidity");
        
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;

        asset.safeTransfer(msg.sender, amountToWithdraw);
        emit Withdraw(msg.sender, amountToWithdraw, shareAmount);
    }
    
    /// --- Functions Called by Manager ---

    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external onlyManager {
        require(principalAmount > 0, "LP: Zero principal");
        require(totalAssets() >= principalAmount, "LP: Not enough liquidity");

        asset.safeTransfer(merchant, principalAmount - fee);
        asset.safeTransfer(manager, fee); // Send fee to Manager, which routes it to FeePool
        totalBorrowed += principalAmount;
    }

    function collect(address user, uint256 paymentAmount) external onlyManager {
        // Manager ensures user has approved this contract to spend 'asset'
        asset.safeTransferFrom(user, address(this), paymentAmount);
        totalRepaid += paymentAmount;
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