// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MeridianKeel} from "../../src/MeridianKeel.sol";

/// @notice Has no payable receive/fallback, so any plain ETH transfer to it
///         fails — used to exercise MeridianKeel's `require(ok, "transfer
///         failed")` paths. Can still initiate outbound calls (deposit,
///         request/execute emergency withdrawal) to exercise the failure
///         path where a vault's own owner can't receive its payout.
contract RejectingReceiver {
    MeridianKeel public immutable keel;

    constructor(MeridianKeel _keel) {
        keel = _keel;
    }

    function deposit() external payable {
        keel.deposit{value: msg.value}();
    }

    function requestEmergencyWithdrawal() external {
        keel.requestEmergencyWithdrawal();
    }

    function executeEmergencyWithdrawal() external {
        keel.executeEmergencyWithdrawal();
    }
}
