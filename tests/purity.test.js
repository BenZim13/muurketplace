// Tests T8 (spec 002): antirregresión de pureza RNF-01/RNF-05/RNF-06 + cierre.
// Comentarios en español; código en inglés.
// - src/logic/ 100% puro: prohibido @hashgraph/sdk, process.env, red/fetch,
//   fs, Date.now, Math.random (constitution §2, plan §4.6 T-07/R-07).
//   Se lee CADA archivo .js de src/logic/ (dinámico, incluye oracleMessage.js).
// - src/** sin forMainnet/mainnet: solo Testnet.
// - tests/ + config/ sin claves hardcodeadas (MY_PRIVATE_KEY asignado, 0x…,
//   BEGIN PRIVATE KEY); permitido leer desde process.env y el .example ficticio.
// - Cierre: matriz de cobertura spec 002 (RF-01…RF-08) y suite total en verde.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");
const LOGIC_DIR = path.join(ROOT_DIR, "src", "logic");
const SRC_DIR = path.join(ROOT_DIR, "src");
const CONFIG_DIR = path.join(ROOT_DIR, "config");

// Patrones prohibidos en lógica pura (tasks T8).
// Se buscan SIN paréntesis extra salvo fetch( para no confundir texto normal.
const FORBIDDEN_PATTERNS = [
  "hashgraph", // cubre require('@hashgraph/sdk')
  "@hashgraph/sdk",
  "process.env",
  "dotenv",
  "fetch(",
  "Math.random",
  "Date.now",
  "require('fs')",
  'require("fs")',
  "require('node:fs')",
  'require("node:fs")',
];

// Archivos históricos de spec 001 (compatibilidad con la matriz anterior).
const LEGACY_LOGIC_FILES = ["constants.js", "validator.js", "pricing.js", "evaluateBull.js"];

// Quita comentarios de línea // y de bloque /* */ antes de escanear.
// Evita falsos positivos por comentarios tipo "sin SDK, sin red, sin Date".
function stripComments(code) {
  // Bloques /* ... */ primero (no anidados en este proyecto).
  const withoutBlock = code.replace(/\/\*[\s\S]*?\*\//g, "");
  // Líneas //... (conserva el salto de línea).
  return withoutBlock.replace(/\/\/.*$/gm, "");
}

// Lista dinámica de cada archivo .js en src/logic/.
function listLogicFiles() {
  return fs
    .readdirSync(LOGIC_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort();
}

// Lista recursiva de archivos con las extensiones dadas bajo un directorio.
function listFilesRecursive(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, exts));
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out.sort();
}

// Compatibilidad con los describes T8: escaneo .js equivale a [".js"].
function listJsFilesRecursive(dir) {
  return listFilesRecursive(dir, [".js"]);
}

describe("T8 pureza RNF-01/RNF-02: src/logic/ sin SDK/env/red", () => {
  for (const file of LEGACY_LOGIC_FILES) {
    it(`${file} no contiene patrones prohibidos`, () => {
      const full = path.join(LOGIC_DIR, file);
      assert.ok(fs.existsSync(full), `falta archivo puro: ${file}`);
      const raw = fs.readFileSync(full, "utf8");
      const code = stripComments(raw);
      for (const pattern of FORBIDDEN_PATTERNS) {
        assert.ok(!code.includes(pattern), `${file} contiene patrón prohibido: ${pattern}`);
      }
    });
  }

  it("ningún archivo de src/logic/ importa @hashgraph/sdk con require", () => {
    for (const file of LEGACY_LOGIC_FILES) {
      const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, file), "utf8"));
      assert.ok(!code.includes("@hashgraph/sdk"), `${file} no debe importar el SDK de Hedera`);
    }
  });
});

describe("T8 (spec 002) pureza dinámica: CADA archivo de src/logic/", () => {
  it("oracleMessage.js existe y entra en el escaneo dinámico", () => {
    const files = listLogicFiles();
    assert.ok(files.length > 0, "src/logic/ no debe estar vacío");
    assert.ok(
      files.includes("oracleMessage.js"),
      `oracleMessage.js debe escanearse, hallados: ${files.join(", ")}`
    );
  });

  it("cada archivo .js de src/logic/ está libre de patrones prohibidos", () => {
    const files = listLogicFiles();
    assert.ok(files.length >= 5, `se esperan >= 5 archivos puros, hallados: ${files.join(", ")}`);
    for (const file of files) {
      const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, file), "utf8"));
      for (const pattern of FORBIDDEN_PATTERNS) {
        assert.ok(!code.includes(pattern), `${file} contiene patrón prohibido: ${pattern}`);
      }
    }
  });

  it("cada archivo .js de src/logic/ solo exige node:crypto como externo", () => {
    for (const file of listLogicFiles()) {
      const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, file), "utf8"));
      const requires = [...code.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
      for (const mod of requires) {
        const isRelative = mod.startsWith("./") || mod.startsWith("../");
        assert.ok(
          mod === "node:crypto" || mod.startsWith("node:") || isRelative,
          `${file} exige módulo externo no permitido: ${mod} (solo node:* y relativos puros)`
        );
      }
    }
  });
});

