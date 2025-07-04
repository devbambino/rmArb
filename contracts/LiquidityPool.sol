// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";

interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}

interface IMicroloanManager {
    function loanTermUnit() external view returns (uint256);
}

// [1.5] New interface for FeePool interaction
interface IFeePool {
    function updateReward(address user) external;
}

contract LiquidityPool is Ownable {
    using SafeERC20 for IERC20Decimals;

    address public manager;
    address public feePool;
    IMicroloanManager public loanPool;
    IERC20Decimals public immutable usdc;
    IERC20Decimals public immutable asset;   // e.g., MXNb
    uint256 public totalShares;
    uint256 public totalBorrowed;
    uint256 public totalRepaid;
    uint256 public totalSeizedCollateral;
    uint256 public totalSeizedCollateralInAsset;
    uint256 public lockedInPeriod;
    uint256 public loanTermUnit = 2628000; // in secs, by default 1 month
    // Oracle and a Swapper needed for this in production
    // For now, manager can handle it
    address public swapper;
    mapping(address => uint256) public shares; // shares per lender
    mapping(address => uint256) public balancesTimestamp; // deposits timestamp per lender in secs
    mapping(address => uint256) public borrowed; // who borrow and how much
    mapping(address => uint256) public repaid; // who repaid and how much

    event Collect(address indexed user, uint256 paymentAmount);
    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Disburse(address indexed user, uint256 principal);
    event ResetBalance(address indexed user);
    event SeizeCollateral(address indexed user, uint256 seized, uint256 seizedInAsset);
    event Withdraw(address indexed user, uint256 sharesBurned);
    event WithdrawInCollateral(address indexed user, uint256 withdrawalCollateral, uint256 withdrawalCollateralInAsset);
    event WithdrawAll(uint256 sharesBurned);

    constructor(address _usdc, address _token) {
        usdc = IERC20Decimals(_usdc);
        asset = IERC20Decimals(_token);
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    function setupManagement(address _loanPool, address _feePool, address _swapper) public onlyOwner {
        loanPool = IMicroloanManager(_loanPool);
        feePool = _feePool;
        manager = _loanPool;
        loanTermUnit = loanPool.loanTermUnit();
        lockedInPeriod = loanTermUnit * 6;
        swapper = _swapper;
    }

    function changeTermUnit() public onlyOwner {
        loanTermUnit = loanPool.loanTermUnit();
        lockedInPeriod = loanTermUnit * 6;
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Zero amount to be deposited");
        
        //Update rewards in FeePool BEFORE shares change
        if (feePool != address(0)) {
            IFeePool(feePool).updateReward(msg.sender);
        }

        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 _shares = amount; // 1:1 share minting
        totalShares += _shares;
        shares[msg.sender] += _shares;
        
        // Set timestamp only on first deposit
        if (balancesTimestamp[msg.sender] == 0) {
            balancesTimestamp[msg.sender] = block.timestamp;
        }

        emit Deposit(msg.sender, amount, _shares);
    }

    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external onlyManager {
        require(principalAmount > 0, "Zero amount");
        uint256 _totalAssets = asset.balanceOf(address(this));
        require(_totalAssets >= principalAmount, "Not enough liquidity in the lending pool");

        asset.safeTransfer(merchant, principalAmount - fee);
        asset.safeTransfer(feePool, fee);
        totalBorrowed += principalAmount;
        borrowed[user] += principalAmount;
        emit Disburse(user, principalAmount);
    }

    function collect(address user, uint256 paymentAmount) external onlyManager {
        require(paymentAmount > 0, "Zero amount");
        asset.safeTransferFrom(user, address(this), paymentAmount);
        totalRepaid += paymentAmount;
        repaid[user] += paymentAmount;
        emit Collect(user, paymentAmount);
    }

    function seizeCollateral(address user, uint256 seized, uint256 seizedInAsset) external onlyManager {
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
        
        totalSeizedCollateral += seized;
        totalSeizedCollateralInAsset += seizedInAsset;
        totalRepaid += seizedInAsset;
        repaid[user] += seizedInAsset;
        emit SeizeCollateral(user, seized, seizedInAsset);
    }

    function withdraw() external {
        uint256 shareAmount = shares[msg.sender];
        require(shareAmount > 0, "Invalid shares");
        //require(block.timestamp - balancesTimestamp[msg.sender] > lockedInPeriod, "Withdraws are not allowed yet");

        //Update rewards in FeePool BEFORE shares change
        if (feePool != address(0)) {
            IFeePool(feePool).updateReward(msg.sender);
        }

        //Simplified liquidity check
        uint256 _assetsAvailable = asset.balanceOf(address(this));
        require(shareAmount <= _assetsAvailable + totalSeizedCollateralInAsset, "Not enough liquidity");

        uint256 withdrawalAmount = shareAmount;
        if (shareAmount > _assetsAvailable) {
            withdrawalAmount = _assetsAvailable;
            uint256 withdrawalCollateralInAsset = shareAmount - withdrawalAmount;
            //Corrected order of operations to prevent precision loss
            uint256 withdrawalCollateral = (withdrawalCollateralInAsset * totalSeizedCollateral) / totalSeizedCollateralInAsset;
            usdc.safeTransfer(msg.sender, withdrawalCollateral);
            totalSeizedCollateral -= withdrawalCollateral;
            totalSeizedCollateralInAsset -= withdrawalCollateralInAsset;
            emit WithdrawInCollateral(msg.sender, withdrawalCollateral, withdrawalCollateralInAsset);
        }
        
        asset.safeTransfer(msg.sender, withdrawalAmount);
        totalShares -= shareAmount;
        shares[msg.sender] = 0;
        balancesTimestamp[msg.sender] = 0; // Reset timestamp
        
        emit Withdraw(msg.sender, shareAmount);
    }

    function withdrawAll() external onlyOwner {
        uint256 _totalAssets = asset.balanceOf(address(this));
        asset.safeTransfer(owner(), _totalAssets);
        totalShares = 0;
        emit WithdrawAll(_totalAssets);
    }

    function resetBalance() external {
        if (totalShares == 0) {
            shares[msg.sender] = 0;
            emit ResetBalance(msg.sender);
        }
    }

    function debtBalance() external view returns (uint256) {
        return totalBorrowed - totalRepaid;
    }

    function debtCheck() external view returns (uint256) {
        // [3.2] Updated to use totalShares
        return (totalBorrowed - totalRepaid) - (totalShares - asset.balanceOf(address(this)));
    }

    function utilizationRate() external view returns (uint256) {
        if (totalShares == 0) return 0;
        // [3.2] Updated to use totalShares
        return (100 * (totalShares - asset.balanceOf(address(this)))) / totalShares;
    }

    function balanceOf(address user) external view returns (uint256) {
        // [3.2] Simplified to return shares directly
        return shares[user];
    }

    function collateralBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function liquidityBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}