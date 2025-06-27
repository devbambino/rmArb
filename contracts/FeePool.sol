// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/access/Ownable.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.7.3/token/ERC20/utils/SafeERC20.sol";


interface ILiquidityPool {
    function totalShares() external view returns (uint256);
    function loanTermUnit() external view returns (uint256);
    function shares(address user) external view returns (uint256);
    function balancesTimestamp(address user) external view returns (uint256);
}

contract FeePool is Ownable {
    using SafeERC20 for IERC20;

    address public manager;
    IERC20 public immutable asset;       // fee token, e.g., TestMXNe
    ILiquidityPool public immutable liquidityPool;
    address public treasury;

    uint256 public treasuryRate = 10;//10% of all claimable fees
    uint256 public totalFees;
    uint256 public claimableFees;
    uint256 public claimTerm;// Enable claims every claimTerm period, in secs
    mapping(address => uint256) public claimed;// yield withdrawed by lender

    event FeeCollected(uint256 amount);
    event FeeAccrued(uint256 amount);
    event FeeTransferredTreasury(uint256 amount);
    event FeeClaimed(address indexed user, uint256 amount);

    constructor(address _token, address _liquidityPool, address _treasury) {
        asset = IERC20(_token);
        liquidityPool = ILiquidityPool(_liquidityPool);
        claimTerm = liquidityPool.loanTermUnit() * 1;
        treasury = _treasury;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    function setupManagement(address _newManager) public onlyOwner {
        manager = _newManager;
        claimTerm = liquidityPool.loanTermUnit() * 1;
    }

    /// @notice Collect loan fees from customer's purchase payment
    function collectFee(uint256 amount) external onlyManager  {
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
        emit FeeTransferredTreasury(accruedFee);
        //totalFees -= treasuryCut;
        uint256 userAmount = accruedFee - treasuryCut;
        claimableFees += userAmount;
        emit FeeAccrued(accruedFee);
    }

    /// @notice Claim pro-rata share of fees
    function claim() external {
        uint256 userShares = liquidityPool.shares(msg.sender);
        uint256 totalShares = liquidityPool.totalShares();
        require(userShares > 0 && totalShares > 0, "No shares");

        uint256 userBalanceTimestamp = liquidityPool.balancesTimestamp(msg.sender);
        require(block.timestamp - userBalanceTimestamp > claimTerm, "Claims are not allowed yet");

        uint256 entitled = (claimableFees * userShares) / totalShares;
        uint256 claimable = entitled - claimed[msg.sender];
        require(claimable > 0, "Nothing to claim");

        asset.safeTransfer(msg.sender, claimable);
        claimed[msg.sender] += claimable;
        emit FeeClaimed(msg.sender, claimable);
    }

    /// @notice Treasury withdrawal of its accumulated share
    function withdrawTreasury(uint256 amount) external onlyOwner{
        require(msg.sender == treasury, "Forbidden");
        asset.safeTransfer(treasury, amount);
    }

    function feeBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
