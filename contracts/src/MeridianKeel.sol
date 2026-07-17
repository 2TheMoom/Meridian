// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MeridianKeel
/// @notice Keel's Hold tier (spec section 6): a user-funded daily spend-cap
///         vault for native MON. One policy type only. Spends within the
///         wallet's own configured cap execute instantly; spends over cap,
///         and any increase to the cap itself, are timelocked 24 hours and
///         cancelable by the user. Emergency withdrawal is always available
///         but delayed 12 hours (drainer resistance).
/// @dev    First draft, not yet audited. Deliberately minimal scope per the
///         product spec ("brutal scope") — MON only, no ERC-20 support yet,
///         no destination allowlist enforcement on-chain (the allowlist
///         pointer is informational metadata, not a spend restriction).
///         The owner never has custody or a path to move user funds; owner
///         powers are limited to pausing new deposits and updating the
///         published allowlist pointer.
///
///         All timelocks compare against `block.timestamp`, which validators
///         can skew by at most a handful of seconds — immaterial against
///         12-24 hour delays and the standard, accepted tradeoff for
///         timelock contracts at this timescale.
contract MeridianKeel {
    uint256 public constant CAP_INCREASE_DELAY = 24 hours;
    uint256 public constant OVER_CAP_SPEND_DELAY = 24 hours;
    uint256 public constant EMERGENCY_WITHDRAWAL_DELAY = 12 hours;
    uint256 public constant SPEND_WINDOW = 1 days;

    struct Vault {
        uint256 balance; // funds available to spend or withdraw now (excludes reserved pending-spend amounts)
        uint256 dailyCap;
        uint256 spentInWindow;
        uint256 windowStart;
    }

    struct PendingCapChange {
        uint256 newCap;
        uint256 unlockTime;
    }

    struct PendingSpend {
        address user;
        address to;
        uint256 amount;
        uint256 unlockTime;
        bool resolved; // executed or cancelled
    }

    struct PendingEmergencyWithdrawal {
        uint256 unlockTime;
        bool requested;
    }

    mapping(address => Vault) public vaults;
    mapping(address => PendingCapChange) public pendingCapChanges;
    mapping(uint256 => PendingSpend) public pendingSpends;
    mapping(address => PendingEmergencyWithdrawal) public pendingEmergencyWithdrawals;
    uint256 public nextSpendId;

    address public owner;
    bool public depositsPaused;
    bytes32 public allowlistPointer; // off-chain reference (e.g. an IPFS hash) to the published allowlist; informational only, never enforced here

    bool private _locked;

    event Deposited(address indexed user, uint256 amount);
    event Spent(address indexed user, address indexed to, uint256 amount);
    event SpendQueued(address indexed user, uint256 indexed id, address to, uint256 amount, uint256 unlockTime);
    event SpendExecuted(address indexed user, uint256 indexed id);
    event SpendCancelled(address indexed user, uint256 indexed id);
    event CapChanged(address indexed user, uint256 newCap);
    event CapIncreaseQueued(address indexed user, uint256 newCap, uint256 unlockTime);
    event CapIncreaseCancelled(address indexed user);
    event EmergencyWithdrawalRequested(address indexed user, uint256 unlockTime);
    event EmergencyWithdrawalExecuted(address indexed user, uint256 amount);
    event EmergencyWithdrawalCancelled(address indexed user);
    event DepositsPausedSet(bool paused);
    event AllowlistPointerSet(bytes32 pointer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier noReentrancy() {
        require(!_locked, "reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---------- Deposits ----------

    function deposit() external payable {
        require(!depositsPaused, "deposits paused");
        require(msg.value > 0, "zero deposit");
        vaults[msg.sender].balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ---------- Daily cap ----------

    /// @notice Decreasing (or first-setting from a lower effective value) is
    ///         instant. Any increase — including a wallet's very first cap,
    ///         since that raises spending power from zero — is timelocked.
    ///         That's deliberate: the timelock is the anti-impulse mechanic
    ///         this whole tier exists for, not just a guard against attackers.
    /// @dev    An instant decrease never touches spentInWindow. If you've
    ///         already spent more this window than your new (lower) cap
    ///         allows, spentInWindow now exceeds dailyCap — spend()'s
    ///         `spentInWindow + amount <= dailyCap` check means every
    ///         further spend() call this window takes the timelocked
    ///         over-cap path, not the instant one, regardless of how small
    ///         the amount is, until the window rolls over. This is
    ///         intentional and safe (found by invariant fuzzing, not by
    ///         inspection — see MeridianKeel.invariant.t.sol and
    ///         test_setDailyCap_decreaseBelowSpentInWindow_forcesQueuedPathForRestOfWindow):
    ///         it can only make remaining spending in the window *more*
    ///         restricted than before, never less. Retroactively clamping
    ///         spentInWindow down to match would be the actual bug — it
    ///         would let a cap decrease silently buy back spending room in
    ///         the same window, undermining the cap it just set.
    function setDailyCap(uint256 newCap) external {
        Vault storage v = vaults[msg.sender];
        if (newCap <= v.dailyCap) {
            v.dailyCap = newCap;
            emit CapChanged(msg.sender, newCap);
        } else {
            uint256 unlockTime = block.timestamp + CAP_INCREASE_DELAY;
            pendingCapChanges[msg.sender] = PendingCapChange(newCap, unlockTime);
            emit CapIncreaseQueued(msg.sender, newCap, unlockTime);
        }
    }

    function executeCapIncrease() external {
        PendingCapChange memory p = pendingCapChanges[msg.sender];
        require(p.unlockTime != 0, "no pending change");
        require(block.timestamp >= p.unlockTime, "still locked");
        vaults[msg.sender].dailyCap = p.newCap;
        delete pendingCapChanges[msg.sender];
        emit CapChanged(msg.sender, p.newCap);
    }

    function cancelCapIncrease() external {
        require(pendingCapChanges[msg.sender].unlockTime != 0, "no pending change");
        delete pendingCapChanges[msg.sender];
        emit CapIncreaseCancelled(msg.sender);
    }

    // ---------- Spending ----------

    /// @dev Rolls the spend window forward when a full SPEND_WINDOW has
    ///      elapsed since it started. This resets on the next spend after
    ///      the window lapses, not on a continuous per-second rolling basis
    ///      — a deliberate simplification (true continuous rolling needs
    ///      per-spend timestamp accounting) that's close enough for a daily
    ///      cap and much cheaper to reason about and audit.
    function _rollWindow(Vault storage v) private {
        if (block.timestamp >= v.windowStart + SPEND_WINDOW) {
            v.windowStart = block.timestamp;
            v.spentInWindow = 0;
        }
    }

    function spend(address to, uint256 amount) external noReentrancy {
        require(to != address(0), "bad recipient");
        require(amount > 0, "zero amount");

        Vault storage v = vaults[msg.sender];
        _rollWindow(v);
        require(v.balance >= amount, "insufficient balance");

        if (v.spentInWindow + amount <= v.dailyCap) {
            v.spentInWindow += amount;
            v.balance -= amount;
            emit Spent(msg.sender, to, amount);
            (bool ok,) = to.call{value: amount}("");
            require(ok, "transfer failed");
        } else {
            // Reserve the funds immediately so they can't be double-spent or
            // pulled out via emergency withdrawal while this is queued.
            v.balance -= amount;
            uint256 id = nextSpendId++;
            uint256 unlockTime = block.timestamp + OVER_CAP_SPEND_DELAY;
            pendingSpends[id] = PendingSpend(msg.sender, to, amount, unlockTime, false);
            emit SpendQueued(msg.sender, id, to, amount, unlockTime);
        }
    }

    function executeSpend(uint256 id) external noReentrancy {
        PendingSpend storage p = pendingSpends[id];
        require(p.user == msg.sender, "not your spend");
        require(!p.resolved, "already resolved");
        require(block.timestamp >= p.unlockTime, "still locked");

        p.resolved = true;
        emit SpendExecuted(msg.sender, id);
        (bool ok,) = p.to.call{value: p.amount}("");
        require(ok, "transfer failed");
    }

    function cancelSpend(uint256 id) external {
        PendingSpend storage p = pendingSpends[id];
        require(p.user == msg.sender, "not your spend");
        require(!p.resolved, "already resolved");

        p.resolved = true;
        vaults[msg.sender].balance += p.amount;
        emit SpendCancelled(msg.sender, id);
    }

    // ---------- Emergency withdrawal ----------

    /// @notice Withdraws the wallet's current available balance only — funds
    ///         already reserved for a pending queued spend are untouched;
    ///         cancel those separately (cancelSpend) to reclaim them too.
    ///         The 12h delay plus the request event (which Meridian's
    ///         off-chain notification layer watches to send an email alert)
    ///         is the drainer-resistance mechanism: a compromised key can
    ///         request a full drain, but not execute it before the user has
    ///         a real chance to notice and intervene off-chain.
    function requestEmergencyWithdrawal() external {
        uint256 unlockTime = block.timestamp + EMERGENCY_WITHDRAWAL_DELAY;
        pendingEmergencyWithdrawals[msg.sender] = PendingEmergencyWithdrawal(unlockTime, true);
        emit EmergencyWithdrawalRequested(msg.sender, unlockTime);
    }

    function executeEmergencyWithdrawal() external noReentrancy {
        PendingEmergencyWithdrawal storage p = pendingEmergencyWithdrawals[msg.sender];
        require(p.requested, "not requested");
        require(block.timestamp >= p.unlockTime, "still locked");

        uint256 amount = vaults[msg.sender].balance;
        require(amount > 0, "nothing to withdraw");

        vaults[msg.sender].balance = 0;
        delete pendingEmergencyWithdrawals[msg.sender];
        emit EmergencyWithdrawalExecuted(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }

    function cancelEmergencyWithdrawal() external {
        require(pendingEmergencyWithdrawals[msg.sender].requested, "not requested");
        delete pendingEmergencyWithdrawals[msg.sender];
        emit EmergencyWithdrawalCancelled(msg.sender);
    }

    // ---------- Owner (no fund custody) ----------

    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
        emit DepositsPausedSet(paused);
    }

    function setAllowlistPointer(bytes32 pointer) external onlyOwner {
        allowlistPointer = pointer;
        emit AllowlistPointerSet(pointer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
