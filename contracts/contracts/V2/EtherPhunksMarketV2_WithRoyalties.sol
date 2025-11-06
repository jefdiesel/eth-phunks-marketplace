// SPDX-License-Identifier: PHUNKY

/**** EtherPhunksMarketV2_WithRoyalties.sol *
* Modified to support 1% royalties to parent TIC token owner
****************************/

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IPoints.sol";
import "./EthscriptionsEscrower.sol";

contract EtherPhunksMarketV2_WithRoyalties is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EthscriptionsEscrower
{
    bytes32 constant DEPOSIT_AND_LIST_SIGNATURE = 0x4445504f5349545f414e445f4c4953545f5349474e4154555245000000000000;

    uint256 public contractVersion;
    address public pointsAddress;

    struct Offer {
        bool isForSale;
        bytes32 phunkId;
        address seller;
        uint minValue;
        address onlySellTo;
    }

    struct Bid {
        bool hasBid;
        bytes32 phunkId;
        address bidder;
        uint value;
    }

    mapping(bytes32 => Offer) public phunksOfferedForSale;
    mapping(bytes32 => Bid) public phunkBids;
    mapping(address => uint) public pendingWithdrawalsV2;

    event PhunkOffered(
        bytes32 indexed phunkId,
        uint minValue,
        address indexed toAddress
    );
    event PhunkBidEntered(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress
    );
    event PhunkBidWithdrawn(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress
    );
    event PhunkBought(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress,
        address indexed toAddress
    );
    event PhunkNoLongerForSale(
      bytes32 indexed phunkId
    );
    event RoyaltyPaid(
        bytes32 indexed phunkId,
        address indexed royaltyRecipient,
        uint royaltyAmount
    );

    function initialize(
        uint256 _contractVersion,
        address _initialPointsAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        contractVersion = _contractVersion;
        pointsAddress = _initialPointsAddress;
    }

    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external nonReentrant {
        _offerPhunkForSale(phunkId, minSalePriceInWei);
    }

    function batchOfferPhunkForSale(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length,
            "Array lengths do not match"
        );

        for (uint i = 0; i < phunkIds.length; i++) {
            _offerPhunkForSale(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    function offerPhunkForSaleToAddress(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            unicode"That's not your Phunk 🖕"
        );

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    function _offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            unicode"That's not your Phunk 🖕"
        );

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0)
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    function phunkNoLongerForSale(bytes32 phunkId) external {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            unicode"That's not your Phunk 🖕"
        );

        _invalidateListing(phunkId);
    }

    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address parentOwner
    ) internal {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender,
            unicode"No Phunk for you 🖕"
        );

        address seller = offer.seller;

        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            msg.sender,
            0,
            address(0x0)
        );

        // Calculate 1% royalty for parent owner
        uint256 royalty = (minSalePriceInWei * 1) / 100;
        uint256 sellerAmount = minSalePriceInWei - royalty;

        pendingWithdrawalsV2[seller] += sellerAmount;
        
        if (parentOwner != address(0x0) && parentOwner != seller) {
            pendingWithdrawalsV2[parentOwner] += royalty;
            emit RoyaltyPaid(phunkId, parentOwner, royalty);
        } else {
            // If no parent owner or parent is seller, give full amount to seller
            pendingWithdrawalsV2[seller] += royalty;
        }

        _addPoints(seller, 100);

        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, minSalePriceInWei, seller, msg.sender);

        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder == msg.sender) {
            pendingWithdrawalsV2[msg.sender] += bid.value;
            phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
        }
    }

    function buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address parentOwner
    ) external payable whenNotPaused nonReentrant {
        require(msg.value == minSalePriceInWei, "Incorrect Ether sent");
        _buyPhunk(phunkId, minSalePriceInWei, parentOwner);
    }

    function batchBuyPhunk(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei,
        address[] calldata parentOwners
    ) external payable whenNotPaused nonReentrant {
        require(
            phunkIds.length == minSalePricesInWei.length &&
            phunkIds.length == parentOwners.length,
            "Array lengths do not match"
        );

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunk(phunkIds[i], minSalePricesInWei[i], parentOwners[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect total Ether sent");
    }

    function withdraw() public nonReentrant {
        require(
            pendingWithdrawalsV2[msg.sender] != 0,
            unicode"You're poor, Phunk 🖕"
        );

        uint amount = pendingWithdrawalsV2[msg.sender];

        pendingWithdrawalsV2[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function withdrawPhunk(bytes32 phunkId) public {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            unicode"That's not your Phunk 🖕"
        );

        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSale[phunkId];
        if (offer.isForSale) {
            _invalidateListing(phunkId);
        }
    }

    function withdrawBatchPhunks(bytes32[] calldata phunkIds) external {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunk(phunkIds[i]);
        }
    }

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        require(
            userCalldata.length % 32 == 0,
            "Invalid ethscription length"
        );

        for (uint256 i = 0; i < userCalldata.length / 32; i++) {
            bytes32 potentialEthscriptionId = abi.decode(slice(userCalldata, i * 32, 32), (bytes32));
            _offerPhunkForSale(potentialEthscriptionId, 0);
        }
    }

    function _invalidateListing(bytes32 phunkId) internal {
        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            address(0x0),
            0,
            address(0x0)
        );
        emit PhunkNoLongerForSale(phunkId);
    }

    function _addPoints(address phunk, uint256 amount) internal {
        IPoints pointsContract = IPoints(pointsAddress);
        pointsContract.addPoints(phunk, amount);
    }

    function setPointsAddress(address _pointsAddress) public onlyOwner {
        pointsAddress = _pointsAddress;
    }

    function slice(
        bytes calldata data,
        uint256 start,
        uint256 len
    ) private pure returns (bytes calldata) {
        return data[start:start + len];
    }
}
