// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {UltraVerifier} from "../circuit/target/contract.sol";
import {Starter} from "../src/Starter.sol";

contract StarterScript is Script {
    function setUp() public {}

    function run() public {
        // Ajouter "0x" à la clé privée
        uint256 deployerPrivateKey = vm.envUint("SEPOLIA_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Déployer d'abord le vérificateur
        UltraVerifier verifier = new UltraVerifier();
        console.log("UltraVerifier deployed at:", address(verifier));

        // Puis déployer le contrat Starter avec l'adresse du vérificateur
        Starter starter = new Starter(verifier);
        console.log("Starter deployed at:", address(starter));

        vm.stopBroadcast();
    }
}
