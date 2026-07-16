// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MeridianKeel} from "../src/MeridianKeel.sol";
import {ReentrantAttacker} from "./helpers/ReentrantAttacker.sol";
import {RejectingReceiver} from "./helpers/RejectingReceiver.sol";

contract MeridianKeelTest is Test {
    MeridianKeel keel;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        keel = new MeridianKeel();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ---------- Deposits ----------

    function test_deposit_increasesBalance() public {
        vm.prank(alice);
        keel.deposit{value: 5 ether}();
        (uint256 balance,,,) = keel.vaults(alice);
        assertEq(balance, 5 ether);
    }

    function test_deposit_revertsWhenPaused() public {
        keel.setDepositsPaused(true);
        vm.prank(alice);
        vm.expectRevert("deposits paused");
        keel.deposit{value: 1 ether}();
    }

    function test_deposit_revertsOnZeroValue() public {
        vm.prank(alice);
        vm.expectRevert("zero deposit");
        keel.deposit{value: 0}();
    }

    // ---------- Daily cap ----------

    function test_setDailyCap_decreaseIsInstant() public {
        vm.startPrank(alice);
        _setCapImmediate(10 ether); // helper walks the initial increase through its timelock
        keel.setDailyCap(3 ether);
        vm.stopPrank();

        (, uint256 cap,,) = keel.vaults(alice);
        assertEq(cap, 3 ether);
    }

    function test_setDailyCap_increaseIsTimelocked() public {
        vm.startPrank(alice);
        keel.setDailyCap(10 ether);
        (, uint256 capBefore,,) = keel.vaults(alice);
        assertEq(capBefore, 0, "cap must not change before the timelock resolves");

        vm.expectRevert("still locked");
        keel.executeCapIncrease();

        vm.warp(block.timestamp + 24 hours);
        keel.executeCapIncrease();
        vm.stopPrank();

        (, uint256 capAfter,,) = keel.vaults(alice);
        assertEq(capAfter, 10 ether);
    }

    function test_cancelCapIncrease() public {
        vm.startPrank(alice);
        keel.setDailyCap(10 ether);
        keel.cancelCapIncrease();

        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert("no pending change");
        keel.executeCapIncrease();
        vm.stopPrank();
    }

    function test_cancelCapIncrease_revertsWhenNothingPending() public {
        vm.prank(alice);
        vm.expectRevert("no pending change");
        keel.cancelCapIncrease();
    }

    function test_executeCapIncrease_revertsWhenNothingPending() public {
        vm.prank(alice);
        vm.expectRevert("no pending change");
        keel.executeCapIncrease();
    }

    // ---------- Spending within cap ----------

    function test_spend_withinCap_executesInstantly() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(5 ether);

        uint256 bobBefore = bob.balance;
        keel.spend(bob, 2 ether);
        vm.stopPrank();

        assertEq(bob.balance, bobBefore + 2 ether);
        (uint256 balance,, uint256 spent,) = keel.vaults(alice);
        assertEq(balance, 8 ether);
        assertEq(spent, 2 ether);
    }

    function test_spend_revertsOnInsufficientBalance() public {
        vm.startPrank(alice);
        keel.deposit{value: 1 ether}();
        _setCapImmediate(5 ether);
        vm.expectRevert("insufficient balance");
        keel.spend(bob, 2 ether);
        vm.stopPrank();
    }

    function test_spend_revertsOnZeroAddressRecipient() public {
        vm.startPrank(alice);
        keel.deposit{value: 1 ether}();
        _setCapImmediate(5 ether);
        vm.expectRevert("bad recipient");
        keel.spend(address(0), 1 ether);
        vm.stopPrank();
    }

    function test_spend_revertsOnZeroAmount() public {
        vm.startPrank(alice);
        keel.deposit{value: 1 ether}();
        _setCapImmediate(5 ether);
        vm.expectRevert("zero amount");
        keel.spend(bob, 0);
        vm.stopPrank();
    }

    function test_spend_instantPath_revertsAndRollsBackOnTransferFailure() public {
        RejectingReceiver rejecting = new RejectingReceiver(keel);
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(5 ether);

        vm.expectRevert("transfer failed");
        keel.spend(address(rejecting), 2 ether);
        vm.stopPrank();

        // The whole call must revert, not just the transfer — balance and
        // spentInWindow must be exactly as before the attempt.
        (uint256 balance,, uint256 spent,) = keel.vaults(alice);
        assertEq(balance, 10 ether);
        assertEq(spent, 0);
    }

    function test_executeSpend_revertsAndPreservesResolvedFlagOnTransferFailure() public {
        RejectingReceiver rejecting = new RejectingReceiver(keel);
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(address(rejecting), 5 ether); // queues, over cap

        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert("transfer failed");
        keel.executeSpend(0);

        // A reverted executeSpend must not have marked the pending spend
        // resolved — the user can still fall back to cancelSpend to reclaim
        // the reserved funds (there's no way to retry with a new recipient).
        keel.cancelSpend(0);
        vm.stopPrank();

        (uint256 balance,,,) = keel.vaults(alice);
        assertEq(balance, 10 ether);
    }

    function test_spend_atCapBoundaryStillInstant() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(5 ether);
        keel.spend(bob, 5 ether); // exactly at cap
        vm.stopPrank();

        (,, uint256 spent,) = keel.vaults(alice);
        assertEq(spent, 5 ether);
    }

    function test_spend_windowRollsOverAfter24Hours() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(5 ether);
        keel.spend(bob, 5 ether);

        vm.warp(block.timestamp + 24 hours + 1);
        keel.spend(bob, 5 ether); // should succeed instantly again, window reset
        vm.stopPrank();

        (,, uint256 spent,) = keel.vaults(alice);
        assertEq(spent, 5 ether);
    }

    // ---------- Spending over cap (queued) ----------

    function test_spend_overCap_queuesAndReservesBalance() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);

        keel.spend(bob, 5 ether); // over cap
        vm.stopPrank();

        (uint256 balance,, uint256 spent,) = keel.vaults(alice);
        assertEq(balance, 5 ether, "reserved amount must leave available balance");
        assertEq(spent, 0, "queued spend must not count against the instant-spend window");
    }

    function test_executeSpend_revertsBeforeUnlock() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);

        vm.expectRevert("still locked");
        keel.executeSpend(0);
        vm.stopPrank();
    }

    function test_executeSpend_succeedsAfterUnlock() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);

        vm.warp(block.timestamp + 24 hours);
        uint256 bobBefore = bob.balance;
        keel.executeSpend(0);
        vm.stopPrank();

        assertEq(bob.balance, bobBefore + 5 ether);
    }

    function test_executeSpend_revertsForWrongUser() public {
        vm.prank(alice);
        keel.deposit{value: 10 ether}();
        _setCapAs(alice, 1 ether);
        vm.prank(alice);
        keel.spend(bob, 5 ether);

        vm.warp(block.timestamp + 24 hours);
        vm.prank(bob);
        vm.expectRevert("not your spend");
        keel.executeSpend(0);
    }

    function test_executeSpend_revertsOnDoubleExecute() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);
        vm.warp(block.timestamp + 24 hours);
        keel.executeSpend(0);

        vm.expectRevert("already resolved");
        keel.executeSpend(0);
        vm.stopPrank();
    }

    function test_cancelSpend_refundsReservedBalance() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);

        keel.cancelSpend(0);
        vm.stopPrank();

        (uint256 balance,,,) = keel.vaults(alice);
        assertEq(balance, 10 ether, "cancelling must fully refund the reserved amount");
    }

    function test_cancelSpend_thenExecuteReverts() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);
        keel.cancelSpend(0);

        vm.warp(block.timestamp + 24 hours);
        vm.expectRevert("already resolved");
        keel.executeSpend(0);
        vm.stopPrank();
    }

    function test_cancelSpend_revertsForWrongUser() public {
        vm.prank(alice);
        keel.deposit{value: 10 ether}();
        _setCapAs(alice, 1 ether);
        vm.prank(alice);
        keel.spend(bob, 5 ether);

        vm.prank(bob);
        vm.expectRevert("not your spend");
        keel.cancelSpend(0);
    }

    function test_cancelSpend_revertsOnDoubleCancel() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 5 ether);
        keel.cancelSpend(0);

        vm.expectRevert("already resolved");
        keel.cancelSpend(0);
        vm.stopPrank();
    }

    // ---------- Emergency withdrawal ----------

    function test_emergencyWithdrawal_revertsBeforeDelay() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        keel.requestEmergencyWithdrawal();

        vm.expectRevert("still locked");
        keel.executeEmergencyWithdrawal();
        vm.stopPrank();
    }

    function test_emergencyWithdrawal_succeedsAfterDelay() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        keel.requestEmergencyWithdrawal();

        vm.warp(block.timestamp + 12 hours);
        uint256 aliceBefore = alice.balance;
        keel.executeEmergencyWithdrawal();
        vm.stopPrank();

        assertEq(alice.balance, aliceBefore + 10 ether);
        (uint256 balance,,,) = keel.vaults(alice);
        assertEq(balance, 0);
    }

    function test_emergencyWithdrawal_onlyWithdrawsAvailableBalance_notReservedSpends() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        _setCapImmediate(1 ether);
        keel.spend(bob, 6 ether); // queues, reserves 6 ether, leaves 4 available

        keel.requestEmergencyWithdrawal();
        vm.warp(block.timestamp + 12 hours);
        uint256 aliceBefore = alice.balance;
        keel.executeEmergencyWithdrawal();
        vm.stopPrank();

        assertEq(alice.balance, aliceBefore + 4 ether, "only the unreserved balance should be withdrawable");
    }

    function test_cancelEmergencyWithdrawal() public {
        vm.startPrank(alice);
        keel.deposit{value: 10 ether}();
        keel.requestEmergencyWithdrawal();
        keel.cancelEmergencyWithdrawal();

        vm.warp(block.timestamp + 12 hours);
        vm.expectRevert("not requested");
        keel.executeEmergencyWithdrawal();
        vm.stopPrank();
    }

    function test_emergencyWithdrawal_revertsWithNothingToWithdraw() public {
        vm.startPrank(alice);
        keel.requestEmergencyWithdrawal();
        vm.warp(block.timestamp + 12 hours);
        vm.expectRevert("nothing to withdraw");
        keel.executeEmergencyWithdrawal();
        vm.stopPrank();
    }

    function test_executeEmergencyWithdrawal_revertsWhenNeverRequested() public {
        vm.prank(alice);
        vm.expectRevert("not requested");
        keel.executeEmergencyWithdrawal();
    }

    function test_cancelEmergencyWithdrawal_revertsWhenNeverRequested() public {
        vm.prank(alice);
        vm.expectRevert("not requested");
        keel.cancelEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_revertsAndPreservesStateOnTransferFailure() public {
        RejectingReceiver rejecting = new RejectingReceiver(keel);
        rejecting.deposit{value: 10 ether}();
        rejecting.requestEmergencyWithdrawal();

        vm.warp(block.timestamp + 12 hours);
        vm.expectRevert("transfer failed");
        rejecting.executeEmergencyWithdrawal();

        // A reverted payout must not have zeroed the balance or cleared the
        // request — both should be exactly as they were, so a fixed
        // (payable) owner could still retry via a fresh request if needed.
        (uint256 balance,,,) = keel.vaults(address(rejecting));
        assertEq(balance, 10 ether);
        (, bool requested) = keel.pendingEmergencyWithdrawals(address(rejecting));
        assertTrue(requested);
    }

    // ---------- Owner powers (no fund custody) ----------

    function test_onlyOwner_canPauseDeposits() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        keel.setDepositsPaused(true);
    }

    function test_onlyOwner_canSetAllowlistPointer() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        keel.setAllowlistPointer(bytes32(uint256(1)));

        keel.setAllowlistPointer(bytes32(uint256(1)));
        assertEq(keel.allowlistPointer(), bytes32(uint256(1)));
    }

    function test_transferOwnership_onlyOwnerAndNonZero() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        keel.transferOwnership(alice);

        vm.expectRevert("zero address");
        keel.transferOwnership(address(0));

        keel.transferOwnership(alice);
        assertEq(keel.owner(), alice);
    }

    function test_pausedDeposits_doNotBlockSpendingOrWithdrawal() public {
        vm.prank(alice);
        keel.deposit{value: 10 ether}();
        keel.setDepositsPaused(true);

        vm.startPrank(alice);
        keel.requestEmergencyWithdrawal();
        vm.warp(block.timestamp + 12 hours);
        keel.executeEmergencyWithdrawal(); // must still work — pause only blocks new deposits
        vm.stopPrank();
    }

    // ---------- Reentrancy ----------

    function test_reentrancy_blockedOnSpend() public {
        ReentrantAttacker attacker = new ReentrantAttacker(keel);
        vm.deal(address(attacker), 10 ether);

        attacker.deposit{value: 10 ether}();
        vm.prank(address(attacker));
        keel.setDailyCap(5 ether);
        vm.warp(block.timestamp + 24 hours);
        vm.prank(address(attacker));
        keel.executeCapIncrease();

        attacker.setMode(1, 0); // re-enter spend() from receive()
        attacker.spend(address(attacker), 1 ether);

        assertTrue(attacker.reentryReverted(), "reentrant spend() call must revert");
    }

    function test_reentrancy_blockedAcrossFunctions_duringExecuteSpend() public {
        ReentrantAttacker attacker = new ReentrantAttacker(keel);
        vm.deal(address(attacker), 10 ether);

        attacker.deposit{value: 10 ether}();
        // Cap stays at 0, so any spend queues (over-cap path) — exercises executeSpend's callback.
        attacker.spend(address(attacker), 5 ether);

        vm.warp(block.timestamp + 24 hours);
        attacker.setMode(3, 0); // during executeSpend's payout, try to reenter executeEmergencyWithdrawal
        attacker.requestEmergencyWithdrawal();
        vm.warp(block.timestamp + 12 hours);
        attacker.executeSpend(0);

        assertTrue(attacker.reentryReverted(), "cross-function reentrancy must be blocked by the shared lock");
    }

    // ---------- Fund conservation ----------

    function test_contractBalance_matchesSumOfVaultBalances() public {
        vm.prank(alice);
        keel.deposit{value: 7 ether}();
        vm.prank(bob);
        keel.deposit{value: 3 ether}();

        _setCapAs(alice, 2 ether);
        vm.prank(alice);
        keel.spend(bob, 1 ether); // instant, leaves the contract

        (uint256 aliceBalance,,,) = keel.vaults(alice);
        (uint256 bobBalance,,,) = keel.vaults(bob);
        assertEq(address(keel).balance, aliceBalance + bobBalance);
    }

    // ---------- Helpers ----------

    /// @dev Walks a cap increase through its full timelock for the pranked
    ///      caller, leaving `vm.prank`/`vm.startPrank` state as it found it.
    function _setCapImmediate(uint256 newCap) internal {
        keel.setDailyCap(newCap);
        vm.warp(block.timestamp + 24 hours);
        keel.executeCapIncrease();
    }

    function _setCapAs(address user, uint256 newCap) internal {
        vm.startPrank(user);
        keel.setDailyCap(newCap);
        vm.warp(block.timestamp + 24 hours);
        keel.executeCapIncrease();
        vm.stopPrank();
    }
}
