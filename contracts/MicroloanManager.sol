// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";


// --- FOR PRODUCTION ---
// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}

// Updated interface to reflect changes in LiquidityPool
interface ILiquidityPool {
    function liquidityBalance() external view returns (uint256);
    function collect(address user, uint256 paymentAmount) external;
    function seizeCollateral(address user, uint256 paymentAmount, uint256 seizedInAsset) external;
    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external;
}

interface IFeePool {
    function collectFee(uint256) external;
    function accrueFee(uint256) external;
}

contract MicroloanManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Decimals;

    IERC20Decimals public immutable usdc;
    ILiquidityPool public liquidityPool;
    IFeePool public feePool;
    uint256 public loanTermUnit = 2628000; // in secs, by default 1 month
    /*enum LoanTermUnit {
        60,//1 min
        3600,// 1 hour
        86400,// 1 day
        2628000,// 1 month
    }*/
    //fee rate in Basis Points (100 bps = 1%)
    uint256 public feeRateBps = 100; // Default to 1% per period
    uint256 public totalCollateral;
    mapping(address => uint256) public collateral;

    // --- FOR PRODUCTION: USE CHAINLINK or equivalent ---
    // AggregatorV3Interface internal priceFeed; // e.g., MXN/USD
    // For testing, we'll keep it simple
    // --- PRICE ORACLE CONFIGURATION ---
    // This defines the number of decimals for the price oracle's answer.
    // We use 18 for high precision, a common standard for price feeds.
    uint256 public constant PRICE_PRECISION = 1e18;
    // For testing: The price of 1 full unit of 'asset' (MXNb) in 'collateral' (USDC).
    // Stored with 18 decimals of precision.
    // Example: If 1 MXNb = $0.05 USDC, this value would be 0.05 * 1e18 = 5 * 10^16.
    uint256 public assetPriceInUsd;

    struct Loan {
        uint256 collateral;    // USDC locked
        uint256 principal;     // asset lent
        uint256 fee;           // total fee
        uint256 startTime;
        uint256 term;          // in seconds
        uint256 termInPeriods; // 1 to 6
        uint256 pendingPayments; // 6 to 0, in periods
        uint256 paid;          // amount repaid
        uint256 liquidated;    // # of liquidations
        bool    active;
    }

    mapping(address => Loan) public loans;

    event LoanOpened(address indexed user, uint256 collateral, uint256 principal, uint256 termInPeriods);
    event Repaid(address indexed user, uint256 amount, uint256 pendingPayments);
    event Liquidated(address indexed user, uint256 seizedCollateral, uint256 returnedCollateral);
    event CollateralWithdrawed(address indexed user, uint256 collateralAmount);
    event FeeRateChanged(uint256 newRateBps);

    constructor(
        address _usdc,
        address _liquidityPool,
        address _feePool,
        uint256 _loanTermUnit,
        uint256 _initialAssetPrice // For testing, e.g., 5 * 10^16 for $0.05
    ) {
        usdc = IERC20Decimals(_usdc);
        liquidityPool = ILiquidityPool(_liquidityPool);
        feePool = IFeePool(_feePool);
        loanTermUnit = _loanTermUnit;
        assetPriceInUsd = _initialAssetPrice;
        // In production: priceFeed = AggregatorV3Interface(chainlinkFeedAddress);
    }

    function setupContracts(address _liquidityPool,address _feePool) public onlyOwner {
        liquidityPool = ILiquidityPool(_liquidityPool);
        feePool = IFeePool(_feePool);
    }

    function changeTermUnit(uint256 _loanTermUnit) public onlyOwner {
        loanTermUnit = _loanTermUnit;
    }

    function setAssetPrice(uint256 _newPrice) public onlyOwner {
        assetPriceInUsd = _newPrice; // For testing only
    }

    // [3.5] Function to update the fee rate
    function setFeeRateBps(uint256 _newFeeRateBps) public onlyOwner {
        feeRateBps = _newFeeRateBps;
        emit FeeRateChanged(_newFeeRateBps);
    }

    function openLoan(uint256 collateralAmount, uint256 productPrice, uint256 termInPeriods, address merchant) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(!loan.active, "User has existing loan");
        require(usdc.balanceOf(msg.sender) >= collateralAmount, "User has not enough collateral");
        require(collateralAmount > 0 && termInPeriods > 0 && termInPeriods <= 6, "Invalid params");
        // [3.4] Simplified liquidity check
        require(liquidityPool.liquidityBalance() >= productPrice, "Not enough liquidity in the lending pool");

        usdc.safeTransferFrom(msg.sender, address(this), collateralAmount);
        collateral[msg.sender] += collateralAmount;
        totalCollateral += collateralAmount;

        // [3.5] Use configurable fee rate for fee calculation
        uint256 fee = (productPrice * termInPeriods * feeRateBps) / 10000;

        liquidityPool.disburse(msg.sender, merchant, productPrice, fee);
        feePool.collectFee(fee);

        loan.collateral = collateralAmount;
        loan.principal = productPrice;
        loan.startTime = block.timestamp;
        loan.term = termInPeriods * loanTermUnit;
        loan.termInPeriods = termInPeriods;
        loan.fee = fee;
        loan.pendingPayments = termInPeriods;
        loan.active = true;
        loan.paid = 0;

        emit LoanOpened(msg.sender, collateralAmount, productPrice, termInPeriods);
    }

    function repay(uint256 paymentAmount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.active, "No active loan");
        uint256 singlePaymentValue = (loan.principal / loan.termInPeriods);
        require(paymentAmount >= singlePaymentValue, "Minimum payment is one installment");

        feePool.accrueFee((loan.fee * paymentAmount) / loan.principal);
        liquidityPool.collect(msg.sender, paymentAmount);

        // [3.6] Improved pendingPayments logic
        uint256 paidBefore = loan.paid;
        loan.paid += paymentAmount;
        
        // Calculate how many full installments were cleared with this payment
        uint256 installmentsCleared = (loan.paid / singlePaymentValue) - (paidBefore / singlePaymentValue);
        if (installmentsCleared > 0) {
            if (loan.pendingPayments >= installmentsCleared) {
                loan.pendingPayments -= installmentsCleared;
            } else {
                loan.pendingPayments = 0;
            }
        }

        if (loan.paid >= loan.principal) {
            require(usdc.balanceOf(address(this)) >= loan.collateral, "Not enough collateral liquidity in loan pool");
            usdc.safeTransfer(msg.sender, loan.collateral);
            collateral[msg.sender] = 0;
            totalCollateral -= loan.collateral;
            loan.active = false;
            loan.pendingPayments = 0;
        }
        emit Repaid(msg.sender, paymentAmount, loan.pendingPayments);
    }

    function liquidate(address user) external onlyOwner nonReentrant {
        Loan storage loan = loans[user];
        require(loan.active, "No active loan");
        require(block.timestamp > loan.startTime + loan.term, "Not overdue");

        // For production, get price from oracle in Arbitrum
        // uint latestPrice = uint(priceFeed.latestRoundData().answer);
        uint256 price = assetPriceInUsd;
        require(price > 0, "MM: Invalid asset price");
        uint256 outstandingDebtInAsset = loan.principal - loan.paid;
        // --- DECIMAL-SENSITIVE CALCULATION ---
        // Converts the debt from a 6-decimal asset to a 6-decimal collateral.
        // Formula: debt_in_collateral = (debt_in_asset * price_with_18_decimals) / 1e18
        // Units: (10^6 units * 10^18 price_units) / 10^18 = 10^6 units.
        uint256 outstandingDebtInUsdc = (outstandingDebtInAsset * price) / PRICE_PRECISION;
        uint256 seizedCollateral = outstandingDebtInUsdc;
        require(loan.collateral >= seizedCollateral, "MM: LTV breach, not enough collateral");
        feePool.accrueFee((loan.fee * outstandingDebtInAsset) / loan.principal);
        // Transfer seized collateral to LiquidityPool to be swapped/managed
        usdc.safeTransfer(address(liquidityPool), seizedCollateral);
        collateral[user] -= seizedCollateral;
        totalCollateral -= seizedCollateral;
        //liquidityPool.receiveSeizedCollateral(user, seizedCollateral);
        liquidityPool.seizeCollateral(user, seizedCollateral, outstandingDebtInAsset);
        // Return remaining collateral to the user
        uint256 returnedCollateral = loan.collateral - seizedCollateral;
        if (returnedCollateral > 0) {
            usdc.safeTransfer(user, returnedCollateral);
            collateral[user] -= returnedCollateral;
            totalCollateral -= returnedCollateral;
        }
        loan.active = false;
        loan.pendingPayments = 0;
        loan.liquidated += 1;
        emit Liquidated(user, seizedCollateral, returnedCollateral);
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
    
    // other view functions...
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