describe("T8 seguridad: src/** solo Testnet, sin claves en tests/config", () => {
  it("ningún archivo de src/** usa forMainnet ni menciona mainnet", () => {
    const files = listJsFilesRecursive(SRC_DIR);
    assert.ok(files.length > 0, "src/ no debe estar vacío");
    for (const full of files) {
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const rel = path.relative(ROOT_DIR, full);
      assert.ok(!code.includes("forMainnet"), `${rel} prohibido: Client.forMainnet()`);
      assert.ok(/mainnet/i.test(code) === false, `${rel} prohibido: mención a mainnet`);
    }
  });

  it("tests/ y config/ no hardcodean claves (solo lectura desde process.env)", () => {
    const scanned = [...listJsFilesRecursive(path.join(ROOT_DIR, "tests")), ...listJsFilesRecursive(CONFIG_DIR)];
    assert.ok(scanned.length > 0, "tests/ y config/ deben contener archivos .js");
    for (const full of scanned) {
      const rel = path.relative(ROOT_DIR, full);
      // Este mismo archivo menciona los literales prohibidos dentro de sus
      // propias assertions: se autoexcluye del escaneo por autorreferencia.
      if (path.basename(full) === "purity.test.js") {
        continue;
      }
      const code = stripComments(fs.readFileSync(full, "utf8"));
      // Asignación de clave privada con valor (hardcode) — la lectura
      // vía process.env.MY_PRIVATE_KEY queda permitida.
      assert.ok(
        /MY_PRIVATE_KEY\s*=\s*["'`0-9a-zA-Z]/.test(code) === false,
        `${rel} hardcodea MY_PRIVATE_KEY con valor literal`
      );
      // Literales hex 0x… (claves o firmas embebidas).
      assert.ok(/0x[0-9a-fA-F]{20,}/.test(code) === false, `${rel} contiene literal 0x…`);
      // Bloques PEM embebidos.
      assert.ok(
        code.includes("BEGIN PRIVATE KEY") === false,
        `${rel} contiene bloque PEM de clave privada`
      );
    }
  });
});

describe("T8 matriz de cobertura: 1 test por RF-01…RF-16 + EA-01 (plan §5)", () => {
  // Cada RF debe mencionarse al menos una vez en tests/ (trazabilidad estática).
  const RF_TO_FILES = {
    "RF-01": ["pricing.test.js", "validator.test.js"],
    "RF-02": ["validator.test.js"],
    "RF-03": ["validator.test.js"],
    "RF-04": ["validator.test.js"],
    "RF-05": ["validator.test.js"],
    "RF-06": ["validator.test.js", "evaluateBull.test.js"],
    "RF-07": ["validator.test.js"],
    "RF-08": ["pricing.test.js"],
    "RF-09": ["pricing.test.js"],
    "RF-10": ["pricing.test.js"],
    "RF-11": ["pricing.test.js"],
    "RF-12": ["pricing.test.js"],
    "RF-13": ["pricing.test.js"],
    "RF-14": ["pricing.test.js"],
    "RF-15": ["pricing.test.js"],
    "RF-16": ["evaluateBull.test.js"],
    "EA-01": ["evaluateBull.test.js"],
  };

  for (const [rf, files] of Object.entries(RF_TO_FILES)) {
    it(`${rf} tiene cobertura en ${files.join(" + ")}`, () => {
      for (const file of files) {
        const full = path.join(__dirname, file);
        assert.ok(fs.existsSync(full), `falta archivo de test: ${file}`);
      }
      // Al menos uno de los archivos declara el RF en sus describes/comentarios.
      const found = files.some((file) => fs.readFileSync(path.join(__dirname, file), "utf8").includes(rf));
      assert.ok(found, `${rf} sin mención en ${files.join(", ")}`);
    });
  }

  it("RNF-04: 100% ramas RF-09…RF-13 verificadas funcionalmente", () => {
    const { calculateMTotal } = require("../src/logic/pricing.js");
    function base(overrides = {}) {
      return {
        pesoNacerDep: 0.01,
        pesoDestateDep: 10.0,
        pesoFinalDep: 20.0,
        areaOjoBifeCm2: 1.99,
        grasaIntramuscularTop5: false,
        ...overrides,
      };
    }
    const close = (a, b) => Math.abs(a - b) < 1e-9;
    // RF-09 ambas ramas: <= 0.0 sí / > 0.0 no.
    assert.ok(close(calculateMTotal(base({ pesoNacerDep: 0.0 })), 1.5));
    assert.ok(close(calculateMTotal(base({ pesoNacerDep: 0.01 })), 1.0));
    // RF-10 ambas ramas: AND estricto.
    assert.ok(close(calculateMTotal(base({ pesoDestateDep: 16.0, pesoFinalDep: 32.0 })), 1.15));
    assert.ok(close(calculateMTotal(base({ pesoDestateDep: 16.0, pesoFinalDep: 30.0 })), 1.0));
    // RF-11/RF-12 tres ramas + no-acumulación.
    assert.ok(close(calculateMTotal(base({ areaOjoBifeCm2: 1.99 })), 1.0));
    assert.ok(close(calculateMTotal(base({ areaOjoBifeCm2: 2.0 })), 1.2));
    assert.ok(close(calculateMTotal(base({ areaOjoBifeCm2: 3.0 })), 1.5));
    // RF-13 ambas ramas con igualdad estricta.
    assert.ok(close(calculateMTotal(base({ grasaIntramuscularTop5: true })), 1.3));
    assert.ok(close(calculateMTotal(base({ grasaIntramuscularTop5: false })), 1.0));
  });
});

describe("T8 cierre spec 002: cobertura RF-01…RF-08 del oráculo HCS", () => {
  // Cada RF del oráculo mapea a su archivo de test dedicado (matriz tasks.md).
  const ORACLE_COVERAGE = {
    "RF-01": "topicManager.test.js",
    "RF-02": "topicManager.test.js",
    "RF-03": "oraclePublisher.test.js",
    "RF-04": "oraclePublisher.test.js",
    "RF-05": "oracleMessage.test.js",
    "RF-06": "oracleVerifier.test.js",
    "RF-07": "oraclePublisher.test.js",
    "RF-08": "oraclePublisher.test.js",
  };

  for (const [rf, file] of Object.entries(ORACLE_COVERAGE)) {
    it(`oráculo ${rf} tiene test dedicado ${file}`, () => {
      const full = path.join(__dirname, file);
      assert.ok(fs.existsSync(full), `falta archivo de test: ${file}`);
      const content = fs.readFileSync(full, "utf8");
      assert.ok(content.includes(rf), `${file} sin mención a ${rf}`);
    });
  }

  it("infraestructura HCS completa: config + client + manager + publisher + verifier", () => {
    for (const rel of [
      "config/oracle.config.js",
      "src/hedera/hcsClient.js",
      "src/hedera/topicManager.js",
      "src/hedera/oraclePublisher.js",
      "src/hedera/oracleVerifier.js",
      "src/logic/oracleMessage.js",
    ]) {
      assert.ok(fs.existsSync(path.join(ROOT_DIR, rel)), `falta archivo: ${rel}`);
    }
  });
});

// ---------------------------------------------------------------------------
// T9 (spec 003): antirregresión pureza/seguridad + cierre RNF-01/RNF-02/RNF-07/RNF-08.
// Comentarios en español; código en inglés.
// - RNF-01: marketplace.js 100% puro y dentro del escaneo dinámico.
// - RNF-08: config/** + src/contracts/** solo Testnet (sin forMainnet/mainnet).
// - RNF-07: tests/ + config/ + src/contracts/ sin claves ni IDs reales;
//   solo mocks ficticios allowlistados más el ejemplo 0.0.000000; .env nunca
//   trackeado por git y cubierto por .gitignore.
// - RNF-02: matriz RF-01…RF-08 + EA-01 de la spec 003 con 1 test por RF.
// - Cierre: contrato inmutable (sin setter), evento de liquidación, pragma
//   ^0.8, precios en céntimos; EA-01 canónico re-verificado funcionalmente.
// ---------------------------------------------------------------------------

const MARKETPLACE_LOGIC_FILE = "marketplace.js";

// Mocks ficticios permitidos en tests/ (dobles sin red, nunca IDs reales).
// El ejemplo 0.0.000000 vive solo en .env.example (raíz, fuera del repo real).
const FICTIONAL_ID_ALLOWLIST = new Set([
  "0.0.1",
  "0.0.111111",
  "0.0.123456",
  "0.0.777777",
  "0.0.789",
  "0.0.999",
  "0.0.999999",
  "0.0.000000",
]);

describe("T9 pureza RNF-01: marketplace.js 100% puro", () => {
  it("marketplace.js existe y entra en el escaneo dinámico de src/logic/", () => {
    const files = listLogicFiles();
    assert.ok(
      files.includes(MARKETPLACE_LOGIC_FILE),
      `marketplace.js debe escanearse, hallados: ${files.join(", ")}`
    );
  });

  it("marketplace.js está libre de patrones prohibidos (sin SDK/env/red/tiempo/azar)", () => {
    const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, MARKETPLACE_LOGIC_FILE), "utf8"));
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.ok(!code.includes(pattern), `marketplace.js contiene patrón prohibido: ${pattern}`);
    }
  });

  it("marketplace.js solo exige módulos relativos puros (reutiliza pricing.js)", () => {
    const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, MARKETPLACE_LOGIC_FILE), "utf8"));
    const requires = [...code.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    assert.ok(requires.length > 0, "marketplace.js debe reutilizar pricing.js vía require relativo");
    for (const mod of requires) {
      const isRelative = mod.startsWith("./") || mod.startsWith("../");
      assert.ok(
        mod === "node:crypto" || mod.startsWith("node:") || isRelative,
        `marketplace.js exige módulo externo no permitido: ${mod}`
      );
    }
    assert.ok(
      requires.includes("./pricing.js"),
      "marketplace.js debe reutilizar roundHalfUp2 desde ./pricing.js sin duplicar semántica"
    );
  });
});

