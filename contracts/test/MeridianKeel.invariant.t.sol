// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MeridianKeel} from "../src/MeridianKeel.sol";
import {MeridianKeelHandler} from "./handlers/MeridianKeelHandler.sol";

/// @notice Fuzzes long, randomized sequences of every state-changing
///         MeridianKeel function across multiple actors and randomized time
///         warps, and checks fund conservation holds after every single
///         call — not just the hand-picked scenarios in MeridianKeel.t.sol.
///         MeridianKeel.t.sol proves the contract does what we expect on
///         cases we thought to write down; this is what actually tries to
///         break it, on sequences nobody wrote down.
contract MeridianKeelInvariantTest is Test {
    MeridianKeel keel;
    MeridianKeelHandler handler;

    function setUp() public {
        keel = new MeridianKeel();
        handler = new MeridianKeelHandler(keel);
        targetContract(address(handler));
    }

    /// @notice The contract's own ETH balance must always equal every
    ///         actor's tracked vault balance plus every still-unresolved
    ///         queued spend's reserved amount. deposit() is the only
    ///         payable function and the contract has no receive/fallback,
    ///         so — barring a force-fed selfdestruct transfer, an
    ///         unavoidable EVM-level edge case no contract can prevent and
    ///         which could only ever inflate the balance, never cause a
    ///         shortfall — this must hold exactly after any sequence of
    ///         calls the fuzzer finds. If it doesn't, money was either
    ///         created or vanished somewhere in that sequence.
    function invariant_fundConservation() public view {
        uint256 sum;
        uint256 actorCount = handler.actorsCount();
        for (uint256 i = 0; i < actorCount; i++) {
            (uint256 balance,,,) = keel.vaults(handler.actors(i));
            sum += balance;
        }

        uint256 spendCount = keel.nextSpendId();
        for (uint256 i = 0; i < spendCount; i++) {
            (,, uint256 amount,, bool resolved) = keel.pendingSpends(i);
            if (!resolved) sum += amount;
        }

        assertEq(
            address(keel).balance,
            sum,
            "contract balance drifted from tracked vault balances + reserved pending-spend amounts"
        );
    }

    // A first version of this file also asserted spentInWindow <= dailyCap
    // for every actor at every check. The fuzzer broke it within seconds:
    // raise your cap, spend a lot (correctly instant, within the then-high
    // cap), then decrease your cap below what you've already spent this
    // window. spentInWindow now legitimately exceeds dailyCap. Traced
    // through spend()'s own check, that's not exploitable — it only forces
    // every further spend() this window onto the timelocked over-cap path,
    // never the reverse — but it did mean the invariant I wrote down was
    // simply wrong, not that the contract was. Removed here; the real fix
    // is setDailyCap's NatSpec plus
    // test_setDailyCap_decreaseBelowSpentInWindow_forcesQueuedPathForRestOfWindow
    // in MeridianKeel.t.sol, which pin the actual (safe) behavior down
    // explicitly instead of asserting a property that doesn't hold.
}
