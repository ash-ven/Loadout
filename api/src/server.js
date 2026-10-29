import app from "./app.js";

const port = process.env.PORT ?? 3000;

app.listen(port, (err) => {
  if (err) {
    console.error(`Impossibile avviare il server sulla porta ${port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`API in ascolto su http://localhost:${port}`);
});