describe("T9 seguridad RNF-08: config/** y src/contracts/** solo Testnet", () => {
  it("ningún archivo de config/** usa forMainnet ni menciona mainnet", () => {
    const files = listFilesRecursive(CONFIG_DIR, [".js"]);
    assert.ok(files.length > 0, "config/ no debe estar vacío");
    for (const full of files) {
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const rel = path.relative(ROOT_DIR, full);
      assert.ok(!code.includes("forMainnet"), `${rel} prohibido: Client.forMainnet()`);
      assert.ok(/mainnet/i.test(code) === false, `${rel} prohibido: mención a mainnet`);
    }
  });

  it("el contrato Muurketplace.sol solo menciona Testnet, nunca Mainnet", () => {
    const full = path.join(ROOT_DIR, "src", "contracts", "Muurketplace.sol");
    assert.ok(fs.existsSync(full), "falta contrato: src/contracts/Muurketplace.sol");
    const raw = fs.readFileSync(full, "utf8");
    const code = stripComments(raw);
    assert.ok(!code.includes("forMainnet"), "Muurketplace.sol prohibido: forMainnet");
    assert.ok(/mainnet/i.test(code) === false, "Muurketplace.sol prohibido: mención a mainnet");
    assert.ok(/mainnet/i.test(raw) === false, "Muurketplace.sol prohibido: mención a mainnet");
    assert.ok(/testnet/i.test(raw), "Muurketplace.sol debe declarar operación solo Testnet");
  });
});

