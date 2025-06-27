// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";


interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}

interface IMicroloanManager {
    function loanTermUnit() external view returns (uint256);
}

contract LiquidityPool is Ownable {
    using SafeERC20 for IERC20Decimals;

    address public manager;
    address public feePool;
    IMicroloanManager public loanPool;
    IERC20Decimals public immutable usdc;
    IERC20Decimals public immutable asset;   // e.g., MXNe or BRZ
    uint256 public totalShares;
    uint256 public totalWithdrawalRequested;// in tokens
    uint256 public totalBalances;// in tokens
    uint256 public totalBorrowed;// in tokens
    uint256 public totalRepaid;// in tokens
    uint256 public totalSeizedCollateral;// in tokens
    uint256 public totalSeizedCollateralInAsset;// in tokens
    //uint256 public claimTerm;// Enable claims every claimTerm period, in secs
    uint256 public lockedInPeriod;// No withdrawal allowed until lockedInPeriod is reached, in secs
    uint256 public loanTermUnit = 2628000;// in secs, by default 1 month 
    mapping(address => uint256) public shares;// shares per lender
    mapping(address => uint256) public withdrawalRequested;// deposits made per lender
    mapping(address => uint256) public balances;// deposits made per lender
    mapping(address => uint256) public balancesTimestamp;// deposits timestamp per lender in secs
    mapping(address => uint256) public borrowed;// who borrow and how much
    mapping(address => uint256) public repaid;// who repaid and how much

    event Collect(address indexed user, uint256 paymentAmount);
    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Disburse(address indexed user, uint256 principal);
    event ResetBalance(address indexed user);
    event SeizeCollateral(address indexed user, uint256 seized, uint256 seizedInAsset);
    event Withdraw(address indexed user, uint256 sharesBurned);
    event WithdrawInCollateral(address indexed user, uint256 withdrawalCollateral, uint256 withdrawalCollateralInAsset);
    event WithdrawAll( uint256 sharesBurned);
    event WithdrawalRequested(address indexed user, uint256 shareAmount);
    
    constructor(address _usdc,address _token) {
        usdc = IERC20Decimals(_usdc);
        asset = IERC20Decimals(_token);
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    function setupManagement(address _loanPool, address _feePool ) public onlyOwner {
        loanPool = IMicroloanManager(_loanPool);
        feePool = _feePool;
        manager = _loanPool;
        loanTermUnit = loanPool.loanTermUnit();
        lockedInPeriod = loanTermUnit * 6;
    }

    function changeTermUnit() public onlyOwner {
        loanTermUnit = loanPool.loanTermUnit();
        lockedInPeriod = loanTermUnit * 6;
    }

    /// @notice Deposit tokens and receive shares
    function deposit(uint256 amount) external {
        require(amount > 0, "Zero amount to be deposited");
        require(shares[msg.sender] == 0, "Already deposited");
        uint256 _shares = amount;
        
        //PENDING APPROVAL_FRONTEND
        asset.safeTransferFrom(msg.sender, address(this), amount);
        totalShares += _shares;
        shares[msg.sender] += _shares;
        totalBalances += amount;
        balances[msg.sender] += amount;
        balancesTimestamp[msg.sender] = block.timestamp;

        emit Deposit(msg.sender, amount, _shares);
    }

    /// @notice disburse loaned tokens
    function disburse( address user, address merchant, uint256 principalAmount, uint256 fee) external onlyManager {
        require(principalAmount > 0, "Zero amount");
        uint256 _totalAssets = asset.balanceOf(address(this));
        require(_totalAssets >= principalAmount, "Not enough liquidity in the lending pool");

        asset.safeTransfer(merchant, principalAmount - fee);
        asset.safeTransfer(feePool, fee);
        totalBorrowed += principalAmount;
        borrowed[user] += principalAmount;
        emit Disburse(user, principalAmount);
    }

    /// @notice collect back disbursed tokens from borrower
    function collect( address user, uint256 paymentAmount) external onlyManager {
        require(paymentAmount > 0, "Zero amount");
        require(asset.balanceOf(address(user)) >= paymentAmount, "User has not enough balance in asset");

        //PENDING APPROVAL_FRONTEND
        asset.safeTransferFrom(user, address(this), paymentAmount);
        totalRepaid += paymentAmount;
        repaid[user] += paymentAmount;
        emit Collect(user, paymentAmount);
    }

    function seizeCollateral( address user, uint256 seized, uint256 seizedInAsset) external onlyManager {
        totalSeizedCollateral += seized;
        totalSeizedCollateralInAsset += seizedInAsset;
        totalRepaid += seizedInAsset;
        repaid[user] += seizedInAsset;
        emit SeizeCollateral(user, seized, seizedInAsset);
    }

    /// @notice Withdraw assets by burning shares
    function withdraw() external {
        uint256 shareAmount = shares[msg.sender];
        require(shareAmount > 0, "Invalid shares");
        require(block.timestamp - balancesTimestamp[msg.sender] > lockedInPeriod, "Withdraws are not allowed yet");

        uint256 _assetsAvailable = asset.balanceOf(address(this));
        if(shareAmount >  _assetsAvailable + totalSeizedCollateralInAsset && withdrawalRequested[msg.sender] == 0){
            totalWithdrawalRequested += shareAmount;
            withdrawalRequested[msg.sender] = shareAmount;
            emit WithdrawalRequested(msg.sender, shareAmount);
        }
        require(shareAmount <= _assetsAvailable + totalSeizedCollateralInAsset, "Not enough liquidity");

        uint256 withdrawalAmount = shareAmount;
        if(shareAmount > _assetsAvailable){
            withdrawalAmount = _assetsAvailable;
            uint256 withdrawalCollateralInAsset = shareAmount - withdrawalAmount;//amount of withdrawal collateral in asset units
            uint256 withdrawalCollateral = (withdrawalCollateralInAsset/totalSeizedCollateralInAsset) * totalSeizedCollateral;
            usdc.safeTransfer(msg.sender, withdrawalCollateral);
            totalSeizedCollateral -= withdrawalCollateral;
            totalSeizedCollateralInAsset -= withdrawalCollateralInAsset;
            emit WithdrawInCollateral(msg.sender, withdrawalCollateral, withdrawalCollateralInAsset);
        }
        
        asset.safeTransfer(msg.sender, withdrawalAmount);
        totalShares -= shareAmount;
        shares[msg.sender] = 0;
        totalBalances -= shareAmount;
        balances[msg.sender] = 0;
        if(withdrawalRequested[msg.sender] > 0){
            totalWithdrawalRequested -= shareAmount;
            withdrawalRequested[msg.sender] = 0;
        }
        emit Withdraw(msg.sender, shareAmount);
    }

    function withdrawAll() external onlyOwner {
        uint256 _totalAssets = asset.balanceOf(address(this));

        asset.safeTransfer(owner(), _totalAssets);
        totalShares = 0;
        totalBalances = 0;
        emit WithdrawAll(_totalAssets);
    }

    function resetBalance() external{
        if (totalShares == 0) {
            shares[msg.sender] = 0;
            balances[msg.sender] = 0;
            emit ResetBalance(msg.sender);
        }
    }

    function debtBalance() external view returns (uint256) {
        return totalBorrowed - totalRepaid;
    }

    function debtCheck() external view returns (uint256) {
        return (totalBorrowed - totalRepaid) - (totalBalances - asset.balanceOf(address(this)));
    }

    function utilizationRate() external view returns (uint256) {
        return 100 * 1 - (asset.balanceOf(address(this)) / totalBalances);
    }

    /// @notice Get asset balance corresponding to shares
    function balanceOf(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * asset.balanceOf(address(this))) / totalShares;
    }

    function collateralBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    function liquidityBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
