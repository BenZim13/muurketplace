// SPDX-License-Identifier: Apache-2.0
// Muurketplace — marketplace de genética élite en Hedera Smart Contract Service.
// Solo Testnet: este contrato se despliega y opera únicamente en Hedera Testnet
// (verificación pública vía HashScan Testnet). Precios en céntimos enteros USD
// para preservar el redondeo half-up a 2 decimales de la Spec 001 sin floats.
// Comentarios en español; código en inglés (identificadores camelCase donde aplica).
pragma solidity ^0.8.0;

// Listado de venta: precio tasado en céntimos, cantidad disponible en unidades
// mínimas (PAJ-BRAF enteras, BULL en diezmilésimas), porcentaje de regalía
// inmutable (sin setter: R-REV-03), beneficiario criador, vendedor del listado,
// referencia a la proof HCS VERIFIED de origen y bandera de cancelación.
contract Muurketplace {
    struct Listing {
        string bullId;
        string assetType;
        uint256 unitPriceCents;
        uint256 available;
        uint256 royaltyPct;
        address breeder;
        address seller;
        string proofTopicId;
        uint64 proofSeq;
        bool cancelled;
    }

    uint256 private nextListingId;
    uint256 private nextPurchaseId;
    mapping(uint256 => Listing) private listings;
    // Regalías pendientes de retiro por criador (RF-06).
    mapping(address => uint256) private pendingRoyalties;
    // Compras ya liquidadas: una marca por purchaseId impide el doble retiro (RF-06).
    mapping(bytes32 => bool) private settled;

    // Compra liquidada con reparto pactado (verificable en HashScan Testnet).
    event PurchaseSettled(
        bytes32 indexed purchaseId,
        uint256 indexed listingId,
        address indexed buyer,
        uint256 totalCents,
        uint256 royaltyCents,
        uint256 sellerCents
    );
    event ListingCreated(uint256 indexed listingId, string bullId, string proofTopicId);
    event RoyaltiesWithdrawn(address indexed breeder, uint256 amountCents);
    event ListingCancelled(uint256 indexed listingId);

    // Crea un listado verificado (RF-01): exige referencia de proof no vacía.
    // Acepta regalía 0% y 100% (ambos bordes válidos e inmutables tras crear).
    function createListing(
        string calldata bullId,
        string calldata assetType,
        uint256 unitPriceCents,
        uint256 quantityUnits,
        uint256 royaltyPct,
        address breeder,
        string calldata proofTopicId,
        uint64 proofSeq
    ) external returns (uint256 listingId) {
        require(bytes(bullId).length > 0, "bullId requerido");
        require(bytes(proofTopicId).length > 0, "proof requerida: referencia vacia");
        require(unitPriceCents > 0, "precio debe ser > 0");
        require(quantityUnits > 0, "cantidad debe ser > 0");
        require(royaltyPct <= 100, "royalty fuera de rango 0-100");
        require(breeder != address(0), "criador requerido");
        listingId = nextListingId;
        nextListingId += 1;
        listings[listingId] = Listing({
            bullId: bullId,
            assetType: assetType,
            unitPriceCents: unitPriceCents,
            available: quantityUnits,
            royaltyPct: royaltyPct,
            breeder: breeder,
            seller: msg.sender,
            proofTopicId: proofTopicId,
            proofSeq: proofSeq,
            cancelled: false
        });
        emit ListingCreated(listingId, bullId, proofTopicId);
    }

    // Compra al precio tasado (RF-04/RF-05): exige cantidad válida y pago exacto,
    // calcula el split con la misma regla half-up más resta (R-REV-01) y emite
    // el evento de compra liquidada. Todo require fallido revierte sin mover fondos.
    function buy(uint256 listingId, uint256 quantityUnits) external payable returns (bytes32 purchaseId) {
        Listing storage listing = listings[listingId];
        require(bytes(listing.bullId).length > 0, "listado inexistente");
        require(!listing.cancelled, "listado cerrado");
        require(quantityUnits > 0, "cantidad debe ser > 0");
        require(quantityUnits <= listing.available, "saldo insuficiente");
        uint256 total = listing.unitPriceCents * quantityUnits;
        require(msg.value == total, "pago debe ser exacto al precio tasado");
        // R-REV-01 on-chain: un solo half-up sobre la regalia, resto al vendedor.
        uint256 royalty = (total * listing.royaltyPct + 50) / 100;
        uint256 sellerAmount = total - royalty;
        purchaseId = keccak256(abi.encodePacked(listingId, quantityUnits, msg.sender, nextPurchaseId));
        nextPurchaseId += 1;
        require(!settled[purchaseId], "compra ya liquidada");
        settled[purchaseId] = true;
        listing.available -= quantityUnits;
        pendingRoyalties[listing.breeder] += royalty;
        // El vendedor cobra por transferencia directa; el criador retira aparte.
        (bool sent, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sent, "reembolso: fallo al transferir al vendedor");
        emit PurchaseSettled(purchaseId, listingId, msg.sender, total, royalty, sellerAmount);
    }

    // Retira las regalías pendientes del criador (RF-06): transfiere el saldo y
    // lo deja en cero; sin saldo revierte, sin doble pago posible.
    function withdrawRoyalties() external returns (uint256 amountCents) {
        amountCents = pendingRoyalties[msg.sender];
        require(amountCents > 0, "sin regalias pendientes");
        pendingRoyalties[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amountCents}("");
        require(sent, "reembolso: fallo al transferir regalias");
        emit RoyaltiesWithdrawn(msg.sender, amountCents);
    }

    // Cancela el listado (RF-08): cierra a nuevas compras sin tocar pendientes.
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(bytes(listing.bullId).length > 0, "listado inexistente");
        require(msg.sender == listing.seller, "solo el vendedor cancela");
        require(!listing.cancelled, "listado ya cancelado");
        listing.cancelled = true;
        emit ListingCancelled(listingId);
    }

    // Consultas públicas de solo lectura (verificables sin claves).
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getPendingRoyalties(address breeder) external view returns (uint256) {
        return pendingRoyalties[breeder];
    }

    function isSettled(bytes32 purchaseId) external view returns (bool) {
        return settled[purchaseId];
    }
}
