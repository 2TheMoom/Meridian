// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MeridianKeel} from "../src/MeridianKeel.sol";

/// @notice Deploys MeridianKeel. The broadcasting key becomes `owner` —
///         limited to pausing new deposits and updating the allowlist
///         pointer, never a path to user funds (see MeridianKeel.sol). If
///         the deploying key shouldn't hold that role long-term, transfer it
///         afterward:
///         `cast send <address> "transferOwnership(address)" <newOwner> --rpc-url monad --account <name>`
/// @dev    Takes no key from the environment — the broadcaster is whatever
///         `forge script` is invoked with (`--account <keystore>`, the
///         recommended path; see contracts/README.md). This deliberately
///         avoids a plaintext PRIVATE_KEY env var for a mainnet deployer key.
contract DeployMeridianKeel is Script {
    function run() external returns (MeridianKeel keel) {
        vm.startBroadcast();
        keel = new MeridianKeel();
        vm.stopBroadcast();

        console.log("MeridianKeel deployed to:", address(keel));
        console.log("Owner:", keel.owner());
    }
}
