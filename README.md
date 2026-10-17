# 🐂 MUURKET — Plataforma de Tokenización de Genética Bovina (Braford)
### *Ecosistema RWA en Hedera Hashgraph para el Sector Agroganadero*

[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet-blue?logo=hedera&style=flat-square)](https://hashscan.io/testnet)
[![Token HTS](https://img.shields.io/badge/HTS-PAJ--BRAF-059669?style=flat-square)](https://hashscan.io/testnet/token/0.0.11043216)
[![Demo Vercel](https://img.shields.io/badge/Demo-Vercel-black?logo=vercel&style=flat-square)](https://muurketplace.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**MUURKET** es un marketplace de **Activos del Mundo Real (RWA - Real World Assets)** diseñado para la ganadería de élite del Nordeste Argentino (NEA). Permite a las cabañas ganaderas tokenizar dos tipos de activos: tanto la **copropiedad patrimonial sobre el propio reproductor vivo en pie** como la **producción seminal fraccionada (pajuelas)** de sus **Toros Líderes** (Gran Campeón Palermo y reproductores de mérito genético certificado por PEGBraf), transformando activos biológicos de alto valor en instrumentos financieros líquidos y programables en la red **Hedera Hashgraph**.

Nuestra misión es **financiar lo que producimos eliminando intermediarios mediante Web3**: las cabañas acceden a capital de trabajo inmediato sin endeudamiento bancario usurario ni desprendimiento forzoso de sus animales, mientras que productores pecuarios e inversores pueden participar de dos modalidades de inversión respaldadas por activos biológicos reales y auditables.

---

## 🌾 Conceptos Fundamentales: ¿Qué Activos se Tokenizan en MUURKET?

Una de las premisas centrales del ecosistema es que **la tokenización no se limita únicamente a la pajuela de semen**. MUURKET implementa una arquitectura dual de activos que resuelve dos problemáticas estructurales del agro:

### 1. 🐂 Activo Patrimonial sobre el Propio Animal (Copropiedad / Equity `BULL`)
* **El activo subyacente:** Es el **propio toro reproductor vivo en pie** (animal biológico evaluado fenotípica y genéticamente).
* **Fundamento en la economía ganadera real:** En el sector de cabañas de pedigree, un Gran Campeón de Palermo o un reproductor superior alcanza cotizaciones de entre **$30,000 y más de $100,000 USD**. Tradicionalmente, las cabañas comparten la propiedad de estos animales mediante contratos privados de "copropiedad" (al 50% o al 33%) suscritos en remates presenciales exclusivos para amortizar costos y compartir genética.
* **La solución Web3 en Hedera:** MUURKET estandariza y fracciona la titularidad jurídica y económica del reproductor en pie emitiendo tokens fungibles `BULL` (con hasta 4 decimales y un suministro estricto de hasta 10 unidades, equivalente a 10 cuotas partes del 10% del animal).
* **Derechos y flujos económicos para el tenedor de `BULL`:**
  - **Apreciación Patrimonial:** Participa de la valorización del reproductor en pie ante premios zootécnicos, mejoras en sus índices DEPs y demanda del mercado.
  - **Derechos en Remates:** En caso de venta total o subasta internacional del reproductor, percibe su porcentaje proporcional en USDC.
  - **Regalías Vitalicias de Semen:** Cobra un porcentaje directo y automático de todas las ventas de pajuelas que el animal produzca a lo largo de toda su vida útil.
* **Ventaja para la Cabaña:** Puede monetizar entre un 20% y un 40% del valor de su toro estrella para autofinanciarse de inmediato (pasturas, sanidad, infraestructura) manteniendo la tenencia y custodia física en su campo.

---

### 2. 🧪 Activo sobre la Producción Seminal (Dosis / Pajuelas Criopreservadas `PAJ-BRAF`)
* **El activo subyacente:** Cada token está respaldado 1 a 1 por una **pajuela física de semen de 0.5 ml**, extraída bajo estrictos controles veterinarios y criopreservada a -196°C en tanques de nitrógeno líquido en un criocentro habilitado por **SENASA**.
* **Propiedades del Token HTS:** Token fungible común indivisible (0 decimales: 1 token = 1 pajuela física real).
* **Doble Alternativa de Salida para el Poseedor:**
  - **A. Utilidad Productiva (Canje Físico para Inseminación):** Productores de hacienda general y pequeños ganaderos del NEA pueden adquirir tokens y solicitar el retiro físico de las dosis en el criocentro para programas de **Inseminación Artificial a Tiempo Fijo (IATF)**, logrando terneros con mayor peso al destete (+16 kg) y conformación carnicera superior a una fracción del costo de un toro entero.
  - **B. Utilidad Financiera (Rendimiento & Dividendos USDC):** Inversores financieros mantienen los tokens en su billetera Hedera (como HashPack) y cobran dividendos trimestrales en USDC provenientes de la colocación comercial de las pajuelas en remates ganaderos nacionales.

---

### ⚖️ Matriz Comparativa del Modelo Dual RWA

| Característica | 🐂 Activo Patrimonial (`BULL`) | 🧪 Activo de Producción (`PAJ-BRAF`) |
| :--- | :--- | :--- |
| **Concepto Subyacente** | **El propio reproductor bovino vivo en pie** | **Pajuela física de semen de 0.5 ml** |
| **Mecanismo Financiero** | Copropiedad / Equity fraccionable del animal | Dosis comercial indivisible / Rinde productivo |
| **Estándar Hedera (HTS)**| Fungible fraccionable (hasta 4 decimales) | Fungible entero indivisible (0 decimales) |
| **Suministro Máximo** | Finito estricto (Hasta 10.0000 cuotas partes) | Finito por salto/zafra (ej. 250 a 3,000 pajuelas) |
| **Custodia del Físico** | Cabaña emisora certificada por PEGBraf | Criocentro criogénico habilitado por SENASA (-196°C) |
| **Derechos del Inversor**| Plusvalía del toro, premios y regalías vitalicias | Canje físico para inseminación o dividendos USDC |
| **Perfil Típico** | Inversores patrimoniales y sindicatos ganaderos | Productores ganaderos (IATF) e inversores de renta |
| **Liquidación de Retorno**| USDC vía Smart Contract / Hedera HTS | USDC por venta física de dosis en remates |

---

## 🌐 Demo Funcional en Vivo

* **Aplicación Desplegada:** [https://muurketplace.vercel.app/](https://muurketplace.vercel.app/)

---

## 🔍 Evidencia Técnica — Hedera Testnet

Esta solución interactúa de manera nativa con la red **Hedera Testnet**, implementando contratos y tokens auditables públicamente en exploradores descentralizados:

| Parámetro | Registro Oficial en Red |
| :--- | :--- |
| **Blockchain** | Hedera Hashgraph (Testnet) |
| **Cuenta Tesorería (Cabaña)** | [`0.0.10989663`](https://hashscan.io/testnet/account/0.0.10989663) |
| **Token `PAJ-BRAF` (Don Luis)** | [`0.0.11043216`](https://hashscan.io/testnet/token/0.0.11043216) · 250 supply · 0 decimales |
| **Token `PAJ-PUCARA` (Pucará 459)** | [`0.0.11054878`](https://hashscan.io/testnet/token/0.0.11054878) · 250 supply · 0 decimales |
| **Token `PAJ-FEDER` (Col. Correntino)**| [`0.0.11054879`](https://hashscan.io/testnet/token/0.0.11054879) · 250 supply · 0 decimales |
| **Token `BULL` (Copropiedad Animal Vivo)**| [`0.0.11054880`](https://hashscan.io/testnet/token/0.0.11054880) · 10 supply · 4 decimales |
| **Transacción de Emisión Principal** | [`0.0.10989663@1792119170.496094920`](https://hashscan.io/testnet/transaction/0.0.10989663@1792119170.496094920) |

### Servicios de Hedera Utilizados:
1. **Hedera Token Service (HTS):** Emisión nativa de la arquitectura dual de activos: el activo productivo fraccionado `PAJ-BRAF` (1 dosis seminal de 0.5 ml) y la infraestructura para el equity patrimonial sobre el reproductor `BULL`. Los suministros están estrictamente delimitados y custodiados por la tesorería de la cabaña emisora, permitiendo a los compradores mantener la custodia soberana en billeteras compatibles (como HashPack).
2. **Hedera Consensus Service (HCS):** Servicio utilizado (en arquitectura y simulación de oráculo descentralizado) para sellar con marca temporal criptográfica e inmutable los certificados de inspección biológica, sumarios PEGBraf y registros secuenciales de órdenes de compra.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, Tailwind CSS, Lucide Icons, Canvas Confetti. Desplegado en **Vercel**.
* **Blockchain Core:** Node.js con SDK oficial [`@hashgraph/sdk`](https://www.npmjs.com/package/@hashgraph/sdk) v2.81+.
* **Base de Datos & Espejo Off-Chain:** **Supabase** (PostgreSQL con políticas RLS de lectura honesta).
* **Testing:** Suite nativa con `node --test` (sin dependencias pesadas, 411 pruebas unitarias y de integración).

---

## 🚀 Instrucciones de Ejecución Local

Sigue estos pasos para clonar, configurar y ejecutar el proyecto en tu máquina local:

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/BenZim13/muurketplace.git
cd muurketplace
npm install
```

### 2. Configurar las Variables de Entorno

Copia el archivo de ejemplo y completa tus credenciales de Hedera Testnet y Supabase:

```bash
cp .env.example .env
```

Edita `.env` con tus claves de desarrollo:

```env
# Credenciales Hedera Testnet (obtenidas gratuitamente en portal.hedera.com)
MY_ACCOUNT_ID=0.0.10989663
MY_PRIVATE_KEY=tu_clave_privada_ecdsa_o_der

# Servicios Opcionales / Espejo Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_publica_anon
```

> ⚠️ *Nota de Seguridad:* El archivo `.env` se encuentra ignorado por `.gitignore` y nunca debe ser commiteado al repositorio.

### 3. Ejecutar la Aplicación Web (Frontend)

Inicia el servidor de desarrollo local de Vite:

```bash
npm run dev
```

Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

### 4. Ejecutar el Script de Emisión de Tokens (Blockchain)

Para emitir un lote de tokens `PAJ-BRAF` en Hedera Testnet utilizando el SDK oficial:

```bash
node tokenizarToro.js
```

### 5. Correr la Suite de Pruebas Automatizadas

```bash
node --test tests/*.test.js
```

---

## 📋 Declaración de Originalidad

Este proyecto fue ideado, diseñado e implementado desde cero durante el ideathon **NEA Tech** y adaptado para los desafíos **"Hedera: Hello Future"** y **"NEA Productivo Digital"**. Todo el código fuente, la lógica de tasación ganadera y los contratos de integración con Hedera fueron desarrollados específicamente para este certamen.

---

## 🤖 Declaración de Uso de IA

Para el desarrollo de este proyecto se utilizaron herramientas de Inteligencia Artificial (Gemini y Antigravity) para asistir en la estructuración del código SDK de Hedera, el diseño de la interfaz visual y la redacción del modelo de negocio, cumpliendo con las bases del reglamento.

---

<p align="center">
  <b>MUURKET</b> — <i>Patrimonio Ganadero, Inteligencia Financiera.</i><br>
  Desarrollado para el Hackathon <b>Hedera: Hello Future</b> & <b>NEA Productivo Digital</b>.
</p>
