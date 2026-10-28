import { query } from "../db.js";

// Riempie lo zaino con indispensabili e preferiti (logica nel database)
export async function genera(viaggioId) {
  const { rows } = await query("SELECT fn_genera_zaino($1) AS aggiunti", [viaggioId]);
  return rows[0].aggiunti;
}

// La checklist: una riga per oggetto, con categoria, peso, quantità, inserito
export async function dettaglio(viaggioId) {
  const { rows } = await query(
    "SELECT * FROM v_zaino_dettaglio WHERE viaggio_id = $1 ORDER BY categoria, nome",
    [viaggioId]
  );
  return rows;
}

// Il peso: totale e già inserito, in grammi e in kg con 2 decimali
export async function peso(viaggioId) {
  const { rows } = await query(
    `SELECT n_oggetti, peso_totale_g, peso_inserito_g, peso_totale_kg,
            ROUND(peso_inserito_g / 1000.0, 2) AS peso_inserito_kg
     FROM v_zaino_peso
     WHERE viaggio_id = $1`,
    [viaggioId]
  );
  return rows[0];
}