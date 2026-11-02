// Le categorie degli oggetti, nell'ordine in cui le mostriamo, con il nome da far vedere.
// È la stessa lista chiusa del database (tipo categoria_oggetto). Sta in un file suo perché
// la usano più pagine (armadio e scheda viaggio): un solo posto da aggiornare.
export const CATEGORIE = {
  abbigliamento: "Abbigliamento",
  attrezzatura: "Attrezzatura",
  cucina: "Cucina",
  sicurezza: "Sicurezza",
  igiene: "Igiene",
  elettronica: "Elettronica",
  cibo: "Cibo",
  altro: "Altro",
};

// Le attività dei viaggi, con il nome da far vedere. "escursione" comprende anche il trekking:
// in giornata o su più giorni lo dicono già i campi giorni e pernotto.
export const ATTIVITA = {
  escursione: "Escursione e trekking",
  alpinismo: "Alpinismo",
  ciaspolata: "Ciaspolata",
  ferrata: "Ferrata",
};
