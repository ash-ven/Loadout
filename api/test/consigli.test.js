// Test dei consigli di vestiario: la sensibilità al freddo del profilo cambia i consigli.
import { test } from "node:test";
import assert from "node:assert/strict";
import { consigliVestiario } from "../src/services/consigli.js";

test("vestiario: con 10–20 °C e profilo normale bastano gli strati", () => {
  assert.deepEqual(consigliVestiario(10, 20, 0), ["Abbigliamento a strati: temperature miti"]);
});

test("vestiario: chi soffre il freddo a 10 °C riceve il pile", () => {
  const consigli = consigliVestiario(10, 20, 0, "alta");
  assert.ok(consigli.includes("Pile o piumino leggero per le ore più fresche"));
  assert.ok(consigli.includes("Consigli adattati al tuo profilo: soffri il freddo"));
});

test("vestiario: chi sente poco il freddo a 6 °C non riceve il pile", () => {
  const consigli = consigliVestiario(6, 15, 0, "bassa");
  assert.ok(!consigli.includes("Pile o piumino leggero per le ore più fresche"));
});

test("vestiario: sotto zero vero vale per tutti, la pioggia non dipende dal profilo", () => {
  const consigli = consigliVestiario(-3, 4, 70, "bassa");
  assert.ok(consigli.includes("Strati termici, guanti e berretto: si va sotto zero"));
  assert.ok(consigli.includes("Giacca impermeabile e copri-zaino"));
});

test("ora limite di partenza: tramonto 16:55, 6,5 ore di cammino, 1 ora di margine → 09:25", async () => {
  const { oraLimitePartenza } = await import("../src/services/consigli.js");
  assert.deepEqual(oraLimitePartenza("07:05", "16:55", 6.5), { ora: "09:25", prima_dell_alba: false, margine_ore: 1 });
});

test("ora limite di partenza: cammino più lungo delle ore di luce → avviso; senza ore → null", async () => {
  const { oraLimitePartenza } = await import("../src/services/consigli.js");
  assert.equal(oraLimitePartenza("07:05", "16:55", 10).prima_dell_alba, true);
  assert.equal(oraLimitePartenza("07:05", "16:55", null), null);
});

test("stima in cima: 1250 m → 2400 m, cioè 1150 m di salita = 6,9 °C in meno", async () => {
  const { stimaInCima } = await import("../src/services/consigli.js");
  assert.deepEqual(stimaInCima(-4.9, 3.5, 1250, 2400), { quota_m: 2400, temp_min: -11.8, temp_max: -3.4 });
  assert.equal(stimaInCima(5, 12, 1500, 1200), null); // la "cima" è più in basso della partenza
});

test("rischio neve: sopra i 2000 m da ottobre a maggio, d'estate solo se gela; sotto i 2000 mai", async () => {
  const { rischioNeve } = await import("../src/services/consigli.js");
  assert.equal(rischioNeve(2400, "2026-11-08"), true);
  assert.equal(rischioNeve(2400, "2026-07-20", 6), false);
  assert.equal(rischioNeve(2400, "2026-07-20", -1), true);
  assert.equal(rischioNeve(1800, "2026-12-20"), false);
});

test("vestiario: con il vento forte arriva la giacca antivento", () => {
  assert.ok(consigliVestiario(10, 20, 0, null, 35).includes("Giacca antivento: il vento fa sentire più freddo"));
});

test("soglia del peso: 10% in giornata, 20% con il pernotto", async () => {
  const { sogliaPeso } = await import("../src/services/consigli.js");
  assert.deepEqual(sogliaPeso(57, "nessuno"), { percento: 10, soglia_kg: 5.7 });
  assert.deepEqual(sogliaPeso(57, "rifugio"), { percento: 20, soglia_kg: 11.4 });
});
