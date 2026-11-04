import app from "./app.js";
import { avviaPulizia } from "./services/pulizia.js"; // 4/11 (privacy): link scaduti e account mai confermati

const port = process.env.PORT ?? 3000;

app.listen(port, (err) => {
  if (err) {
    console.error(`Impossibile avviare il server sulla porta ${port}: ${err.message}`);
    process.exit(1);
  }
  // Con npm run dev: http://localhost:3000. Con Docker si entra da Caddy: https://localhost
  console.log(`API in ascolto sulla porta ${port}`);
  // La pulizia parte qui e non in app.js: così i test, che importano app.js, non fanno partire il timer
  avviaPulizia();
});