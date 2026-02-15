// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AuditBountyEscrowV2
 * @dev Escrow contract for the HIVE Agent Marketplace.
 *      Allows clients to post bounties for code audits.
 *      Allows validators to approve/reject work and release funds.
 *      
 *      V2 Features:
 *      - Protocol fees (configurable %)
 *      - Agent staking requirement
 *      - Slashing mechanism
 */
contract AuditBountyEscrowV2 is Ownable, ReentrancyGuard {
    
    struct Bounty {
        address client;
        uint256 amount;
        string codeUri;
        bool isOpen;
        address assignedAgent;
        string reportUri;
        uint256 createdAt;
    }

    struct Agent {
        string name;
        string bio;
        address wallet;
        bool isRegistered;
        uint256 registeredAt;
        uint256 stakedAmount;
        bool isSlashed;
    }

    // --- State Variables ---
    
    uint256 public bountyCounter;
    mapping(uint256 => Bounty) public bounties;
    mapping(address => uint256) public agentReputation;
    mapping(address => Agent) public agents;
    address[] public agentList;

    // Protocol fees (in basis points, 100 = 1%)
    uint256 public protocolFeeBps = 500; // 5% default
    address public treasury;
    uint256 public totalFeesCollected;

    // Agent staking
    uint256 public minimumStake = 0.01 ether;
    uint256 public totalStaked;

    // --- Events ---
    
    event BountyCreated(uint256 indexed bountyId, address indexed client, uint256 amount, string codeUri);
    event BountyFunded(uint256 indexed bountyId, address indexed client, uint256 amount);
    event WorkSubmitted(uint256 indexed bountyId, address indexed agent, string reportUri);
    event BountyFinalized(uint256 indexed bountyId, address indexed agent, uint256 agentPayout, uint256 protocolFee, bool isValid);
    event BountyRefunded(uint256 indexed bountyId, address indexed client, uint256 amount);
    event AgentRegistered(address indexed agentAddress, string name, uint256 stakedAmount);
    event AgentSlashed(address indexed agentAddress, uint256 slashedAmount, string reason);
    event StakeWithdrawn(address indexed agentAddress, uint256 amount);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event MinimumStakeUpdated(uint256 oldStake, uint256 newStake);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // --- Constructor ---
    
    constructor(address initialOwner, address _treasury) Ownable(initialOwner) {
        require(_treasury != address(0), "Treasury cannot be zero address");
        treasury = _treasury;
    }

    // --- Bounty Functions ---

    /**
     * @notice Create a new audit bounty by depositing ETH
     * @param _codeUri The IPFS URI of the code to be audited
     */
    function createBounty(string memory _codeUri) external payable nonReentrant {
        require(msg.value > 0, "Bounty amount must be greater than 0");
        require(bytes(_codeUri).length > 0, "Code URI is required");

        bountyCounter++;
        
        bounties[bountyCounter] = Bounty({
            client: msg.sender,
            amount: msg.value,
            codeUri: _codeUri,
            isOpen: true,
            assignedAgent: address(0),
            reportUri: "",
            createdAt: block.timestamp
        });

        emit BountyCreated(bountyCounter, msg.sender, msg.value, _codeUri);
    }

    /**
     * @notice Create a new audit request (RFP) without immediate funding
     * @param _codeUri The IPFS URI of the code/requirements
     */
    function createRequest(string memory _codeUri) external nonReentrant {
        require(bytes(_codeUri).length > 0, "Code URI is required");

        bountyCounter++;
        
        bounties[bountyCounter] = Bounty({
            client: msg.sender,
            amount: 0, // No funds initially
            codeUri: _codeUri,
            isOpen: true,
            assignedAgent: address(0),
            reportUri: "",
            createdAt: block.timestamp
        });

        emit BountyCreated(bountyCounter, msg.sender, 0, _codeUri);
    }

    /**
     * @notice Fund an existing bounty/request
     * @param _bountyId The ID of the bounty to fund
     */
    function fundBounty(uint256 _bountyId) external payable nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.isOpen, "Bounty is not open");
        require(bounty.client == msg.sender, "Only client can fund");
        require(msg.value > 0, "Amount must be greater than 0");

        bounty.amount += msg.value;
        
        // Optional: Emit an event for funding (using BountyRefunded signature logic or new event)
        // For now, we reuse BountyCreated? No, that implies creation. 
        // We probably need a BountyFunded event.
        emit BountyFunded(_bountyId, msg.sender, msg.value);
    }

    /**
     * @notice Submit work for a bounty (Called by registered Agent only)
     * @param _bountyId The ID of the bounty
     * @param _reportUri The IPFS URI of the audit report
     */
    function submitWork(uint256 _bountyId, string memory _reportUri) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        Agent storage agent = agents[msg.sender];
        
        require(bounty.isOpen, "Bounty is not open");
        require(bytes(_reportUri).length > 0, "Report URI is required");
        require(agent.isRegistered, "Must be a registered agent");
        require(!agent.isSlashed, "Agent has been slashed");
        
        // Store report URI (can be overwritten by same agent or others until finalized)
        bounty.reportUri = _reportUri;
        bounty.assignedAgent = msg.sender;
        
        emit WorkSubmitted(_bountyId, msg.sender, _reportUri);
    }

    /**
     * @notice Finalize a bounty with protocol fee deduction
     * @param _bountyId The ID of the bounty
     * @param _agent The address of the agent to pay
     * @param _isValid Whether the work is valid
     * @param _scoreToAdd Reputation score to add
     */
    function finalizeBounty(uint256 _bountyId, address _agent, bool _isValid, uint256 _scoreToAdd) external onlyOwner nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.isOpen, "Bounty is not open");

        if (_isValid) {
            require(_agent != address(0), "Agent address required");
            require(agents[_agent].isRegistered, "Agent must be registered");
            
            bounty.isOpen = false;
            bounty.assignedAgent = _agent;
            
            // Calculate protocol fee
            uint256 protocolFee = (bounty.amount * protocolFeeBps) / 10000;
            uint256 agentPayout = bounty.amount - protocolFee;
            
            // Pay the agent
            (bool agentSuccess, ) = payable(_agent).call{value: agentPayout}("");
            require(agentSuccess, "Agent transfer failed");
            
            // Pay protocol fee to treasury
            if (protocolFee > 0 && treasury != address(0)) {
                (bool feeSuccess, ) = payable(treasury).call{value: protocolFee}("");
                require(feeSuccess, "Fee transfer failed");
                totalFeesCollected += protocolFee;
            }

            // Update reputation
            agentReputation[_agent] += _scoreToAdd;

            emit BountyFinalized(_bountyId, _agent, agentPayout, protocolFee, true);
        } else {
            // Invalid submission - do nothing, keep bounty open for others
            emit BountyFinalized(_bountyId, _agent, 0, 0, false);
        }
    }

    /**
     * @notice Refund the bounty to the client
     */
    function refundBounty(uint256 _bountyId) external onlyOwner nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.isOpen, "Bounty is not open");
        
        bounty.isOpen = false;
        
        (bool success, ) = payable(bounty.client).call{value: bounty.amount}("");
        require(success, "Refund failed");

        emit BountyRefunded(_bountyId, bounty.client, bounty.amount);
    }

    // --- Agent Functions with Staking ---

    /**
     * @notice Register as an agent with stake
     * @param _name Display name
     * @param _bio Description or metadata URI
     */
    function registerAgent(string memory _name, string memory _bio) external payable nonReentrant {
        require(!agents[msg.sender].isRegistered, "Agent already registered");
        require(bytes(_name).length > 0, "Name is required");
        require(msg.value >= minimumStake, "Insufficient stake");

        agents[msg.sender] = Agent({
            name: _name,
            bio: _bio,
            wallet: msg.sender,
            isRegistered: true,
            registeredAt: block.timestamp,
            stakedAmount: msg.value,
            isSlashed: false
        });

        agentList.push(msg.sender);
        totalStaked += msg.value;

        emit AgentRegistered(msg.sender, _name, msg.value);
    }

    /**
     * @notice Slash an agent's stake (for malicious behavior)
     * @param _agent Agent address to slash
     * @param _reason Reason for slashing
     */
    function slashAgent(address _agent, string memory _reason) external onlyOwner nonReentrant {
        Agent storage agent = agents[_agent];
        require(agent.isRegistered, "Agent not registered");
        require(!agent.isSlashed, "Agent already slashed");
        require(agent.stakedAmount > 0, "No stake to slash");

        uint256 slashedAmount = agent.stakedAmount;
        agent.stakedAmount = 0;
        agent.isSlashed = true;
        totalStaked -= slashedAmount;

        // Send slashed stake to treasury
        (bool success, ) = payable(treasury).call{value: slashedAmount}("");
        require(success, "Slash transfer failed");

        emit AgentSlashed(_agent, slashedAmount, _reason);
    }

    /**
     * @notice Allow agent to withdraw stake (only if not slashed and after cooldown)
     * @dev Could add a time-lock in production
     */
    function withdrawStake() external nonReentrant {
        Agent storage agent = agents[msg.sender];
        require(agent.isRegistered, "Not registered");
        require(!agent.isSlashed, "Agent has been slashed");
        require(agent.stakedAmount > 0, "No stake to withdraw");
        
        // In production, add time-lock check here
        // require(block.timestamp > agent.registeredAt + STAKE_LOCKUP_PERIOD, "Stake still locked");

        uint256 amount = agent.stakedAmount;
        agent.stakedAmount = 0;
        agent.isRegistered = false;
        totalStaked -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    // --- Admin Functions ---

    /**
     * @notice Update protocol fee
     * @param _newFeeBps New fee in basis points (100 = 1%)
     */
    function setProtocolFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 2000, "Fee cannot exceed 20%");
        emit ProtocolFeeUpdated(protocolFeeBps, _newFeeBps);
        protocolFeeBps = _newFeeBps;
    }

    /**
     * @notice Update minimum stake requirement
     */
    function setMinimumStake(uint256 _newMinStake) external onlyOwner {
        emit MinimumStakeUpdated(minimumStake, _newMinStake);
        minimumStake = _newMinStake;
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Cannot be zero address");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    // --- View Functions ---

    function getAllAgents() external view returns (Agent[] memory) {
        Agent[] memory allAgents = new Agent[](agentList.length);
        for (uint256 i = 0; i < agentList.length; i++) {
            allAgents[i] = agents[agentList[i]];
        }
        return allAgents;
    }

    function getBounty(uint256 _bountyId) external view returns (Bounty memory) {
        return bounties[_bountyId];
    }

    function getAgentStake(address _agent) external view returns (uint256) {
        return agents[_agent].stakedAmount;
    }

    function isAgentActive(address _agent) external view returns (bool) {
        return agents[_agent].isRegistered && !agents[_agent].isSlashed;
    }
}
