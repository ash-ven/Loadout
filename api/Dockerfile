# =====================================================================
#  Immagine Docker dell'API di Loadout (serve anche il frontend in public/)
#  Si costruisce dalla RADICE del progetto (il compose usa context: .),
#  perché servono sia api/ sia public/:
#    docker build -f api/Dockerfile -t loadout-api .
# =====================================================================

# 1. Punto di partenza: Node 22 su Debian "slim" (piccola, ma con le librerie
#    che servono a bcrypt, che contiene codice compilato)
FROM node:22-slim

# 2. Modalità produzione: cookie "Secure", npm non installa le dipendenze di sviluppo
ENV NODE_ENV=production

# 3. La stessa struttura di cartelle del progetto: /app/api e /app/public
#    (app.js cerca il frontend in "../../public" rispetto a api/src)
WORKDIR /app/api

# 4. Prima SOLO package.json e package-lock.json, poi npm ci.
#    Docker riusa i livelli (cache): se cambi il codice ma non le dipendenze,
#    al build successivo npm ci non viene rifatto.
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev

# 5. Poi il codice e il frontend
COPY api/src ./src
COPY public /app/public

# 6. Non girare come root: l'utente "node" esiste già nell'immagine ufficiale
USER node

# 7. La porta su cui ascolta Express (documentazione: la apre davvero il compose)
EXPOSE 3000

# 8. Il comando di avvio (niente --watch e niente --env-file: le variabili le dà il compose)
CMD ["node", "src/server.js"]
