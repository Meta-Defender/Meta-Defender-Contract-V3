//SPDX-License-Identifier: ISC
pragma solidity 0.8.9;

import "hardhat/console.sol";

// Libraries
import "./Lib/SafeDecimalMath.sol";

// Inherited
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./interfaces/ILiquidityCertificate.sol";

/**
 * @title LiquidityCertificate
 * @author MetaDefender
 * @dev An ERC721 token which represents a share of the LiquidityPool.
 * It is minted when users provide, and burned when users withdraw.
 */
contract LiquidityCertificate is ILiquidityCertificate, ERC721Enumerable {
    using SafeMath for uint;
    using SafeDecimalMath for uint;

    /// @dev The minimum amount of liquidity a certificate can be minted with.
    uint public constant override MIN_LIQUIDITY = 1e18;

    uint internal nextId;
    mapping(uint => CertificateInfo) internal _certificateInfo;
    address public override metaDefender;
    address public override protocol;
    uint public override totalValidCertificateLiquidity;
    uint public override totalPendingEntranceCertificateLiquidity;
    uint public override totalPendingExitCertificateLiquidity;
    bool internal initialized = false;

    /**
     * @param _name Token collection name
   * @param _symbol Token collection symbol
   */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    /**
     * @dev Initialize the contract.
   * @param _metaDefender MetaDefender address.
   * @param _protocol Protocol address.
   */
    function init(address _metaDefender, address _protocol) external {
        require(_metaDefender != address(0), "liquidityPool cannot be 0 address");
        require(!initialized, "already initialized");
        metaDefender = _metaDefender;
        protocol = _protocol;
        initialized = true;
    }

    /**
     * @dev Returns all the certificates own by a given address.
   *
   * @param owner The owner of the certificates
   */
    function getLiquidityProviders(address owner) external view override returns (uint[] memory) {
        uint numCerts = balanceOf(owner);
        uint[] memory ids = new uint[](numCerts);

        for (uint i = 0; i < numCerts; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }

        return ids;
    }

    /**
     * @notice Returns certificate's `liquidity`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
    function getLiquidity(uint certificateId) external view override returns (uint) {
        return _certificateInfo[certificateId].liquidity;
    }

    /**
     * @notice Returns certificate's `enteredAt`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
    function getEpoch(uint certificateId) external view override returns (uint) {
        return _certificateInfo[certificateId].enteredEpoch;
    }


    /**
     * @notice Returns a certificate's data.
   *
   * @param certificateId The id of the LiquidityProvider.
   */
    function getCertificateInfo(uint certificateId)
    external
    view
    override
    returns (ILiquidityCertificate.CertificateInfo memory)
    {
        require(_certificateInfo[certificateId].enteredEpoch!= 0, "certificate does not exist");
        return _certificateInfo[certificateId];
    }

    /**
     * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function updateRewardDebtEpochIndex(uint certificateId, uint64 currentEpochIndex) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].rewardDebtEpochIndex = currentEpochIndex;
    }

    /**
    * @dev updates the reward debt when a provider claims his/her rewards.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function updateSPSLocked(uint certificateId, uint SPSLocked) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        _certificateInfo[certificateId].SPSLocked= SPSLocked;
    }

    /**
     * @dev find out which address is this certificate belongs to.
    *
    * @param certificateId The id of the LiquidityProvider.
    */
    function belongsTo(uint certificateId) external view returns (address) {
        return ownerOf(certificateId);
    }

    /**
     * @dev Mints a new certificate and transfers it to `owner`.
   *
   * @param owner The account that will own the LiquidityCertificate.
   * @param liquidity The amount of liquidity that has been deposited.
   * @param rewardDebt The past reward of the provider when enter the system.
   * @param shadowDebt The past shadow of the provider when enter the system.
   */
    function mint(
        address owner,
        uint enteredEpochIndex,
        uint liquidity
    ) external override returns (uint) {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }

        if (liquidity < MIN_LIQUIDITY){
            revert InsufficientLiquidity();
        }

        uint certificateId = nextId++;
        _certificateInfo[certificateId] = CertificateInfo(enteredEpochIndex, 0, liquidity, true);
        // add totalLiquidity.
        totalPendingEntranceCertificateLiquidity = totalPendingEntranceCertificateLiquidity.add(liquidity);
        _mint(owner, certificateId);

        emit NewLPMinted(owner,certificateId,enteredEpochIndex,liquidity);
        return certificateId;
    }

    /**
     * @notice Burns the LiquidityCertificate.
   *
   * @param spender The account which is performing the burn.
   * @param certificateId The id of the LiquidityCertificate.
   */
    function expire(address spender, uint certificateId) external override {
        if (msg.sender != metaDefender) {
            revert InsufficientPrivilege();
        }
        require(_isApprovedOrOwner(spender, certificateId), "attempted to burn nonexistent certificate, or not owner");
        // remove liquidity from totalCertificateLiquidity.
        totalPendingExitCertificateLiquidity = totalPendingExitCertificateLiquidity.add(_certificateInfo[certificateId].liquidity);
        _certificateInfo[certificateId].isValid = false;

        emit Expired(certificateId);
    }

    function newEpochCreated() external override {
        // when the new epoch created
        totalValidCertificateLiquidity = totalValidCertificateLiquidity.add(totalPendingEntranceCertificateLiquidity).sub(totalPendingExitCertificateLiquidity);
        totalPendingExitCertificateLiquidity = 0;
        totalPendingExitCertificateLiquidity = 0;
    }

    error InsufficientPrivilege();
    error InsufficientLiquidity();

    event NewLPMinted(address owner, uint certificateId, uint enteredEpochIndex, uint liquidity);
    event Expired(uint certificateId);
}
