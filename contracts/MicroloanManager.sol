// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";

interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}

interface ILiquidityPool {
    function totalWithdrawalRequested() external view returns (uint256);
    function liquidityBalance() external view returns (uint256);
    function collect(address user, uint256 paymentAmount) external;
    function seizeCollateral( address user, uint256 paymentAmount, uint256 seizedInAsset) external;
    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external;
}

interface IFeePool {
    function collectFee(uint256) external;
    function accrueFee(uint256) external;
}

contract MicroloanManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Decimals;

    /*enum LoanTermUnit {
        60,//1 min
        3600,// 1 hour
        86400,// 1 day
        2628000,// 1 month
    }*/

    IERC20Decimals public immutable usdc;
    ILiquidityPool public immutable liquidityPool;
    IFeePool public immutable feePool;
    uint256 public loanTermUnit = 2628000;// in secs, by default 1 month 
    uint256 public totalCollateral;
    mapping(address => uint256) public collateral;

    struct Loan {
        uint256 collateral;    // USDC locked
        uint256 principal;     // asset lent
        uint256 fee;     // total fee
        uint256 startTime;
        uint256 term;          // in seconds
        uint256 termInPeriods;          // 1 to 6
        uint256 pendingPayments;          // 6 to 0, in periods
        uint256 paid;          // amount repaid
        uint256 liquidated; // # of liquidations
        bool    active;
    }

    mapping(address => Loan) public loans;

    event LoanOpened(address indexed user, uint256 collateral, uint256 principal, uint256 termInPeriods);
    event Repaid(address indexed user, uint256 amount, uint256 pendingPayments);
    event Liquidated(address indexed user, uint256 seizedCollateral, uint256 returnedCollateral);
    event CollateralWithdrawed(address indexed user, uint256 collateralAmount);

    constructor(
        address _usdc,
        address _liquidityPool,
        address _feePool,
        uint256 _loanTermUnit
    ) {
        usdc = IERC20Decimals(_usdc);
        liquidityPool = ILiquidityPool(_liquidityPool);
        feePool = IFeePool(_feePool);
        loanTermUnit = _loanTermUnit;//in secs
    }

    function changeTermUnit(uint256 _loanTermUnit) public onlyOwner {
        loanTermUnit = _loanTermUnit;//in secs
    }

    /// @notice Open a single loan per user
    function openLoan(uint256 collateralAmount, uint256 productPrice, uint256 termInPeriods, address merchant) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(!loan.active, "User has existing loan");
        require(usdc.balanceOf(msg.sender) >= collateralAmount, "User has not enough collateral");
        require(collateralAmount > 0 && termInPeriods > 0, "Invalid params");
        //uint256 _totalAssets = liquidityPool.liquidityBalance();
        require(liquidityPool.liquidityBalance() >= liquidityPool.totalWithdrawalRequested() + productPrice, "Not enough liquidity in the lending pool");

        // transfer collateral from user to this SC
        //PENDING APPROVAL_FRONTEND
        usdc.safeTransferFrom(msg.sender, address(this), collateralAmount);
        collateral[msg.sender] += collateralAmount;
        totalCollateral += collateralAmount;

        uint256 fee = productPrice * termInPeriods / 100;

        //Disburse and transfer principal: Pay the merchant directly, minus fee, and move fee to FeePool
        liquidityPool.disburse(msg.sender, merchant, productPrice, fee);
        feePool.collectFee(fee);

        //Loan terms
        loan.collateral = collateralAmount;
        loan.principal = productPrice;
        loan.startTime = block.timestamp;
        loan.term = termInPeriods * loanTermUnit;// in seconds
        loan.termInPeriods = termInPeriods;
        loan.fee = fee;
        loan.pendingPayments = termInPeriods;
        loan.active = true;
        loan.paid = 0;

        emit LoanOpened(msg.sender, collateralAmount, productPrice, termInPeriods);
    }

    /// @notice Repay a portion or full loan
    function repay(uint256 paymentAmount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.active, "No active loan");
        require(paymentAmount >= ((loan.principal - loan.paid) / loan.pendingPayments), "Minimun payment is higher");

        // accrue fee to be claimable
        feePool.accrueFee(loan.fee * paymentAmount / loan.principal);

        // apply payment and return assets to LiquidityPool
        liquidityPool.collect(msg.sender, paymentAmount);
        loan.paid += paymentAmount;
        loan.pendingPayments -= 1;

        // if fully repaid
        if (loan.paid >= loan.principal) {
            // return collateral
            usdc.safeTransfer(msg.sender, loan.collateral);
            collateral[msg.sender] = 0;
            totalCollateral -= loan.collateral;
            loan.active = false;
            loan.pendingPayments = 0;
        }
        emit Repaid(msg.sender, paymentAmount, loan.pendingPayments);
    }

    /// @notice Liquidate overdue loans, usdInAsset is 1 usd coverted to the asset currency x 1000
    function liquidate(address user, uint256 usdInAsset) external onlyOwner nonReentrant {
        Loan storage loan = loans[user];
        require(loan.active, "No active loan");
        require(block.timestamp > loan.startTime + loan.term, "Not overdue");

        // seize collateral
        uint256 seizedInAsset = loan.principal - loan.paid;
        uint256 seized = seizedInAsset /(usdInAsset/1000);//in usd
        // accrue fee to be claimable
        feePool.accrueFee(loan.fee * seizedInAsset / loan.principal);
        // transfer collateral to liquidity pool
        usdc.safeTransfer(address(liquidityPool), seized);
        collateral[user] -= seized;
        totalCollateral -= seized;
        liquidityPool.seizeCollateral(user, seized, seizedInAsset);
        
        // return collateral
        uint256 toBeReturned = loan.collateral - seized;
        if(toBeReturned > 0){
            usdc.safeTransfer(user, toBeReturned);
            collateral[user] -= toBeReturned;
            totalCollateral -= toBeReturned;
        }
        loan.active = false;
        loan.pendingPayments = 0;
        loan.liquidated += 1;

        emit Liquidated(user, seized, toBeReturned);
    }

    function withdrawCollateral() external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(!loan.active, "Active loan");
        uint256 collateralAmount = collateral[msg.sender];
        require(collateralAmount > 0, "User has no collateral deposited");

        usdc.safeTransfer(msg.sender, collateralAmount);
        collateral[msg.sender] = 0;
        totalCollateral -= collateralAmount;
        emit CollateralWithdrawed(msg.sender, collateralAmount);
    }

    function getCurrentTimestamp() external view returns (uint256) {
        return block.timestamp;
    }

    function debtBalance(address user) external view returns (uint256) {
        Loan storage loan = loans[user];
        if (!loan.active) return 0;
        return loan.principal - loan.paid;
    }

    function debtBalanceDue(address user) external view returns (uint256) {
        Loan storage loan = loans[user];
        require(loan.active, "No active loan");
        require(block.timestamp > loan.startTime + loan.term, "Not overdue");
        return loan.principal - loan.paid;
    }
    function collateralBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
