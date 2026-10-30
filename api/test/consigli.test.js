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
