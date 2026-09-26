const crypto = require('crypto');
const express = require('express');
const path = require('path');
const { addOrigin, getAllowedOrigins, removeOrigin, signInAdmin } = require('../services/corsAllowlist');

const router = express.Router();
const sessionSecret = process.env.ADMIN_SESSION_SECRET || '';
const sessionMaxAge = 24 * 60 * 60 * 1000;

function sign(value) {
    return crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function createSession() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + sessionMaxAge })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

function hasValidSession(req) {
    if (!sessionSecret) return false;
    const token = req.cookies?.animeplus_admin;
    if (!token) return false;
    const [payload, signature] = token.split('.');
    const expectedSignature = sign(payload || '');
    if (!payload || !signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;
    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
    } catch {
        return false;
    }
}

function requireAdmin(req, res, next) {
    if (!hasValidSession(req)) return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    next();
}

router.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../../public/admin.html')));

router.post('/admin/api/login', async (req, res) => {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    try {
        const user = await signInAdmin(email, password);
        res.cookie('animeplus_admin', createSession(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: sessionMaxAge
        });
        return res.json({ ok: true, user: { id: user.id, email: user.email } });
    } catch (error) {
        return res.status(401).json({ ok: false, error: error.message });
    }
});

router.post('/admin/api/logout', (req, res) => {
    res.clearCookie('animeplus_admin');
    res.json({ ok: true });
});

router.get('/admin/api/me', (req, res) => res.json({ ok: true, authenticated: hasValidSession(req) }));

router.get('/admin/api/origins', requireAdmin, async (req, res) => {
    try {
        res.json({ ok: true, origins: await getAllowedOrigins(true) });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/admin/api/origins', requireAdmin, async (req, res) => {
    try {
        res.status(201).json({ ok: true, origin: await addOrigin(req.body?.origin) });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.delete('/admin/api/origins', requireAdmin, async (req, res) => {
    try {
        await removeOrigin(req.body?.origin);
        res.json({ ok: true });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

module.exports = router;
