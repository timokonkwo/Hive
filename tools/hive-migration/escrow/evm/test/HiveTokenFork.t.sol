// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {HiveDistributor, IHiveToken} from "../src/HiveDistributor.sol";
interface ForkVm {
    function envOr(string calldata,string calldata) external returns(string memory);
    function createSelectFork(string calldata) external returns(uint256);
    function prank(address) external;
    function skip(bool) external;
}
/// Read-only mainnet fork; all transfers and deployment occur inside the local EVM.
contract HiveTokenForkTest {
    ForkVm constant vm=ForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testLiveHiveTransferAndDistributorPayoutOnFork() public {
        string memory rpc=vm.envOr("HIVE_ESCROW_FORK_RPC",string(""));
        if(bytes(rpc).length==0){vm.skip(true);return;}
        vm.createSelectFork(rpc);
        require(block.chainid==4663,"wrong fork");
        IHiveToken token=IHiveToken(0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8);
        address holder=0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2;
        require(token.balanceOf(holder)>=1000 ether,"fork holder has insufficient test inventory");
        bytes32 cid=bytes32(uint256(1));bytes32 source=bytes32(uint256(2));bytes32 mint=bytes32(uint256(3));bytes32 owner=bytes32(uint256(4));
        uint64 amount=2000e9;
        bytes32 root=sha256(abi.encodePacked("HIVE_SNAPSHOT_V1",cid,mint,owner,amount));
        HiveDistributor d=new HiveDistributor(address(token),address(this),cid,source,mint,root,uint64(block.timestamp),uint64(block.timestamp+10000),3600,
            amount, 1000 ether, false);
        vm.prank(holder);require(token.transfer(address(d),1000 ether));
        d.setPaused(false);
        address recipient=address(0x4567);uint256 beforeBalance=token.balanceOf(recipient);
        HiveDistributor.Quote memory q=HiveDistributor.Quote(owner,recipient,amount,amount,uint64(block.timestamp+1000),uint64(block.timestamp+4600));
        d.reserve(q,new bytes32[](0));
        bytes32 id=d.claimId(owner);
        d.confirmDeposit(id,bytes32(uint256(5)));
        d.claim(id);
        require(token.balanceOf(recipient)-beforeBalance==1000 ether,"wrong actual HIVE receipt");
        require(token.balanceOf(address(d))==0&&d.reserved()==0,"inventory not reconciled");
    }
}
