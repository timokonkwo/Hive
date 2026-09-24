// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {HiveDistributor} from "../src/HiveDistributor.sol";
import {TestToken, Vm} from "./HiveDistributor.t.sol";
contract HiveSupplementalTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant NORMAL=bytes32(uint256(4));
    bytes32 constant EXTRA=bytes32(uint256(5));
    uint64 constant TOTAL=564937895383759533;
    uint64 constant ALLOWANCE=1507505338430267;
    uint128 constant BASE=10000000 ether;
    uint128 constant BONUS=100000 ether;
    TestToken token; HiveDistributor d;
    function setUp() public {
        token=new TestToken();
        bytes32 root=sha256(abi.encodePacked("HIVE_SNAPSHOT_V1",bytes32(uint256(1)),bytes32(uint256(3)),NORMAL,TOTAL));
        d=new HiveDistributor(address(token),address(this),bytes32(uint256(1)),bytes32(uint256(2)),bytes32(uint256(3)),root,200,10000,3600,TOTAL,BASE,true,HiveDistributor.ExceptionTerms(EXTRA,ALLOWANCE,BONUS,100));
        token.mint(address(d),uint256(BASE)+BONUS);d.setPaused(false);vm.warp(100);
    }
    function q(bytes32 owner,uint64 cap,uint64 amount) internal pure returns(HiveDistributor.Quote memory){return HiveDistributor.Quote(owner,address(0x1234),cap,amount,1000,4600);}
    function pay(bytes32 owner) internal {bytes32 id=d.claimId(owner);d.confirmDeposit(id,owner);d.claim(id);}
    function testSupplementalPayoutLeavesEntireOrdinaryBudgetAndRateIntact() public {
        uint128 beforeQuote=d.grantFor(1000000e9);
        d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](0));pay(EXTRA);
        require(token.balanceOf(address(d))==BASE && token.balanceOf(address(0x1234))==BONUS);
        require(d.allocated()==0 && d.committedOldRaw()==0 && d.exceptionAllocated()==BONUS);
        require(d.grantFor(1000000e9)==beforeQuote);
        vm.warp(200);d.reserve(q(NORMAL,TOTAL,TOTAL),new bytes32[](0));pay(NORMAL);
        require(token.balanceOf(address(d))==0 && d.allocated()==BASE);
    }
    function testOrdinaryPayoutCannotConsumeSupplementalInventory() public {
        vm.warp(200);d.reserve(q(NORMAL,TOTAL,TOTAL),new bytes32[](0));pay(NORMAL);
        require(token.balanceOf(address(d))==BONUS);
        d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](0));pay(EXTRA);require(token.balanceOf(address(d))==0);
    }
    function testOnlyExceptionCanOpenEarly() public {
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q(NORMAL,TOTAL,TOTAL),new bytes32[](0));
        vm.warp(99);vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](0));
    }
    function testMissingSupplementalFundingCannotConsumeOrdinaryPool() public {
        d.withdrawSurplus(address(9),BONUS);
        vm.expectRevert(HiveDistributor.InsufficientReserve.selector);d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](0));
        require(d.exceptionAllocated()==0 && d.allocated()==0);
    }
    function testForgedOwnerAllowanceAndProofRejected() public {
        vm.warp(200);
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q(bytes32(uint256(99)),ALLOWANCE,ALLOWANCE),new bytes32[](0));
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q(EXTRA,ALLOWANCE+1,ALLOWANCE),new bytes32[](0));
        vm.expectRevert(HiveDistributor.Invalid.selector);d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](1));
    }
    function testFuzzSupplementalPartialDepositExactAndTerminal(uint64 amount) public {
        amount=uint64(uint256(amount)%(ALLOWANCE-1)+1);
        uint256 expected=uint256(amount)*BONUS/ALLOWANCE;
        d.reserve(q(EXTRA,ALLOWANCE,amount),new bytes32[](0));
        require(d.reserved()==expected && d.allocated()==0 && d.exceptionAllocated()==expected);
        d.cancel(d.claimId(EXTRA));
        vm.expectRevert(HiveDistributor.WrongState.selector);d.reserve(q(EXTRA,ALLOWANCE,ALLOWANCE),new bytes32[](0));
    }
}