describe("T9 seguridad RNF-07: sin claves ni identificadores reales", () => {
  it("tests/ + config/ + src/contracts/ no hardcodean claves (solo lectura desde process.env)", () => {
    const scanned = [
      ...listFilesRecursive(path.join(ROOT_DIR, "tests"), [".js"]),
      ...listFilesRecursive(CONFIG_DIR, [".js"]),
      ...listFilesRecursive(path.join(ROOT_DIR, "src", "contracts"), [".js", ".sol"]),
    ];
    assert.ok(scanned.length > 0, "tests/, config/ y src/contracts/ deben contener archivos");
    for (const full of scanned) {
      const rel = path.relative(ROOT_DIR, full);
      // Este mismo archivo menciona los literales prohibidos dentro de sus
      // propias assertions: se autoexcluye del escaneo por autorreferencia.
      if (path.basename(full) === "purity.test.js") {
        continue;
      }
      const code = stripComments(fs.readFileSync(full, "utf8"));
      // Asignación de clave privada con valor (hardcode) — la lectura
      // vía process.env.MY_PRIVATE_KEY queda permitida.
      assert.ok(
        /MY_PRIVATE_KEY\s*=\s*["'`0-9a-zA-Z]/.test(code) === false,
        `${rel} hardcodea MY_PRIVATE_KEY con valor literal`
      );
      // Literales hex 0x… (claves o firmas embebidas).
      assert.ok(/0x[0-9a-fA-F]{20,}/.test(code) === false, `${rel} contiene literal 0x…`);
      // Bloques PEM embebidos.
      assert.ok(
        code.includes("BEGIN PRIVATE KEY") === false,
        `${rel} contiene bloque PEM de clave privada`
      );
    }
  });

  it("tests/ solo usa Account IDs ficticios allowlistados (mocks, nunca reales)", () => {
    const files = listFilesRecursive(path.join(ROOT_DIR, "tests"), [".js"]);
    for (const full of files) {
      if (path.basename(full) === "purity.test.js") {
        continue;
      }
      const rel = path.relative(ROOT_DIR, full);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const ids = code.match(/0\.0\.\d+/g) || [];
      for (const id of ids) {
        assert.ok(
          FICTIONAL_ID_ALLOWLIST.has(id),
          `${rel} usa Account ID no allowlistado: ${id} (solo mocks ficticios)`
        );
      }
    }
  });

  it("config/ y src/contracts/ no contienen ningún Account ID literal", () => {
    const scanned = [
      ...listFilesRecursive(CONFIG_DIR, [".js"]),
      ...listFilesRecursive(path.join(ROOT_DIR, "src", "contracts"), [".js", ".sol"]),
    ];
    assert.ok(scanned.length > 0, "config/ y src/contracts/ deben contener archivos");
    for (const full of scanned) {
      const rel = path.relative(ROOT_DIR, full);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      assert.ok(
        /0\.0\.\d+/.test(code) === false,
        `${rel} contiene Account ID literal (config y contrato no fijan IDs)`
      );
    }
  });

  it(".env.example solo documenta valores ficticios (placeholders, sin secretos)", () => {
    const full = path.join(ROOT_DIR, ".env.example");
    assert.ok(fs.existsSync(full), "falta .env.example con placeholders ficticios");
    const content = fs.readFileSync(full, "utf8");
    assert.ok(/0x[0-9a-fA-F]{20,}/.test(content) === false, ".env.example contiene literal 0x…");
    assert.ok(
      content.includes("BEGIN PRIVATE KEY") === false,
      ".env.example contiene bloque PEM de clave privada"
    );
  });

  it(".gitignore cubre .env (nunca commitear secretos, constitution §4)", () => {
    const full = path.join(ROOT_DIR, ".gitignore");
    assert.ok(fs.existsSync(full), "falta .gitignore");
    const content = fs.readFileSync(full, "utf8");
    const covered = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"))
      .some((line) => line === ".env" || line === "/.env" || line === ".env*");
    assert.ok(covered, ".gitignore debe listar .env para nunca commitear secretos");
  });

  it(".env no está trackeado por git (cierre RNF-07)", () => {
    let tracked = null;
    try {
      const { execFileSync } = require("node:child_process");
      tracked = execFileSync("git", ["ls-files"], { cwd: ROOT_DIR, encoding: "utf8" });
    } catch (err) {
      // Sin git disponible no se puede verificar rastreo: se omite sin verde falso.
      assert.ok(false, `no se pudo verificar git ls-files: ${err.message}`);
      return;
    }
    const files = tracked.split(/\r?\n/).map((line) => line.trim());
    assert.ok(files.includes(".gitignore"), "el repo git debe trackear .gitignore");
    assert.ok(files.includes(".env") === false, ".env está trackeado por git: des-trackear con `git rm --cached .env`");
  });
});

describe("T9 matriz spec 003: 1 test por RF-01…RF-08 + EA-01 (RNF-02)", () => {
  // Cada RF del marketplace mapea a sus archivos de test dedicados (tasks.md).
  const MARKETPLACE_COVERAGE = {
    "RF-01": ["marketplace.test.js", "marketplaceClient.test.js"],
    "RF-02": ["marketplaceClient.test.js"],
    "RF-03": ["marketplace.test.js"],
    "RF-04": ["marketplace.test.js", "marketplaceClient.test.js", "marketplaceIntegration.test.js"],
    "RF-05": ["marketplace.test.js", "marketplaceIntegration.test.js"],
    "RF-06": ["marketplace.test.js", "marketplaceClient.test.js", "marketplaceIntegration.test.js"],
    "RF-07": ["marketplaceClient.test.js"],
    "RF-08": ["marketplace.test.js", "marketplaceClient.test.js"],
    "EA-01": ["marketplace.test.js", "marketplaceIntegration.test.js"],
  };

  for (const [rf, files] of Object.entries(MARKETPLACE_COVERAGE)) {
    it(`marketplace ${rf} tiene cobertura en ${files.join(" + ")}`, () => {
      for (const file of files) {
        const full = path.join(__dirname, file);
        assert.ok(fs.existsSync(full), `falta archivo de test: ${file}`);
      }
      // Al menos uno de los archivos declara el RF en sus describes/comentarios.
      const found = files.some((file) => fs.readFileSync(path.join(__dirname, file), "utf8").includes(rf));
      assert.ok(found, `${rf} sin mención en ${files.join(", ")}`);
    });
  }

  it("config habilitadora del marketplace tiene test dedicado (T1)", () => {
    const full = path.join(__dirname, "marketplaceConfig.test.js");
    assert.ok(fs.existsSync(full), "falta archivo de test: marketplaceConfig.test.js");
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, "config", "marketplace.config.js")),
      "falta archivo: config/marketplace.config.js"
    );
  });
});

