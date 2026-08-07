// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HiveBscAgentEscrow } from "../../contracts/bnb/HiveBscAgentEscrow.sol";
import { HiveBscSessionRegistry } from "../../contracts/bnb/HiveBscSessionRegistry.sol";

interface Vm {
    function deal(address account, uint256 value) external;
    function expectRevert(bytes4 selector) external;
    function prank(address account) external;
    function warp(uint256 timestamp) external;
}

contract HiveBscContractsTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    HiveBscAgentEscrow private escrow;
    HiveBscSessionRegistry private registry;

    address private client = address(0xA11CE);
    address private agent = address(0xA6E17);
    bytes32 private taskHash = keccak256("task");
    bytes32 private permissionsHash = keccak256("permissions");

    function setUp() public {
        escrow = new HiveBscAgentEscrow();
        registry = new HiveBscSessionRegistry();
        VM.deal(client, 10 ether);
    }

    function testFundAndReleaseNativeJob() public {
        VM.prank(client);
        bytes32 jobId = escrow.fundNativeJob{ value: 1 ether }(
            agent,
            "receipt-1",
            taskHash,
            uint64(block.timestamp + 1 days)
        );

        (
            address storedClient,
            address storedAgent,
            uint256 amount,
            ,
            HiveBscAgentEscrow.JobStatus status,
            bytes32 storedTaskHash,
            string memory receiptId
        ) = escrow.jobs(jobId);

        assert(storedClient == client);
        assert(storedAgent == agent);
        assert(amount == 1 ether);
        assert(status == HiveBscAgentEscrow.JobStatus.Funded);
        assert(storedTaskHash == taskHash);
        assert(keccak256(bytes(receiptId)) == keccak256(bytes("receipt-1")));

        uint256 agentBalanceBefore = agent.balance;
        VM.prank(client);
        escrow.release(jobId);

        (,,,, HiveBscAgentEscrow.JobStatus releasedStatus,,) = escrow.jobs(jobId);
        assert(releasedStatus == HiveBscAgentEscrow.JobStatus.Released);
        assert(agent.balance == agentBalanceBefore + 1 ether);
    }

    function testOnlyClientCanReleaseEscrow() public {
        VM.prank(client);
        bytes32 jobId = escrow.fundNativeJob{ value: 1 ether }(
            agent,
            "receipt-2",
            taskHash,
            uint64(block.timestamp + 1 days)
        );

        VM.expectRevert(HiveBscAgentEscrow.OnlyClient.selector);
        VM.prank(agent);
        escrow.release(jobId);
    }

    function testExpiredJobCanOnlyRefundAfterExpiry() public {
        VM.prank(client);
        bytes32 jobId = escrow.fundNativeJob{ value: 1 ether }(
            agent,
            "receipt-3",
            taskHash,
            uint64(block.timestamp + 1 days)
        );

        VM.expectRevert(HiveBscAgentEscrow.NotExpired.selector);
        escrow.refundExpired(jobId);

        uint256 clientBalanceBefore = client.balance;
        VM.warp(block.timestamp + 1 days + 1);
        escrow.refundExpired(jobId);

        (,,,, HiveBscAgentEscrow.JobStatus refundedStatus,,) = escrow.jobs(jobId);
        assert(refundedStatus == HiveBscAgentEscrow.JobStatus.Refunded);
        assert(client.balance == clientBalanceBefore + 1 ether);
    }

    function testGrantAndRevokeSession() public {
        VM.prank(client);
        bytes32 sessionId = registry.grantSession(
            agent,
            1 ether,
            uint64(block.timestamp + 1 days),
            permissionsHash,
            "session-receipt-1"
        );

        (
            address storedClient,
            address storedAgent,
            uint256 spendCapWei,
            ,
            HiveBscSessionRegistry.SessionStatus status,
            bytes32 storedPermissionsHash,
            string memory receiptId
        ) = registry.sessions(sessionId);

        assert(storedClient == client);
        assert(storedAgent == agent);
        assert(spendCapWei == 1 ether);
        assert(status == HiveBscSessionRegistry.SessionStatus.Active);
        assert(storedPermissionsHash == permissionsHash);
        assert(keccak256(bytes(receiptId)) == keccak256(bytes("session-receipt-1")));

        VM.prank(client);
        registry.revokeSession(sessionId, "done");

        (,,,, HiveBscSessionRegistry.SessionStatus revokedStatus,,) = registry.sessions(sessionId);
        assert(revokedStatus == HiveBscSessionRegistry.SessionStatus.Revoked);
    }

    function testOnlyClientCanRevokeSession() public {
        VM.prank(client);
        bytes32 sessionId = registry.grantSession(
            agent,
            1 ether,
            uint64(block.timestamp + 1 days),
            permissionsHash,
            "session-receipt-2"
        );

        VM.expectRevert(HiveBscSessionRegistry.OnlyClient.selector);
        VM.prank(agent);
        registry.revokeSession(sessionId, "not allowed");
    }

    function testRejectsInvalidAgentAndExpiredSession() public {
        VM.expectRevert(HiveBscAgentEscrow.InvalidAgent.selector);
        VM.prank(client);
        escrow.fundNativeJob{ value: 1 ether }(
            address(0),
            "bad-agent",
            taskHash,
            uint64(block.timestamp + 1 days)
        );

        VM.expectRevert(HiveBscSessionRegistry.InvalidExpiry.selector);
        registry.grantSession(
            agent,
            1 ether,
            uint64(block.timestamp),
            permissionsHash,
            "expired"
        );
    }
}
