const { Client, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType } = require("@hashgraph/sdk");
require("dotenv").config();

async function main() {
    console.log("Iniciando conexión con Hedera Testnet...");

    // 1. Configurar tu cuenta
    const myAccountId = process.env.MY_ACCOUNT_ID;
    const myPrivateKey = PrivateKey.fromStringECDSA(process.env.MY_PRIVATE_KEY); const client = Client.forTestnet();
    client.setOperator(myAccountId, myPrivateKey);

    console.log("Creando el Token de Pajuelas (PAJ-BRAF)...");

    // 2. Dfinir las características del Token
    const transaction = new TokenCreateTransaction()
        .setTokenName("Genetica Braford - Toro Lider") // Nombre del activo
        .setTokenSymbol("PAJ-BRAF") // Símbolo en la bolsa
        .setTokenType(TokenType.FungibleCommon) // Fungible (1 pajuela = 1 pajuela)
        .setSupplyType(TokenSupplyType.Finite) // Suministro finito
        .setInitialSupply(250) // 250 pajuelas extraídas en este salto
        .setMaxSupply(250) // No se pueden emitir más de este lote
        .setDecimals(0) // Sin decimales (no se venden medias pajuelas)
        .setTreasuryAccountId(myAccountId)
        .setAdminKey(myPrivateKey) // Tu llave para administrarlo
        .freezeWith(client);

    // 3. Firmar la transacción y enviarla a la red
    const signTx = await transaction.sign(myPrivateKey);
    const txResponse = await signTx.execute(client);

    // 4. Obtener la confirmación
    const receipt = await txResponse.getReceipt(client);
    const tokenId = receipt.tokenId;

    console.log(`\n✅ ¡ÉXITO! Token creado en la blockchain.`);
    console.log(`🆔 Token ID: ${tokenId}`);
    console.log(`🔗 Link de validación para el Hackathon: https://hashscan.io/testnet/transaction/${txResponse.transactionId.toString()}`);

    process.exit();
}

main().catch((error) => {
    console.error("Hubo un error:", error);
});