describe("T9 cierre spec 003: contrato inmutable + infraestructura + EA-01", () => {
  it("el contrato no expone setter de porcentaje (inmutable tras listar)", () => {
    const code = fs.readFileSync(path.join(ROOT_DIR, "src", "contracts", "Muurketplace.sol"), "utf8");
    const lowered = code.toLowerCase();
    assert.ok(!lowered.includes("setroyalty"), "Muurketplace.sol prohibido: setter de regalía");
    assert.ok(!lowered.includes("setroyaltypct"), "Muurketplace.sol prohibido: setter de porcentaje");
    assert.ok(!lowered.includes("updateroyalty"), "Muurketplace.sol prohibido: updater de regalía");
  });

  it("el contrato emite evento de compra liquidada y compila en pragma ^0.8 con céntimos", () => {
    const code = fs.readFileSync(path.join(ROOT_DIR, "src", "contracts", "Muurketplace.sol"), "utf8");
    assert.ok(code.includes("PurchaseSettled"), "Muurketplace.sol debe emitir evento PurchaseSettled");
    assert.ok(/pragma solidity \^0\.8/.test(code), "Muurketplace.sol debe compilar con pragma ^0.8");
    assert.ok(code.includes("Cents"), "Muurketplace.sol debe operar precios en céntimos enteros");
  });

  it("infraestructura del marketplace completa: config + lógica + contrato + client", () => {
    for (const rel of [
      "config/marketplace.config.js",
      "src/logic/marketplace.js",
      "src/contracts/Muurketplace.sol",
      "src/hedera/marketplaceClient.js",
    ]) {
      assert.ok(fs.existsSync(path.join(ROOT_DIR, rel)), `falta archivo: ${rel}`);
    }
  });

  it("EA-01 canónico re-verificado: 245.00 → 12.25 criador / 232.75 vendedor, retiro único", () => {
    const { calculateSplit, applySettlement } = require("../src/logic/marketplace.js");
    const split = calculateSplit(245.0, 5);
    assert.equal(split.royaltyUsd, 12.25);
    assert.equal(split.sellerUsd, 232.75);
    assert.equal(split.royaltyUsd + split.sellerUsd, split.totalUsd);
    const settled = applySettlement("P-EA01-T9", split, null);
    assert.equal(settled.breederBalance, 12.25);
    assert.equal(settled.sellerBalance, 232.75);
    assert.throws(() => applySettlement("P-EA01-T9", split, settled), /doble retiro/);
  });
});

