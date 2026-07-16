// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MeridianKeel} from "../../src/MeridianKeel.sol";

/// @notice Attempts to re-enter MeridianKeel from its receive() hook, to
///         exercise the noReentrancy guard on spend/executeSpend/
///         executeEmergencyWithdrawal.
contract ReentrantAttacker {
    MeridianKeel public immutable keel;
    uint8 public mode; // 0 = none, 1 = re-enter spend, 2 = re-enter executeSpend, 3 = re-enter executeEmergencyWithdrawal
    uint256 public reenterSpendId;
    bool public reentryReverted;

    constructor(MeridianKeel _keel) {
        keel = _keel;
    }

    function setMode(uint8 _mode, uint256 _reenterSpendId) external {
        mode = _mode;
        reenterSpendId = _reenterSpendId;
    }

    function deposit() external payable {
        keel.deposit{value: msg.value}();
    }

    function spend(address to, uint256 amount) external {
        keel.spend(to, amount);
    }

    function executeSpend(uint256 id) external {
        keel.executeSpend(id);
    }

    function requestEmergencyWithdrawal() external {
        keel.requestEmergencyWithdrawal();
    }

    function executeEmergencyWithdrawal() external {
        keel.executeEmergencyWithdrawal();
    }

    receive() external payable {
        if (mode == 1) {
            mode = 0; // prevent infinite recursion in the test
            try keel.spend(address(this), 1) {
                reentryReverted = false;
            } catch {
                reentryReverted = true;
            }
        } else if (mode == 2) {
            mode = 0;
            try keel.executeSpend(reenterSpendId) {
                reentryReverted = false;
            } catch {
                reentryReverted = true;
            }
        } else if (mode == 3) {
            mode = 0;
            try keel.executeEmergencyWithdrawal() {
                reentryReverted = false;
            } catch {
                reentryReverted = true;
            }
        }
    }
}
