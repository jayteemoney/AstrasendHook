// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IPhoneNumberResolver } from "../interfaces/IPhoneNumberResolver.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PhoneNumberResolver
/// @notice Resolves phone numbers to wallet addresses for remittances.
///         Users self-register their own phone. Admins can register/manage on behalf of users.
/// @author dev_jaytee
contract PhoneNumberResolver is IPhoneNumberResolver, Ownable {
    // ============ State Variables ============

    /// @notice Mapping of phone number hash to wallet address
    mapping(bytes32 => address) public phoneToAddress;

    /// @notice Mapping of address to phone hash (reverse lookup)
    mapping(address => bytes32) public addressToPhone;

    /// @notice Check if a phone number is registered
    mapping(bytes32 => bool) private _isRegistered;

    /// @notice Addresses granted admin rights (can register/unregister on behalf of users)
    mapping(address => bool) public admins;

    // ============ Events ============

    event PhoneRegistered(bytes32 indexed phoneHash, address indexed wallet);
    event PhoneUnregistered(bytes32 indexed phoneHash, address indexed wallet);
    event PhoneUpdated(bytes32 indexed phoneHash, address indexed oldWallet, address indexed newWallet);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    // ============ Errors ============

    error InvalidWallet();
    error PhoneAlreadyRegistered();
    error PhoneNotRegistered();
    error WalletAlreadyHasPhone();
    error LengthMismatch();
    error NotAuthorized();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) { }

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (msg.sender != owner() && !admins[msg.sender]) revert NotAuthorized();
        _;
    }

    // ============ Owner Functions — Role Management ============

    /// @notice Grant admin rights to an address
    function addAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert InvalidWallet();
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    /// @notice Revoke admin rights from an address
    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    // ============ Self-Registration — Any User ============

    /// @notice Register your own phone number to your wallet.
    ///         Caller must be the wallet being registered.
    /// @param phoneNumber The phone number string (e.g. "+254712345678")
    function registerPhoneString(string calldata phoneNumber, address wallet) external {
        // Allow self-registration or admin registration
        if (msg.sender != wallet && msg.sender != owner() && !admins[msg.sender]) {
            revert NotAuthorized();
        }
        if (wallet == address(0)) revert InvalidWallet();

        bytes32 phoneHash = keccak256(abi.encodePacked(phoneNumber));

        if (_isRegistered[phoneHash]) revert PhoneAlreadyRegistered();
        if (addressToPhone[wallet] != bytes32(0)) revert WalletAlreadyHasPhone();

        phoneToAddress[phoneHash] = wallet;
        addressToPhone[wallet] = phoneHash;
        _isRegistered[phoneHash] = true;

        emit PhoneRegistered(phoneHash, wallet);
    }

    /// @notice Update your wallet for an existing phone registration.
    ///         Caller must be the current wallet, or an admin.
    /// @param newWallet The new wallet address to associate
    function updateMyWallet(address newWallet) external {
        bytes32 phoneHash = addressToPhone[msg.sender];
        if (phoneHash == bytes32(0)) revert PhoneNotRegistered();
        if (newWallet == address(0)) revert InvalidWallet();
        if (addressToPhone[newWallet] != bytes32(0)) revert WalletAlreadyHasPhone();

        address oldWallet = msg.sender;
        delete addressToPhone[oldWallet];

        phoneToAddress[phoneHash] = newWallet;
        addressToPhone[newWallet] = phoneHash;

        emit PhoneUpdated(phoneHash, oldWallet, newWallet);
    }

    /// @notice Unregister your own phone number.
    function unregisterMyPhone() external {
        bytes32 phoneHash = addressToPhone[msg.sender];
        if (phoneHash == bytes32(0)) revert PhoneNotRegistered();

        delete phoneToAddress[phoneHash];
        delete addressToPhone[msg.sender];
        _isRegistered[phoneHash] = false;

        emit PhoneUnregistered(phoneHash, msg.sender);
    }

    // ============ Admin Functions — Manage Others ============

    /// @notice Register a phone hash directly to a wallet (admin use, e.g. batch onboarding)
    function registerPhone(bytes32 phoneHash, address wallet) external onlyAdmin {
        if (wallet == address(0)) revert InvalidWallet();
        if (_isRegistered[phoneHash]) revert PhoneAlreadyRegistered();
        if (addressToPhone[wallet] != bytes32(0)) revert WalletAlreadyHasPhone();

        phoneToAddress[phoneHash] = wallet;
        addressToPhone[wallet] = phoneHash;
        _isRegistered[phoneHash] = true;

        emit PhoneRegistered(phoneHash, wallet);
    }

    /// @notice Batch register multiple phone numbers
    function batchRegister(bytes32[] calldata phoneHashes, address[] calldata wallets) external onlyAdmin {
        if (phoneHashes.length != wallets.length) revert LengthMismatch();

        for (uint256 i = 0; i < phoneHashes.length; i++) {
            if (wallets[i] == address(0)) continue;
            if (_isRegistered[phoneHashes[i]]) continue;
            if (addressToPhone[wallets[i]] != bytes32(0)) continue;

            phoneToAddress[phoneHashes[i]] = wallets[i];
            addressToPhone[wallets[i]] = phoneHashes[i];
            _isRegistered[phoneHashes[i]] = true;

            emit PhoneRegistered(phoneHashes[i], wallets[i]);
        }
    }

    /// @notice Unregister any phone number (admin — e.g. fraud removal)
    function unregisterPhone(bytes32 phoneHash) external onlyAdmin {
        if (!_isRegistered[phoneHash]) revert PhoneNotRegistered();

        address wallet = phoneToAddress[phoneHash];
        delete phoneToAddress[phoneHash];
        delete addressToPhone[wallet];
        _isRegistered[phoneHash] = false;

        emit PhoneUnregistered(phoneHash, wallet);
    }

    /// @notice Update wallet for any phone registration (admin)
    function updatePhoneWallet(bytes32 phoneHash, address newWallet) external onlyAdmin {
        if (!_isRegistered[phoneHash]) revert PhoneNotRegistered();
        if (newWallet == address(0)) revert InvalidWallet();
        if (addressToPhone[newWallet] != bytes32(0)) revert WalletAlreadyHasPhone();

        address oldWallet = phoneToAddress[phoneHash];
        delete addressToPhone[oldWallet];

        phoneToAddress[phoneHash] = newWallet;
        addressToPhone[newWallet] = phoneHash;

        emit PhoneUpdated(phoneHash, oldWallet, newWallet);
    }

    // ============ IPhoneNumberResolver Implementation ============

    /// @inheritdoc IPhoneNumberResolver
    function resolve(bytes32 phoneHash) external view override returns (address wallet) {
        return phoneToAddress[phoneHash];
    }

    /// @inheritdoc IPhoneNumberResolver
    function computePhoneHash(string calldata phoneNumber) external pure override returns (bytes32) {
        return keccak256(abi.encodePacked(phoneNumber));
    }

    /// @inheritdoc IPhoneNumberResolver
    function isRegistered(bytes32 phoneHash) external view override returns (bool) {
        return _isRegistered[phoneHash];
    }

    /// @inheritdoc IPhoneNumberResolver
    function hasPhone(address wallet) external view override returns (bool) {
        return addressToPhone[wallet] != bytes32(0);
    }

    /// @inheritdoc IPhoneNumberResolver
    function getPhoneHash(address wallet) external view override returns (bytes32) {
        return addressToPhone[wallet];
    }

    /// @notice Resolve using raw phone number string
    function resolveString(string calldata phoneNumber) external view returns (address wallet) {
        bytes32 phoneHash = keccak256(abi.encodePacked(phoneNumber));
        return phoneToAddress[phoneHash];
    }
}