// ---------------------------------------------------------------------------
// T9 (spec 004): pureza/seguridad + cierre — espejo Supabase (RNF-01 a RNF-06, D-01/D-02).
// Comentarios en español; código en inglés.
// - RNF-01: mirrorRules.js 100% puro, en el escaneo dinámico, sin SDK de
//   Supabase/Hedera, sin process.env, sin red, sin tiempo ni azar; reutiliza
//   oracleMessage.js (valuationKey + verifyMessageContent, sin duplicar).
// - RNF-03: src/db/** + config/** solo Testnet (sin forMainnet/mainnet);
//   sin claves Supabase/Hedera ni Account IDs reales en repo/tests/logs;
//   .env no trackeado; .env.example con placeholders ficticios.
// - RNF-02: matriz RF-01…RF-08 + D-01/D-02 de la spec 004 con 1 test por RF.
// - Cierre: infraestructura espejo completa y vista pública honesta
//   (MISMATCH/PENDING nunca VERIFIED, ausencia explícita sin referencia).
// ---------------------------------------------------------------------------

const MIRROR_LOGIC_FILE = "mirrorRules.js";

// Patrones extra prohibidos en lógica pura del espejo (además de FORBIDDEN_PATTERNS).
// Se buscan sobre código sin comentarios: mencionar "Supabase" en un comentario
// es documentación válida, importarlo o llamarlo en código no lo es.
const MIRROR_FORBIDDEN_EXTRA = ["supabase", "Supabase", "@supabase/supabase-js"];

describe("T9 pureza RNF-01 (spec 004): mirrorRules.js 100% puro", () => {
  it("mirrorRules.js existe y entra en el escaneo dinámico de src/logic/", () => {
    const files = listLogicFiles();
    assert.ok(
      files.includes(MIRROR_LOGIC_FILE),
      `mirrorRules.js debe escanearse, hallados: ${files.join(", ")}`
    );
  });

  it("mirrorRules.js está libre de patrones prohibidos (sin SDK/env/red/tiempo/azar)", () => {
    const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, MIRROR_LOGIC_FILE), "utf8"));
    for (const pattern of [...FORBIDDEN_PATTERNS, ...MIRROR_FORBIDDEN_EXTRA]) {
      assert.ok(!code.includes(pattern), `mirrorRules.js contiene patrón prohibido: ${pattern}`);
    }
  });

  it("mirrorRules.js solo exige módulos relativos puros y reutiliza oracleMessage.js", () => {
    const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, MIRROR_LOGIC_FILE), "utf8"));
    const requires = [...code.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    assert.ok(requires.length > 0, "mirrorRules.js debe reutilizar oracleMessage.js vía require relativo");
    for (const mod of requires) {
      const isRelative = mod.startsWith("./") || mod.startsWith("../");
      assert.ok(
        mod === "node:crypto" || mod.startsWith("node:") || isRelative,
        `mirrorRules.js exige módulo externo no permitido: ${mod}`
      );
    }
    assert.ok(
      requires.includes("./oracleMessage.js"),
      "mirrorRules.js debe reutilizar valuationKey + verifyMessageContent desde ./oracleMessage.js sin duplicar semántica (D-02)"
    );
  });
});

