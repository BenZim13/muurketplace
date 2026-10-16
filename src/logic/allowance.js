// Lógica pura de allowance HTS/HIP-336 (RF-06, RF-11 de la Spec 005).
// 100% pura: sin @hashgraph/sdk, sin process.env, sin red, sin fs,
// sin Date.now, sin Math.random. Solo aritmética entera en unidades base.
// Comentarios en español; código en inglés camelCase.
"use strict";

// RF-06: convierte una cantidad decimal a unidades base enteras sin pérdida.
// Cada token tiene sus decimales (PAJ-BRAF 0, BULL 4); devuelve bigint.
function toBaseUnits(amount, decimals) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    throw new Error("amount inválido: debe ser número finito >= 0");
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("decimals inválido: debe ser entero >= 0");
  }
  // Escala decimal exacta: round evita pérdida por representación binaria.
  const factor = 10 ** decimals;
  return BigInt(Math.round(amount * factor));
}

// RF-06: allowance mínima requerida según el activo.
// PAJ-BRAF es entero (0 decimales); BULL es fraccionable (4 decimales).
function calculateRequiredAllowance(assetType, quantity, decimals) {
  const expectedDecimals = assetType === "PAJ_BRAF" ? 0 : 4;
  if (decimals !== expectedDecimals) {
    throw new Error("decimales no coinciden con el activo");
  }
  return toBaseUnits(quantity, decimals);
}

// RF-06/RF-11: valida que la allowance concedida alcance lo requerido.
// Sin allowance suficiente o revocada, la compra atómica revierte (RF-11).
function validateAllowanceState(state, requiredBaseUnits) {
  if (state === null || typeof state !== "object") {
    throw new Error("allowance ausente");
  }
  if (typeof state.spender !== "string" || state.spender.trim() === "") {
    throw new Error("allowance inválida: falta spender");
  }
  if (typeof state.tokenId !== "string" || state.tokenId.trim() === "") {
    throw new Error("allowance inválida: falta tokenId");
  }
  // NB-1: un monto no convertible (undefined/null/string/float) es error de
  // dominio, nunca un TypeError/RangeError crudo de BigInt.
  let amount;
  try {
    amount = BigInt(state.amountBaseUnits);
  } catch (err) {
    throw new Error("allowance insuficiente: monto no convertible a unidades base");
  }
  if (amount < requiredBaseUnits) {
    throw new Error("allowance insuficiente");
  }
  return { ok: true };
}

module.exports = {
  toBaseUnits,
  calculateRequiredAllowance,
  validateAllowanceState,
};
