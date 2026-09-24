// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {HiveDistributor} from "../src/HiveDistributor.sol";
interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}
contract TestToken {
    mapping(address=>uint256) public balanceOf;
    uint8 public constant decimals=18;
    bool public fee;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function setFee(bool value) external {fee=value;}
    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=fee?amount-1:amount;return true;}
}
contract HiveDistributorTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant CID=bytes32(uint256(1));
    bytes32 constant SOURCE=bytes32(uint256(2));
    bytes32 constant MINT=bytes32(uint256(3));
    bytes32 constant OWNER=bytes32(uint256(4));
    address constant RECIPIENT=address(0xd4);
    uint64 constant CAP=2000e9;
    TestToken token;HiveDistributor d;bytes32 id;
    function make(bytes32 root) internal returns(HiveDistributor){
        return new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,root,100,10000,3600,
            20000e9, 6000 ether, true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
    }
    function leaf(bytes32 owner,uint64 amount) internal pure returns(bytes32){return sha256(abi.encodePacked("HIVE_SNAPSHOT_V1",CID,MINT,owner,amount));}
    function quote() internal pure returns(HiveDistributor.Quote memory){return HiveDistributor.Quote(OWNER,RECIPIENT,CAP,CAP,1000,4600);}
    function setUp() public {vm.warp(100);token=new TestToken();d=make(leaf(OWNER,CAP));token.mint(address(d),1000000 ether);d.setPaused(false);id=d.claimId(OWNER);}
    function reserve() internal {d.reserve(quote(),new bytes32[](0));}
    function ready() internal {reserve();d.confirmDeposit(id,bytes32(uint256(5)));}
    function status(HiveDistributor.Status expected) internal view {require(d.getClaim(id).status==expected);}
    function testStartsPaused() public {require(make(leaf(OWNER,CAP)).paused());}
    function testSingleAdminReservesAndConfirmsWithoutOtherWallets() public {ready();status(HiveDistributor.Status.Ready);require(d.reserved()==600 ether);}
    function testUnauthorizedCannotReserveConfirmCancelOrPause() public {
        vm.expectRevert(HiveDistributor.Unauthorized.selector);vm.prank(address(99));d.reserve(quote(),new bytes32[](0));
        reserve();
        vm.expectRevert(HiveDistributor.Unauthorized.selector);vm.prank(address(99));d.confirmDeposit(id,bytes32(uint256(5)));
        vm.expectRevert(HiveDistributor.Unauthorized.selector);vm.prank(address(99));d.cancel(id);
        vm.expectRevert(HiveDistributor.Unauthorized.selector);vm.prank(address(99));d.setPaused(true);
    }
    function testExactPayoutPermissionlessAndOnce() public {
        ready();vm.prank(address(99));d.claim(id);require(token.balanceOf(RECIPIENT)==600 ether);require(d.reserved()==0);status(HiveDistributor.Status.Paid);
        vm.expectRevert(HiveDistributor.WrongState.selector);d.claim(id);
        vm.expectRevert(HiveDistributor.WrongState.selector);d.cancel(id);
    }
    function testUnconfirmedDepositCannotPay() public {reserve();vm.expectRevert(HiveDistributor.WrongState.selector);d.claim(id);}
    function testReservationCannotBeOverwritten() public {reserve();HiveDistributor.Quote memory q=quote();q.recipient=address(99);vm.expectRevert(HiveDistributor.WrongState.selector);d.reserve(q,new bytes32[](0));}
    function testWrongProofNewOwnerAndPostCutoffIncreaseRejected() public {
        HiveDistributor.Quote memory q=quote();q.snapshotAmount+=1;
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,new bytes32[](0));
        q=quote();q.depositAmount+=1;vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,new bytes32[](0));
        q=quote();q.sourceOwner=bytes32(uint256(123));vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,new bytes32[](0));
    }
    function testInsufficientFundingLeavesNoReservation() public {
        d.withdrawSurplus(address(100),1000000 ether);vm.expectRevert(HiveDistributor.InsufficientReserve.selector);reserve();status(HiveDistributor.Status.None);require(d.reserved()==0);
    }
    function testCannotWithdrawCommittedInventory() public {
        reserve();vm.expectRevert(HiveDistributor.InsufficientReserve.selector);d.withdrawSurplus(address(100),999401 ether);
        d.withdrawSurplus(address(100),999400 ether);require(token.balanceOf(address(d))==d.reserved());
    }
    function testAdminRecoversAllUnclaimedInventoryAfterExpiredClaimsAreCancelled() public {
        ready();
        vm.expectRevert(HiveDistributor.Unauthorized.selector);
        vm.prank(address(99));d.withdrawSurplus(address(100),1 ether);
        vm.warp(4601);d.cancelExpired(id);
        uint256 remaining=token.balanceOf(address(d));
        d.withdrawSurplus(address(100),remaining);
        require(token.balanceOf(address(d))==0&&token.balanceOf(address(100))==remaining);
        vm.expectRevert(HiveDistributor.WrongState.selector);d.claim(id);
    }
    function testCancellationBlocksAllFutureClaimsAndReservations() public {
        ready();d.cancel(id);status(HiveDistributor.Status.Cancelled);require(d.reserved()==0);
        vm.expectRevert(HiveDistributor.WrongState.selector);d.claim(id);
        vm.expectRevert(HiveDistributor.WrongState.selector);d.confirmDeposit(id,bytes32(uint256(6)));
        vm.expectRevert(HiveDistributor.WrongState.selector);reserve();
    }
    function testPaymentWinsCancellationRace() public {ready();d.claim(id);vm.expectRevert(HiveDistributor.WrongState.selector);d.cancel(id);require(token.balanceOf(RECIPIENT)==600 ether);}
    function testExpiredCancellationWorksWithoutAdminWhilePaused() public {ready();d.setPaused(true);vm.warp(4601);vm.prank(address(99));d.cancelExpired(id);status(HiveDistributor.Status.Cancelled);require(d.reserved()==0);}
    function testDeadlineBoundary() public {ready();vm.warp(4600);vm.expectRevert(HiveDistributor.WrongState.selector);d.cancelExpired(id);d.claim(id);}
    function testExpiredClaimCannotPay() public {ready();vm.warp(4601);vm.expectRevert(HiveDistributor.WrongState.selector);d.claim(id);d.cancelExpired(id);}
    function testFeeTokenRevertsPaymentAndPreservesReservation() public {ready();token.setFee(true);vm.expectRevert(HiveDistributor.TransferMismatch.selector);d.claim(id);status(HiveDistributor.Status.Ready);require(d.reserved()==600 ether&&token.balanceOf(RECIPIENT)==0);}
    function testZeroEvidenceRejected() public {reserve();vm.expectRevert(HiveDistributor.WrongState.selector);d.confirmDeposit(id,0);}
    function testFuzzAmountCannotIncreaseGrantBeyondCap(uint64 amount) public {
        amount=uint64(uint256(amount)%CAP+1);HiveDistributor.Quote memory q=quote();q.depositAmount=amount;d.reserve(q,new bytes32[](0));
        require(d.reserved()==uint256(amount)*300000000);require(d.reserved()<=token.balanceOf(address(d)));d.cancel(id);require(d.reserved()==0);
    }
    function testProportionalQuotesAndCeiling() public {
        require(d.grantFor(1)==300000000);require(d.grantFor(CAP)==600 ether);
        require(d.grantFor(CAP/2)==300 ether);
        HiveDistributor capped=new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,leaf(OWNER,CAP),100,10000,3600,CAP,type(uint128).max,true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        require(capped.grantFor(CAP)==1400 ether);require(capped.grantFor(1)==700000000);
        vm.expectRevert(HiveDistributor.Invalid.selector);capped.grantFor(CAP+1);
    }
    function testPartialSurrenderMustBeExplicitlyEnabled() public {
        d=new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,leaf(OWNER,CAP),100,10000,3600,CAP,600 ether,false,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        d.setPaused(false);token.mint(address(d),600 ether);
        HiveDistributor.Quote memory q=quote();q.depositAmount=CAP/2;
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,new bytes32[](0));
        reserve();require(d.reserved()==600 ether);
    }
    function testZeroGrantCannotTakeDeposit() public {
        d=new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,leaf(OWNER,CAP),100,10000,3600,CAP,1,true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        d.setPaused(false);token.mint(address(d),1);
        HiveDistributor.Quote memory q=quote();q.depositAmount=1;
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,new bytes32[](0));
        require(d.allocated()==0);require(d.committedOldRaw()==0);
    }
    function testFuzzExactRateAndCap(uint64 a, uint64 t, uint128 b) public {
        if(t==0)t=1;if(b==0)b=1;uint64 amount=uint64(uint256(a)%t+1);
        HiveDistributor f=new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,leaf(OWNER,t),100,10000,3600,t,b,true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        uint256 share=uint256(amount)*b/t;uint256 cap=uint256(amount)*700000000;
        require(f.grantFor(amount)==(share<cap?share:cap));
    }
    function testCancelledShareCannotBeReallocatedBeyondLifetimeBudget() public {
        bytes32 owner2=bytes32(uint256(123));bytes32 own=leaf(OWNER,CAP);bytes32 other=leaf(owner2,CAP);
        bytes32 root=own<other?sha256(abi.encodePacked(own,other)):sha256(abi.encodePacked(other,own));
        // Deliberately inconsistent root/denominator: lifetime bounds still prevent overspend.
        d=new HiveDistributor(address(token),address(this),CID,SOURCE,MINT,root,100,10000,3600,CAP,600 ether,true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        d.setPaused(false);token.mint(address(d),1200 ether);
        bytes32[] memory proof=new bytes32[](1);proof[0]=other;d.reserve(quote(),proof);d.cancel(d.claimId(OWNER));
        require(d.reserved()==0 && d.allocated()==600 ether && d.committedOldRaw()==CAP);
        HiveDistributor.Quote memory q=quote();q.sourceOwner=owner2;proof[0]=own;
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q,proof);
    }
    function testConcurrentOwnersCannotOverbook() public {
        bytes32 owner2=bytes32(uint256(123));bytes32 own=leaf(OWNER,CAP);bytes32 other=leaf(owner2,CAP);
        bytes32 root=own<other?sha256(abi.encodePacked(own,other)):sha256(abi.encodePacked(other,own));d=make(root);d.setPaused(false);token.mint(address(d),900 ether);
        bytes32[] memory proof=new bytes32[](1);proof[0]=other;d.reserve(quote(),proof);
        HiveDistributor.Quote memory q=quote();q.sourceOwner=owner2;proof[0]=own;
        vm.expectRevert(HiveDistributor.InsufficientReserve.selector);d.reserve(q,proof);
        require(d.reserved()==600 ether);require(d.getClaim(d.claimId(owner2)).status==HiveDistributor.Status.None);
    }
    function testJavascriptRustCommitmentVector() public {
        bytes32 cid=0x0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c;
        bytes32 source=0x0efd3aa0f7c63db8415eef20f312d442e92e826b3145e352ab1f6e8338fcd4aa;
        bytes32 mint=0x0303030303030303030303030303030303030303030303030303030303030303;
        bytes32 owner=0x0505050505050505050505050505050505050505050505050505050505050505;
        bytes32 root=0x0bd8350e643c9a2313f14fd708478c38c5bf4b6f05048ea0cc1726cbebd23ae9;
        d=new HiveDistributor(address(token),address(this),cid,source,mint,root,100,10000,3600,
            102000000000001, 30600 ether, true,HiveDistributor.ExceptionTerms(bytes32(0),0,0,0));
        require(d.leaf(owner,CAP)==0x9b46561823338928857c0e1cf44a50f947cfbe963b97248ecf861f269840d0ee);
        require(d.claimId(owner)==0x23e428c4e27a1655ebcf826dd4c1831780a011937ba7cc1f255ae3e0f2bdd9fb);
        bytes32[] memory proof=new bytes32[](2);proof[0]=0x2079a658c46bb9e6ffd1ae813f95527f1efb2109f4272d618a4f06dfabc0fba5;proof[1]=0x53b15e51c340495f565ddc5aaaf1fa8a2a240a35b77cb0b6527bc86456d48a1a;
        d.setPaused(false);token.mint(address(d),600 ether);HiveDistributor.Quote memory q=quote();q.sourceOwner=owner;d.reserve(q,proof);require(d.reserved()==599999999999994117647);
    }
}