describe("T9 seguridad RNF-03 (spec 004): solo Testnet, sin secretos", () => {
  it("ningún archivo de src/db/** ni config/** usa forMainnet ni menciona mainnet", () => {
    const files = [
      ...listFilesRecursive(path.join(SRC_DIR, "db"), [".js"]),
      ...listFilesRecursive(CONFIG_DIR, [".js"]),
    ];
    assert.ok(files.length > 0, "src/db/ y config/ no deben estar vacíos");
    for (const full of files) {
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const rel = path.relative(ROOT_DIR, full);
      assert.ok(!code.includes("forMainnet"), `${rel} prohibido: Client.forMainnet()`);
      assert.ok(/mainnet/i.test(code) === false, `${rel} prohibido: mención a mainnet`);
    }
  });

  it("el SDK de Supabase solo se importa en src/db/supabaseClient.js, nunca en src/logic/", () => {
    for (const file of listLogicFiles()) {
      const code = stripComments(fs.readFileSync(path.join(LOGIC_DIR, file), "utf8"));
      assert.ok(
        !code.includes("@supabase/supabase-js"),
        `${file} no debe importar el SDK de Supabase (RNF-01)`
      );
    }
    const dbFiles = listFilesRecursive(path.join(SRC_DIR, "db"), [".js"]);
    const importers = dbFiles.filter((full) =>
      stripComments(fs.readFileSync(full, "utf8")).includes("@supabase/supabase-js")
    );
    assert.equal(importers.length, 1, "solo un archivo de src/db/ debe importar el SDK de Supabase");
    assert.equal(
      path.basename(importers[0]),
      "supabaseClient.js",
      "el único importador del SDK en src/db/ debe ser supabaseClient.js (server-side)"
    );
  });

  it("config/** y src/db/** no hardcodean claves ni Account IDs (solo lectura server-side)", () => {
    const scanned = [
      ...listFilesRecursive(CONFIG_DIR, [".js"]),
      ...listFilesRecursive(path.join(SRC_DIR, "db"), [".js"]),
    ];
    assert.ok(scanned.length > 0, "config/ y src/db/ deben contener archivos");
    for (const full of scanned) {
      const rel = path.relative(ROOT_DIR, full);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      assert.ok(/0x[0-9a-fA-F]{20,}/.test(code) === false, `${rel} contiene literal 0x…`);
      assert.ok(
        code.includes("BEGIN PRIVATE KEY") === false,
        `${rel} contiene bloque PEM de clave privada`
      );
      assert.ok(
        /SUPABASE_(ANON|SERVICE_ROLE)_KEY\s*=\s*["']?[A-Za-z0-9]/.test(code) === false,
        `${rel} asigna clave Supabase con valor literal`
      );
      assert.ok(
        /0\.0\.\d+/.test(code) === false,
        `${rel} contiene Account ID literal (config e infra no fijan IDs)`
      );
    }
  });

  it("los tests de la spec 004 solo usan Account IDs ficticios allowlistados", () => {
    for (const file of [
      "mirrorRules.test.js",
      "dbRepos.test.js",
      "supabaseConfig.test.js",
      "supabaseIntegration.test.js",
    ]) {
      const full = path.join(__dirname, file);
      assert.ok(fs.existsSync(full), `falta archivo de test: ${file}`);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      assert.ok(/0x[0-9a-fA-F]{20,}/.test(code) === false, `${file} contiene literal 0x…`);
      assert.ok(
        code.includes("BEGIN PRIVATE KEY") === false,
        `${file} contiene bloque PEM de clave privada`
      );
      const ids = code.match(/0\.0\.\d+/g) || [];
      for (const id of ids) {
        assert.ok(
          FICTIONAL_ID_ALLOWLIST.has(id),
          `${file} usa Account ID no allowlistado: ${id} (solo mocks ficticios)`
        );
      }
    }
  });

  it(".env.example documenta el espejo Supabase con placeholders ficticios (D-01)", () => {
    const full = path.join(ROOT_DIR, ".env.example");
    assert.ok(fs.existsSync(full), "falta .env.example con placeholders ficticios");
    const content = fs.readFileSync(full, "utf8");
    assert.ok(content.includes("SUPABASE_URL="), ".env.example debe documentar SUPABASE_URL");
    assert.ok(content.includes("SUPABASE_ANON_KEY="), ".env.example debe documentar SUPABASE_ANON_KEY");
    assert.ok(
      content.includes("SUPABASE_SERVICE_ROLE_KEY="),
      ".env.example debe documentar SUPABASE_SERVICE_ROLE_KEY"
    );
    assert.ok(
      content.includes("https://xyzcompany.supabase.co"),
      ".env.example debe usar URL ficticia xyzcompany (nunca real)"
    );
    assert.ok(content.includes("TU_ANON_KEY_AQUI"), ".env.example debe usar placeholder ficticio anon");
    assert.ok(
      content.includes("TU_SERVICE_ROLE_KEY_AQUI"),
      ".env.example debe usar placeholder ficticio service_role"
    );
    assert.ok(/0x[0-9a-fA-F]{20,}/.test(content) === false, ".env.example contiene literal 0x…");
    assert.ok(
      content.includes("BEGIN PRIVATE KEY") === false,
      ".env.example contiene bloque PEM de clave privada"
    );
  });

  it(".gitignore cubre .env y .env.local y .env no está trackeado (cierre RNF-03)", () => {
    const ignoreFull = path.join(ROOT_DIR, ".gitignore");
    assert.ok(fs.existsSync(ignoreFull), "falta .gitignore");
    const ignore = fs.readFileSync(ignoreFull, "utf8");
    const lines = ignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    assert.ok(
      lines.some((line) => line === ".env" || line === "/.env" || line === ".env*"),
      ".gitignore debe listar .env para nunca commitear secretos"
    );
    assert.ok(lines.includes(".env.local"), ".gitignore debe listar .env.local (D-01 ciclo por entorno)");
    let tracked = null;
    try {
      const { execFileSync } = require("node:child_process");
      tracked = execFileSync("git", ["ls-files"], { cwd: ROOT_DIR, encoding: "utf8" });
    } catch (err) {
      assert.ok(false, `no se pudo verificar git ls-files: ${err.message}`);
      return;
    }
    const files = tracked.split(/\r?\n/).map((line) => line.trim());
    assert.ok(files.includes(".env") === false, ".env está trackeado por git: des-trackear con `git rm --cached .env`");
    assert.ok(
      files.includes(".env.local") === false,
      ".env.local está trackeado por git: des-trackear con `git rm --cached .env.local`"
    );
  });
});

describe("T9 matriz spec 004 (RNF-02): 1 test por RF-01…RF-08 + D-01/D-02", () => {
  // Cada RF del espejo mapea a su test puro (mirrorRules) y a su test de repo
  // con mock (dbRepos); la E2E gateada demuestra la idempotencia real (tasks.md T8).
  const MIRROR_COVERAGE = {
    "RF-01": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-02": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-03": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-04": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-05": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-06": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-07": ["mirrorRules.test.js", "dbRepos.test.js"],
    "RF-08": ["mirrorRules.test.js", "dbRepos.test.js"],
  };

  for (const [rf, files] of Object.entries(MIRROR_COVERAGE)) {
    it(`espejo ${rf} tiene cobertura en ${files.join(" + ")}`, () => {
      for (const file of files) {
        const full = path.join(__dirname, file);
        assert.ok(fs.existsSync(full), `falta archivo de test: ${file}`);
      }
      // Al menos uno de los archivos declara el RF en sus describes/comentarios.
      const found = files.some((file) => fs.readFileSync(path.join(__dirname, file), "utf8").includes(rf));
      assert.ok(found, `${rf} sin mención en ${files.join(", ")}`);
    });
  }

  it("D-01 tiene cobertura en supabaseConfig.test.js (proyecto test + RLS/entornos)", () => {
    const full = path.join(__dirname, "supabaseConfig.test.js");
    assert.ok(fs.existsSync(full), "falta archivo de test: supabaseConfig.test.js");
    assert.ok(fs.readFileSync(full, "utf8").includes("D-01"), "supabaseConfig.test.js sin mención a D-01");
  });

  it("D-02 tiene cobertura en mirrorRules.test.js (specVersion 002 lanza, 001 inmutable)", () => {
    const full = path.join(__dirname, "mirrorRules.test.js");
    assert.ok(fs.existsSync(full), "falta archivo de test: mirrorRules.test.js");
    assert.ok(fs.readFileSync(full, "utf8").includes("D-02"), "mirrorRules.test.js sin mención a D-02");
  });

  it("la E2E gateada existe y cubre la idempotencia real RF-02/RF-06 sin bloquear el verde local", () => {
    const full = path.join(__dirname, "supabaseIntegration.test.js");
    assert.ok(fs.existsSync(full), "falta archivo de test: supabaseIntegration.test.js");
    const content = fs.readFileSync(full, "utf8");
    assert.ok(content.includes("RUN_SUPABASE_INTEGRATION"), "la E2E debe gatearse por RUN_SUPABASE_INTEGRATION");
    assert.ok(content.includes("RF-02"), "la E2E debe cubrir RF-02 (conteo de filas = 1)");
    assert.ok(content.includes("RF-06"), "la E2E debe cubrir RF-06 (sin duplicado ni reacreditación)");
  });
});

describe("T9 cierre spec 004: infraestructura espejo + vista pública honesta", () => {
  it("infraestructura del espejo completa: config + lógica + 4 repos + client", () => {
    for (const rel of [
      "config/supabase.config.js",
      "src/logic/mirrorRules.js",
      "src/db/supabaseClient.js",
      "src/db/bullsRepo.js",
      "src/db/valuationsRepo.js",
      "src/db/proofsRepo.js",
      "src/db/listingsRepo.js",
    ]) {
      assert.ok(fs.existsSync(path.join(ROOT_DIR, rel)), `falta archivo: ${rel}`);
    }
  });

  it("la vista pública nunca presenta MISMATCH/PENDING como VERIFIED ni inventa referencia", () => {
    const { toPublicView } = require("../src/logic/mirrorRules.js");
    const record = { valuationKey: "vk-cierre-t9" };
    const pending = toPublicView(record, {
      topicId: "0.0.789",
      sequenceNumber: 7,
      consensusTimestamp: "t",
      transactionId: "0.0.789@1.2",
      status: "PENDING",
    });
    assert.equal(pending.unverified, true);
    assert.ok(pending.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(pending.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    const mismatch = toPublicView(record, {
      topicId: "0.0.789",
      sequenceNumber: 7,
      consensusTimestamp: "t",
      transactionId: "0.0.789@1.2",
      status: "MISMATCH",
    });
    assert.equal(mismatch.unverified, true);
    const absent = toPublicView(record, null);
    assert.equal(absent.mirrorUrl, null);
    assert.equal(absent.hashscanUrl, null);
    assert.equal(absent.unverified, true);
  });
});
