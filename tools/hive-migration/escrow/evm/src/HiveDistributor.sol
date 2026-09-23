// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IHiveToken {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @notice Project-attested redemption, NOT a cross-chain light client.
/// The immutable admin's automated verifier asserts Solana finality. Anyone can execute an
/// enabled payout to its immutable recipient, or cancel an expired unpaid claim.
contract HiveDistributor {
    enum Status { None, Reserved, Ready, Paid, Cancelled }
    struct Quote {
        bytes32 sourceOwner;
        address recipient;
        uint64 snapshotAmount;
        uint64 depositAmount;
        uint64 depositDeadline;
        uint64 claimDeadline;
    }
    struct Claim {
        Quote quote;
        uint128 grant;
        Status status;
        bytes32 depositEvidence;
    }

    IHiveToken public immutable token;
    address public immutable admin;
    bytes32 public immutable campaignId;
    bytes32 public immutable sourceCampaign; // Solana campaign PDA, binds program/admin
    bytes32 public immutable sourceMint;
    bytes32 public immutable snapshotRoot;
    uint64 public immutable opensAt;
    uint64 public immutable closesAt;
    uint64 public immutable claimGrace;
    uint64 public immutable totalEligibleOldRaw;
    uint128 public immutable fundingBudgetRaw;
    bool public immutable allowPartialSurrender;
    // Lifetime allocations include cancelled claims: unused shares are not redistributed.
    uint256 public allocated;
    uint256 public committedOldRaw;
    mapping(bytes32 => Claim) private records;
    mapping(bytes32 => bytes32) public evidenceClaim;
    uint256 public reserved;
    bool public paused = true;
    bool private entered;

    error Invalid();
    error Unauthorized();
    error WrongState();
    error InsufficientReserve();
    error TransferMismatch();

    event Reserved(bytes32 indexed claimId, bytes32 indexed sourceOwner, address indexed recipient, uint64 depositAmount, uint128 grant, uint64 depositDeadline, uint64 claimDeadline);
    event DepositConfirmed(bytes32 indexed claimId, bytes32 evidence);
    event Paid(bytes32 indexed claimId, address indexed recipient, uint128 amount);
    event Cancelled(bytes32 indexed claimId);
    event Paused(bool value);
    event SurplusWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        address token_, address admin_,
        bytes32 campaignId_, bytes32 sourceCampaign_, bytes32 sourceMint_, bytes32 root_,
        uint64 opensAt_, uint64 closesAt_, uint64 claimGrace_,
        uint64 totalEligibleOldRaw_, uint128 fundingBudgetRaw_, bool allowPartialSurrender_
    ) {
        if (token_.code.length == 0 || admin_ == address(0) || campaignId_ == 0 ||
            sourceCampaign_ == 0 || sourceMint_ == 0 || root_ == 0 ||
            opensAt_ >= closesAt_ || claimGrace_ < 1 hours ||
            uint256(closesAt_) + claimGrace_ > type(uint64).max || totalEligibleOldRaw_ == 0 || fundingBudgetRaw_ == 0) revert Invalid();
        token = IHiveToken(token_);
        if (token.decimals() != 18) revert Invalid();
        admin = admin_;
        campaignId = campaignId_;
        sourceCampaign = sourceCampaign_;
        sourceMint = sourceMint_;
        snapshotRoot = root_;
        opensAt = opensAt_;
        closesAt = closesAt_;
        claimGrace = claimGrace_;
        totalEligibleOldRaw = totalEligibleOldRaw_;
        fundingBudgetRaw = fundingBudgetRaw_;
        allowPartialSurrender = allowPartialSurrender_;
    }

    modifier nonReentrant() {
        if (entered) revert WrongState();
        entered = true;
        _;
        entered = false;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    function claimId(bytes32 owner) public view returns (bytes32) {
        return sha256(abi.encodePacked("HIVE_CLAIM_V1", sourceCampaign, owner));
    }

    function leaf(bytes32 owner, uint64 amount) public view returns (bytes32) {
        return sha256(abi.encodePacked("HIVE_SNAPSHOT_V1", campaignId, sourceMint, owner, amount));
    }

    function grantFor(uint64 amount) public view returns (uint128) {
        if (amount == 0 || amount > totalEligibleOldRaw) revert Invalid();
        // u64 * u128 fits in u256. Both chains floor to one destination raw unit.
        uint256 share = uint256(amount) * fundingBudgetRaw / totalEligibleOldRaw;
        uint256 ceiling = uint256(amount) * 700_000_000; // 70% with 9 -> 18 decimals
        return uint128(share < ceiling ? share : ceiling);
    }

    function getClaim(bytes32 id) external view returns (Claim memory) { return records[id]; }

    function setPaused(bool value) external {
        if (msg.sender != admin) revert Unauthorized();
        paused = value;
        emit Paused(value);
    }

    /// The verifier validates both wallet signatures before reserving these exact terms.
    function reserve(Quote calldata q, bytes32[] calldata proof) external onlyAdmin nonReentrant {
        if (paused || block.timestamp < opensAt || block.timestamp >= closesAt ||
            q.sourceOwner == 0 || q.recipient == address(0) || q.recipient == address(this) ||
            q.depositAmount == 0 || q.depositAmount > q.snapshotAmount || q.snapshotAmount > totalEligibleOldRaw ||
            (!allowPartialSurrender && q.depositAmount != q.snapshotAmount) ||
            q.depositDeadline <= block.timestamp || q.depositDeadline > closesAt ||
            uint256(q.claimDeadline) != uint256(q.depositDeadline) + claimGrace || proof.length > 32) revert Invalid();
        bytes32 id = claimId(q.sourceOwner);
        if (records[id].status != Status.None) revert WrongState();
        bytes32 h = leaf(q.sourceOwner, q.snapshotAmount);
        for (uint256 i; i < proof.length; ++i) {
            h = h < proof[i] ? sha256(abi.encodePacked(h, proof[i])) : sha256(abi.encodePacked(proof[i], h));
        }
        if (h != snapshotRoot) revert Invalid();
        uint128 grant = grantFor(q.depositAmount);
        if (grant == 0 || allocated + grant > fundingBudgetRaw ||
            committedOldRaw + q.depositAmount > totalEligibleOldRaw) revert Invalid();
        if (token.balanceOf(address(this)) < reserved + grant) revert InsufficientReserve();
        reserved += grant;
        allocated += grant;
        committedOldRaw += q.depositAmount;
        records[id] = Claim(q, grant, Status.Reserved, 0);
        emit Reserved(id, q.sourceOwner, q.recipient, q.depositAmount, grant, q.depositDeadline, q.claimDeadline);
    }

    /// Evidence is a SHA-256 commitment to the finalized Solana deposit signature.
    /// The admin verifier MUST inspect finalized escrow state and reservation binding.
    function confirmDeposit(bytes32 id, bytes32 evidence) external onlyAdmin {
        Claim storage c = records[id];
        if (paused || c.status != Status.Reserved || evidence == 0 || block.timestamp > c.quote.claimDeadline) revert WrongState();
        if (evidenceClaim[evidence] != 0 && evidenceClaim[evidence] != id) revert Invalid();
        evidenceClaim[evidence] = id;
        c.depositEvidence = evidence;
        c.status = Status.Ready;
        emit DepositConfirmed(id, evidence);
    }

    function claim(bytes32 id) external nonReentrant {
        Claim storage c = records[id];
        if (paused || c.status != Status.Ready || block.timestamp > c.quote.claimDeadline) revert WrongState();
        c.status = Status.Paid;
        reserved -= c.grant;
        _transferExact(c.quote.recipient, c.grant);
        emit Paid(id, c.quote.recipient, c.grant);
    }

    /// Cancellation permanently invalidates every outstanding approval for this ID.
    function cancel(bytes32 id) external onlyAdmin {
        _unpaid(id);
        _cancel(id);
    }

    /// No attestor or admin can extend the immutable claim deadline.
    function cancelExpired(bytes32 id) external {
        _unpaid(id);
        if (block.timestamp <= records[id].quote.claimDeadline) revert WrongState();
        _cancel(id);
    }

    /// Pending obligations remain fully reserved, including while paused.
    function withdrawSurplus(address recipient, uint256 amount) external nonReentrant {
        if (msg.sender != admin) revert Unauthorized();
        if (recipient == address(0) || recipient == address(this)) revert Invalid();
        uint256 balance = token.balanceOf(address(this));
        if (balance < reserved || amount > balance - reserved) revert InsufficientReserve();
        _transferExact(recipient, amount);
        emit SurplusWithdrawn(recipient, amount);
    }

    function _unpaid(bytes32 id) private view {
        Status s = records[id].status;
        if (s != Status.Reserved && s != Status.Ready) revert WrongState();
    }

    function _cancel(bytes32 id) private {
        Claim storage c = records[id];
        c.status = Status.Cancelled;
        reserved -= c.grant;
        emit Cancelled(id);
    }

    function _transferExact(address recipient, uint256 amount) private {
        uint256 beforeHere = token.balanceOf(address(this));
        uint256 beforeThere = token.balanceOf(recipient);
        (bool ok, bytes memory result) = address(token).call(abi.encodeCall(IHiveToken.transfer, (recipient, amount)));
        if (!ok || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) revert TransferMismatch();
        if (token.balanceOf(address(this)) != beforeHere - amount || token.balanceOf(recipient) != beforeThere + amount) revert TransferMismatch();
    }
}
