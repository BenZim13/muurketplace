"use strict";

// Tests T1 (spec 004): configuración server-side Supabase — Transversal (base RF-01 a RF-08, D-01).
// Comentarios en español; código en inglés.
// - config/supabase.config.js recibe `env` por parámetro (testeable sin process.env).
// - Exige SUPABASE_URL https y clave según rol (anon o service_role).
// - Distingue envLabel "test" (esta spec solo usa el proyecto de test).
// - Lanza sin URL/clave antes de tocar red; nunca lee secretos del repo.
// - Sin red, sin credenciales reales, sin URLs reales: solo placeholders ficticios.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { loadSupabaseConfig } = require("../config/supabase.config.js");

// URLs y claves ficticias: formato válido, nunca reales ni del proyecto.
const FAKE_URL = "https://xyzcompany.supabase.co";
const FAKE_ANON_KEY = "fake-anon-key-for-format-only";
const FAKE_SERVICE_KEY = "fake-service-role-key-for-format-only";

describe("supabaseConfig T1 Transversal/D-01 - loadSupabaseConfig", () => {
  it("con URL https y clave anon devuelve config con envLabel test", () => {
    const cfg = loadSupabaseConfig({
      SUPABASE_URL: FAKE_URL,
      SUPABASE_ANON_KEY: FAKE_ANON_KEY,
    });
    assert.equal(cfg.url, FAKE_URL);
    assert.equal(cfg.anonKey, FAKE_ANON_KEY);
    assert.equal(cfg.envLabel, "test");
  });

  it("con URL https y clave service_role devuelve ambas claves según rol", () => {
    const cfg = loadSupabaseConfig({
      SUPABASE_URL: FAKE_URL,
      SUPABASE_ANON_KEY: FAKE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
    });
    assert.equal(cfg.url, FAKE_URL);
    assert.equal(cfg.serviceRoleKey, FAKE_SERVICE_KEY);
    assert.equal(cfg.envLabel, "test");
  });

  it("lanza sin URL antes de tocar red (credenciales ausentes)", () => {
    assert.throws(
      () => loadSupabaseConfig({ SUPABASE_ANON_KEY: FAKE_ANON_KEY }),
      /credenciales Supabase ausentes/
    );
    assert.throws(() => loadSupabaseConfig({}), /credenciales Supabase ausentes/);
    assert.throws(
      () => loadSupabaseConfig({ SUPABASE_URL: "", SUPABASE_ANON_KEY: FAKE_ANON_KEY }),
      /credenciales Supabase ausentes/
    );
  });

  it("lanza sin ninguna clave aunque haya URL (clave según rol exigida)", () => {
    assert.throws(
      () => loadSupabaseConfig({ SUPABASE_URL: FAKE_URL }),
      /credenciales Supabase ausentes/
    );
    assert.throws(
      () => loadSupabaseConfig({ SUPABASE_URL: FAKE_URL, SUPABASE_ANON_KEY: "" }),
      /credenciales Supabase ausentes/
    );
  });

  it("lanza si SUPABASE_URL no es https (configuración inválida)", () => {
    assert.throws(
      () =>
        loadSupabaseConfig({
          SUPABASE_URL: "http://xyzcompany.supabase.co",
          SUPABASE_ANON_KEY: FAKE_ANON_KEY,
        }),
      /configuración inválida/
    );
    assert.throws(
      () =>
        loadSupabaseConfig({
          SUPABASE_URL: "not-a-url",
          SUPABASE_ANON_KEY: FAKE_ANON_KEY,
        }),
      /configuración inválida/
    );
  });

  it("nunca lee secretos del repo ni de process.env: solo usa el env recibido", () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedAnon = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_URL = FAKE_URL;
    process.env.SUPABASE_ANON_KEY = FAKE_ANON_KEY;
    try {
      assert.throws(() => loadSupabaseConfig({}), /credenciales Supabase ausentes/);
    } finally {
      if (savedUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = savedUrl;
      if (savedAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
      else process.env.SUPABASE_ANON_KEY = savedAnon;
    }
  });
});
