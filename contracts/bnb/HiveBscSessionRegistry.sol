// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HiveBscSessionRegistry {
    enum SessionStatus {
        None,
        Active,
        Revoked
    }

    struct Session {
        address client;
        address agent;
        uint256 spendCapWei;
        uint64 expiresAt;
        SessionStatus status;
        bytes32 permissionsHash;
        string receiptId;
    }

    mapping(bytes32 => Session) public sessions;

    event SessionGranted(
        bytes32 indexed sessionId,
        address indexed client,
        address indexed agent,
        uint256 spendCapWei,
        uint64 expiresAt,
        bytes32 permissionsHash,
        string receiptId
    );

    event SessionRevoked(bytes32 indexed sessionId, address indexed client, address indexed agent, string reason);

    error InvalidAgent();
    error InvalidExpiry();
    error SessionAlreadyExists();
    error SessionNotActive();
    error OnlyClient();

    function grantSession(
        address agent,
        uint256 spendCapWei,
        uint64 expiresAt,
        bytes32 permissionsHash,
        string calldata receiptId
    ) external returns (bytes32 sessionId) {
        if (agent == address(0)) revert InvalidAgent();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        sessionId = keccak256(abi.encode(block.chainid, address(this), msg.sender, agent, permissionsHash, receiptId));
        if (sessions[sessionId].status != SessionStatus.None) revert SessionAlreadyExists();

        sessions[sessionId] = Session({
            client: msg.sender,
            agent: agent,
            spendCapWei: spendCapWei,
            expiresAt: expiresAt,
            status: SessionStatus.Active,
            permissionsHash: permissionsHash,
            receiptId: receiptId
        });

        emit SessionGranted(sessionId, msg.sender, agent, spendCapWei, expiresAt, permissionsHash, receiptId);
    }

    function revokeSession(bytes32 sessionId, string calldata reason) external {
        Session storage session = sessions[sessionId];
        if (session.status != SessionStatus.Active) revert SessionNotActive();
        if (msg.sender != session.client) revert OnlyClient();

        session.status = SessionStatus.Revoked;

        emit SessionRevoked(sessionId, session.client, session.agent, reason);
    }
}
