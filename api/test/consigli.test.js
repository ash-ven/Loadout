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

test("ora limite di partenza: tramonto 16:55, 6,5 ore di cammino, 1 ora di margine → 09:25, arrotondata al quarto d'ora prima: 09:15", async () => {
  const { oraLimitePartenza } = await import("../src/services/consigli.js");
  assert.deepEqual(oraLimitePartenza("07:05", "16:55", 6.5),
    { ora: "09:15", prima_dell_alba: false, margine_ore: 1, ora_partenza: null, in_ritardo: false });
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

// --- Meteo in vetta (mappe, fase 1) ---

test("ora limite: se parti alle 10:00 e il limite è 09:25 sei in ritardo; alle 08:00 no", async () => {
  const { oraLimitePartenza } = await import("../src/services/consigli.js");
  assert.equal(oraLimitePartenza("07:05", "16:55", 6.5, 1, "10:00").in_ritardo, true);
  assert.equal(oraLimitePartenza("07:05", "16:55", 6.5, 1, "08:00").in_ritardo, false);
});

// Una traccia finta: tre punti in fila verso nord, la quota sale fino al secondo e poi scende
const traccia = { linea: [[44.0, 11.0, 1000], [44.01, 11.0, 1400], [44.02, 11.0, 1100]] };

test("punto più alto: il secondo punto della traccia; senza quote o senza traccia → null", async () => {
  const { puntoPiuAlto } = await import("../src/services/consigli.js");
  assert.deepEqual(puntoPiuAlto(traccia), { lat: 44.01, lon: 11.0, quota: 1400, indice: 1 });
  assert.equal(puntoPiuAlto({ linea: [[44, 11], [44.1, 11]] }), null);
  assert.equal(puntoPiuAlto(null), null);
});

test("ore fino alla vetta: con la traccia km/4 + salita/400; senza traccia metà del giorno; senza niente null", async () => {
  const { oreFinoAllaVetta } = await import("../src/services/consigli.js");
  // 0,01° di latitudine ≈ 1,11 km → 1,11/4 + 400/400 ≈ 1,28 ore
  assert.ok(Math.abs(oreFinoAllaVetta(traccia) - 1.28) < 0.01);
  assert.equal(oreFinoAllaVetta(null, 6), 3);
  assert.equal(oreFinoAllaVetta(null), null);
});

test("vento in vetta: sotto 40 niente, poi sostenuto, forte (da 62) e molto forte (da 88)", async () => {
  const { avvisoVento } = await import("../src/services/consigli.js");
  assert.equal(avvisoVento(39), null);
  assert.equal(avvisoVento(40).livello, "sostenuto");
  assert.equal(avvisoVento(62).livello, "forte");
  assert.equal(avvisoVento(88).livello, "molto_forte");
  assert.equal(avvisoVento(null), null);
});

test("risposta di Open-Meteo per la vetta: valori all'ora di arrivo, zero termico minimo di giorno, temporali", async () => {
  const { daMeteoVetta, avvisiVetta } = await import("../src/services/consigli.js");
  const ore = (f) => Array.from({ length: 24 }, (_, h) => f(h));
  const json = {
    daily: { temperature_2m_min: [-1], temperature_2m_max: [6], apparent_temperature_min: [-6],
             wind_gusts_10m_max: [65], weather_code: [95] },
    hourly: { temperature_2m: ore((h) => h / 4), apparent_temperature: ore((h) => h / 4 - 2),
              wind_gusts_10m: ore(() => 30), weather_code: ore(() => 3),
              // di notte lo zero termico è basso (1200 m), di giorno scende al minimo a 1800 m alle 9
              freezing_level_height: ore((h) => (h < 7 ? 1200 : h === 9 ? 1800 : 2600)) },
  };
  const vetta = daMeteoVetta(json, 1945, 11, "traccia");
  assert.equal(vetta.temp, 2.8);          // alle 11: 11/4 = 2,75 → 2,8
  assert.equal(vetta.percepita, 0.8);     // 2,75 − 2 = 0,75 → 0,8
  assert.equal(vetta.zero_termico_m, 1800); // la notte (1200 m) non conta
  assert.equal(vetta.temporali, true);
  assert.equal(vetta.percepita_min, -6);
  // avvisi: vento forte (raffiche max 65), zero termico sotto la vetta, temporali
  assert.deepEqual(avvisiVetta(vetta).map((a) => a.tipo), ["vento", "zero_termico", "temporali"]);
});

test("A1: la traccia vale per il meteo in vetta solo se arriva alla quota massima scritta (±100 m)", async () => {
  const { vettaDallaTraccia } = await import("../src/services/consigli.js");
  const traccia = { linea: [[44.13, 10.59, 1239], [44.14, 10.60, 1511], [44.15, 10.61, 1300]] };
  assert.equal(vettaDallaTraccia(traccia, 1511).quota, 1511); // la traccia arriva in vetta: si usa il suo punto più alto
  assert.equal(vettaDallaTraccia(traccia, 1580).quota, 1511); // entro 100 m: va bene
  assert.equal(vettaDallaTraccia(traccia, 2165), null);       // hai scritto 2.165 m, la traccia si ferma a 1.511: non vale
  assert.equal(vettaDallaTraccia(null, 2165), null);
});
