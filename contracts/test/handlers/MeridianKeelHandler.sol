// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MeridianKeel} from "../../src/MeridianKeel.sol";

/// @notice Bounded, valid-input entry points for MeridianKeel's invariant
///         fuzzer. Every function here is something a real (if reckless)
///         user could actually call — bad inputs are clamped with `bound()`
///         or swallowed with `try/catch` rather than reverting the whole
///         run, so the fuzzer spends its budget exploring which *sequence*
///         of legitimate calls breaks an invariant, not rediscovering that
///         the ABI rejects malformed input.
contract MeridianKeelHandler is CommonBase, StdCheats, StdUtils {
    MeridianKeel public keel;

    address[] public actors;
    // Every spend id the queued (over-cap) path has ever created, so the
    // fuzzer can pick real ids to execute/cancel instead of only ever
    // hitting "no pending change"/"not your spend" reverts on garbage ids.
    uint256[] public spendIds;

    constructor(MeridianKeel _keel) {
        keel = _keel;
        for (uint256 i = 0; i < 4; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("meridian-keel-actor", i)))));
            actors.push(actor);
            vm.deal(actor, 1_000_000 ether);
        }
    }

    function actorsCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address user = _actor(actorSeed);
        amount = bound(amount, 1, 1_000 ether);
        vm.prank(user);
        keel.deposit{value: amount}();
    }

    function setDailyCap(uint256 actorSeed, uint256 newCap) external {
        address user = _actor(actorSeed);
        newCap = bound(newCap, 0, 1_000_000 ether);
        vm.prank(user);
        keel.setDailyCap(newCap);
    }

    function executeCapIncrease(uint256 actorSeed) external {
        address user = _actor(actorSeed);
        vm.prank(user);
        try keel.executeCapIncrease() {} catch {}
    }

    function cancelCapIncrease(uint256 actorSeed) external {
        address user = _actor(actorSeed);
        vm.prank(user);
        try keel.cancelCapIncrease() {} catch {}
    }

    function spend(uint256 actorSeed, uint256 toSeed, uint256 amount) external {
        address user = _actor(actorSeed);
        address to = _actor(toSeed);
        (uint256 balance,,,) = keel.vaults(user);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);

        uint256 idBefore = keel.nextSpendId();
        vm.prank(user);
        try keel.spend(to, amount) {
            // Only the queued (over-cap) path advances nextSpendId — the
            // instant path takes no id at all.
            if (keel.nextSpendId() > idBefore) spendIds.push(idBefore);
        } catch {}
    }

    function executeSpend(uint256 idSeed) external {
        if (spendIds.length == 0) return;
        uint256 id = spendIds[bound(idSeed, 0, spendIds.length - 1)];
        (address user,,,,) = keel.pendingSpends(id);
        vm.prank(user);
        try keel.executeSpend(id) {} catch {}
    }

    function cancelSpend(uint256 idSeed) external {
        if (spendIds.length == 0) return;
        uint256 id = spendIds[bound(idSeed, 0, spendIds.length - 1)];
        (address user,,,,) = keel.pendingSpends(id);
        vm.prank(user);
        try keel.cancelSpend(id) {} catch {}
    }

    function requestEmergencyWithdrawal(uint256 actorSeed) external {
        address user = _actor(actorSeed);
        vm.prank(user);
        keel.requestEmergencyWithdrawal();
    }

    function executeEmergencyWithdrawal(uint256 actorSeed) external {
        address user = _actor(actorSeed);
        vm.prank(user);
        try keel.executeEmergencyWithdrawal() {} catch {}
    }

    function cancelEmergencyWithdrawal(uint256 actorSeed) external {
        address user = _actor(actorSeed);
        vm.prank(user);
        try keel.cancelEmergencyWithdrawal() {} catch {}
    }

    // Lets timelocks (cap increase, over-cap spend, emergency withdrawal)
    // actually resolve at unpredictable points during a fuzzed run, instead
    // of the fuzzer only ever seeing the "still locked" revert path.
    function warp(uint256 secondsSeed) external {
        uint256 delta = bound(secondsSeed, 0, 30 hours);
        vm.warp(block.timestamp + delta);
    }
}
