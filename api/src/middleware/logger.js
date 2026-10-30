// api/src/middleware/logger.js
export function logger(req, res, next) {
    if (process.env.NODE_TEST_CONTEXT) return next(); // durante "npm test" non riempiamo il terminale
    const start = Date.now();
    res.on("finish", () => {
        console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
}