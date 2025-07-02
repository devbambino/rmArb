// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";


// --- FOR PRODUCTION ---
// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface ILiquidityPool {
    function collect(address user, uint256 paymentAmount) external;
    function receiveSeizedCollateral(address user, uint256 seizedAmount) external;
    function disburse(address user, address merchant, uint256 principalAmount, uint256 fee) external;
    function liquidityBalance() external view returns (uint256);
}

interface IFeePool {
    function collectFee(uint256) external;
    function asset() external view returns (address);
}

contract MicroloanManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ILiquidityPool public immutable liquidityPool;
    IFeePool public immutable feePool;

    // --- FOR PRODUCTION: USE CHAINLINK ---
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

    uint256 public loanTermUnit; // in seconds
    /*enum LoanTermUnit {
        60,//1 min
        3600,// 1 hour
        86400,// 1 day
        2628000,// 1 month
    }*/
    mapping(address => Loan) public loans;

    struct Loan {
        uint256 collateral;     // USDC locked
        uint256 principal;      // asset lent
        uint256 fee;            // total fee
        uint256 startTime;
        uint256 term;           // in seconds
        uint8 termInPeriods;
        uint256 pendingPayments;
        uint256 paid;
        bool    active;
    }

    event LoanOpened(address indexed user, uint256 collateral, uint256 principal, uint256 termInPeriods);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, uint256 seizedCollateral, uint256 returnedCollateral);

    constructor(
        address _usdc,
        address _liquidityPool,
        address _feePool,
        uint256 _loanTermUnit,
        uint256 _initialAssetPrice // For testing, e.g., 5 * 10^16 for $0.05
    ) {
        usdc = IERC20(_usdc);
        liquidityPool = ILiquidityPool(_liquidityPool);
        feePool = IFeePool(_feePool);
        loanTermUnit = _loanTermUnit;
        assetPriceInUsd = _initialAssetPrice;
        // In production: priceFeed = AggregatorV3Interface(chainlinkFeedAddress);
    }

    function setLoanTermUnit(uint256 _loanTermUnit) public onlyOwner {
        loanTermUnit = _loanTermUnit;
    }

    function setAssetPrice(uint256 _newPrice) public onlyOwner {
        assetPriceInUsd = _newPrice; // For testing only
    }

    function openLoan(uint256 collateralAmount, uint256 productPrice, uint256 termInPeriods, address merchant) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(!loan.active, "MM: User has existing loan");
        require(usdc.balanceOf(msg.sender) >= collateralAmount, "MM: Not enough collateral");
        require(productPrice > 0 && termInPeriods > 0, "MM: Invalid params");
        require(liquidityPool.liquidityBalance() >= productPrice, "MM: Not enough liquidity");

        // Transfer collateral
        usdc.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Calculate fee (e.g., 1% per period)
        uint256 fee = (productPrice * termInPeriods) / 100;
        
        // Disburse from LP
        liquidityPool.disburse(msg.sender, merchant, productPrice, fee);
        
        // This contract receives the fee and forwards it to the FeePool
        IERC20(feePool.asset()).safeTransfer(address(feePool), fee);
        feePool.collectFee(fee); // Notify FeePool of the collection for accounting

        // Set up loan struct
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
        require(loan.active, "MM: No active loan");
        
        // Safe check for minimum payment
        uint256 minPayment = 0;
        if (loan.pendingPayments > 0) {
            minPayment = (loan.principal - loan.paid) / loan.pendingPayments;
        }
        require(paymentAmount >= minPayment, "MM: Minimum payment not met");

        // Collect payment into the LiquidityPool
        liquidityPool.collect(msg.sender, paymentAmount);
        loan.paid += paymentAmount;
        if (loan.pendingPayments > 0) loan.pendingPayments--;

        if (loan.paid >= loan.principal) {
            // Fully repaid: return all collateral
            usdc.safeTransfer(msg.sender, loan.collateral);
            loan.pendingPayments = 0;
            loan.active = false;
        }
        emit Repaid(msg.sender, paymentAmount);
    }

    function liquidate(address user) external nonReentrant {
        Loan storage loan = loans[user];
        require(loan.active, "MM: No active loan");
        require(block.timestamp > loan.startTime + loan.term, "MM: Not overdue");
        
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

        // Transfer seized collateral to LiquidityPool to be swapped/managed
        usdc.safeTransfer(address(liquidityPool), seizedCollateral);
        liquidityPool.receiveSeizedCollateral(user, seizedCollateral);

        // Return remaining collateral to the user
        uint256 returnedCollateral = loan.collateral - seizedCollateral;
        if (returnedCollateral > 0) {
            usdc.safeTransfer(user, returnedCollateral);
        }

        loan.active = false;
        emit Liquidated(user, seizedCollateral, returnedCollateral);
    }

    function getLoan(address user) external view returns (Loan memory) {
        return loans[user];
    }
}