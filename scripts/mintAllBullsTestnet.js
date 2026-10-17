const { Client, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType } = require("@hashgraph/sdk");
require("dotenv").config();

async function createToken(client, myAccountId, myPrivateKey, { name, symbol, decimals, supply }) {
  console.log(`\n⏳ Creando token ${symbol} (${name})...`);
  const transaction = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Finite)
    .setInitialSupply(supply)
    .setMaxSupply(supply)
    .setDecimals(decimals)
    .setTreasuryAccountId(myAccountId)
    .setAdminKey(myPrivateKey)
    .freezeWith(client);

  const signTx = await transaction.sign(myPrivateKey);
  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const tokenId = receipt.tokenId.toString();
  const txId = txResponse.transactionId.toString();

  console.log(`✅ Creado: ${symbol} -> Token ID: ${tokenId}`);
  console.log(`🔗 HashScan: https://hashscan.io/testnet/token/${tokenId}`);
  console.log(`🔗 Tx: https://hashscan.io/testnet/transaction/${txId}`);

  return { tokenId, txId };
}

async function main() {
  const myAccountId = process.env.MY_ACCOUNT_ID;
  const myPrivateKey = PrivateKey.fromStringECDSA(process.env.MY_PRIVATE_KEY);
  const client = Client.forTestnet();
  client.setOperator(myAccountId, myPrivateKey);

  console.log("Conectado con cuenta:", myAccountId);

  // 1. Pucará 459 (Toro 2) - Dosis Pajuelas
  const pucara = await createToken(client, myAccountId, myPrivateKey, {
    name: "Genetica Brangus - Pucara 459",
    symbol: "PAJ-PUCARA",
    decimals: 0,
    supply: 250
  });

  // 2. Colorado Correntino (Toro 3) - Dosis Pajuelas
  const colorado = await createToken(client, myAccountId, myPrivateKey, {
    name: "Genetica Braford - Colorado Correntino",
    symbol: "PAJ-FEDER",
    decimals: 0,
    supply: 250
  });

  // 3. Equity Copropiedad del Animal Vivo (BULL) - 10 unidades con 4 decimales
  const bullEquity = await createToken(client, myAccountId, myPrivateKey, {
    name: "Copropiedad Reproductor Don Luis",
    symbol: "BULL",
    decimals: 4,
    supply: 100000 // 10.0000
  });

  console.log("\n================ RESUMEN DE TOKENS EMITIDOS ================");
  console.log(JSON.stringify({ pucara, colorado, bullEquity }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error("Error al emitir tokens:", err);
  process.exit(1);
});
