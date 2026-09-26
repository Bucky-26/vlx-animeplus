require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { anime } = require('./src/providers');
const animeRoutes = require('./src/routes/anime');
const adminRoutes = require('./src/routes/admin');
const { getAllowedOrigins, isOriginAllowed } = require('./src/services/corsAllowlist');

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const isSameOrigin = origin === `${protocol}://${host}`;
        const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (!isSameOrigin && !isLocalDevelopmentOrigin && !(await isOriginAllowed(origin))) {
            return res.status(403).json({ ok: false, error: 'Origin is not allowlisted' });
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    } catch (error) {
        next(error);
    }
});
app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/', adminRoutes);
app.use('/', animeRoutes);

app.get('/health', async (req, res) => {
    let origins = [];
    try { origins = await getAllowedOrigins(); } catch {}
    res.json({ status: 'ok', service: 'vlx-animeplus', corsOrigins: origins.length });
});

app.get('/', (req, res) => {
    if (req.query.format === 'json') {
        return res.json({
            name: 'vlx-animeplus',
            endpoints: {
                anime: '/anime/:anilistId/:episode',
                api: '/api/anime/:anilistId/:episode',
                admin: '/admin',
                health: '/health'
            }
        });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
    console.error('[AnimePlus]', error);
    if (res.headersSent) return next(error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});

if (require.main === module) {
    app.listen(port, () => console.log(`vlx-animeplus listening on http://localhost:${port}`));
}

module.exports = app;
