// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HiveBscAgentEscrow {
    enum JobStatus {
        None,
        Funded,
        Released,
        Refunded
    }

    struct Job {
        address client;
        address agent;
        uint256 amount;
        uint64 expiresAt;
        JobStatus status;
        bytes32 taskHash;
        string receiptId;
    }

    mapping(bytes32 => Job) public jobs;

    uint256 private locked = 1;

    event JobFunded(
        bytes32 indexed jobId,
        address indexed client,
        address indexed agent,
        uint256 amount,
        uint64 expiresAt,
        string receiptId,
        bytes32 taskHash
    );
    event JobReleased(bytes32 indexed jobId, address indexed client, address indexed agent, uint256 amount);
    event JobRefunded(bytes32 indexed jobId, address indexed client, uint256 amount);

    error InvalidAgent();
    error InvalidAmount();
    error InvalidExpiry();
    error JobAlreadyExists();
    error JobNotFunded();
    error OnlyClient();
    error NotExpired();
    error TransferFailed();

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() internal {
        require(locked == 1, "LOCKED");
        locked = 2;
    }

    function _nonReentrantAfter() internal {
        locked = 1;
    }

    function fundNativeJob(
        address agent,
        string calldata receiptId,
        bytes32 taskHash,
        uint64 expiresAt
    ) external payable returns (bytes32 jobId) {
        if (agent == address(0)) revert InvalidAgent();
        if (msg.value == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        jobId = keccak256(abi.encode(block.chainid, address(this), msg.sender, agent, receiptId, taskHash));
        if (jobs[jobId].status != JobStatus.None) revert JobAlreadyExists();

        jobs[jobId] = Job({
            client: msg.sender,
            agent: agent,
            amount: msg.value,
            expiresAt: expiresAt,
            status: JobStatus.Funded,
            taskHash: taskHash,
            receiptId: receiptId
        });

        emit JobFunded(jobId, msg.sender, agent, msg.value, expiresAt, receiptId, taskHash);
    }

    function release(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.Funded) revert JobNotFunded();
        if (msg.sender != job.client) revert OnlyClient();

        job.status = JobStatus.Released;
        uint256 amount = job.amount;
        (bool sent,) = payable(job.agent).call{ value: amount }("");
        if (!sent) revert TransferFailed();

        emit JobReleased(jobId, job.client, job.agent, amount);
    }

    function refundExpired(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.Funded) revert JobNotFunded();
        if (block.timestamp <= job.expiresAt) revert NotExpired();

        job.status = JobStatus.Refunded;
        uint256 amount = job.amount;
        (bool sent,) = payable(job.client).call{ value: amount }("");
        if (!sent) revert TransferFailed();

        emit JobRefunded(jobId, job.client, amount);
    }
}
