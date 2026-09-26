/**
 * Anime Streaming & Player Routes
 * Endpoints:
 *   GET /anime/m3u8?url=...
 *   GET /anime/proxy?url=...
 *   GET /anime/:id
 *   GET /anime/:id/:ep
 *   GET /anime/:id/:s/:ep
 *   GET /api/anime/:id
 *   GET /api/anime/:id/:ep
 *   GET /api/anime/:id/:s/:ep
 */

const express = require('express');
const router = express.Router();
const { Readable } = require('stream');
const fetch = require('node-fetch');
const { anime } = require('../providers');
const { generateAnimePlayerHTML } = require('../templates');

/**
 * Helper to determine protocol & host for full URLs
 */
function getOrigin(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    return `${protocol}://${host}`;
}

// ============================================
// 1. STATIC PROXY ROUTES (Must be before parameterized routes)
// ============================================

/**
 * Dynamic HLS Playlist Proxy & Rewriter
 * GET /anime/m3u8?url=ENCODED_URL
 */
router.get(['/anime/m3u8', '/api/anime/m3u8'], async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const origin = getOrigin(req);
        const rewritten = await anime.fetchAndRewriteM3u8(targetUrl, origin);

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
    } catch (err) {
        console.error('[Anime] M3U8 rewrite error:', err.message);
        res.status(500).send('Failed to fetch/rewrite playlist');
    }
});

/**
 * Media Segment Stream Proxy
 * Forwards requests to upstream CDN with 'Referer: https://megaplay.buzz/' to bypass 403 Forbidden.
 * GET /anime/proxy?url=ENCODED_URL
 */
router.get(['/anime/proxy', '/api/anime/proxy'], async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://megaplay.buzz/'
        };

        if (req.headers.range) {
            fetchHeaders['Range'] = req.headers.range;
        }

        const upstreamRes = await fetch(targetUrl, {
            headers: fetchHeaders,
            timeout: 30000
        });

        res.status(upstreamRes.status);

        // Pass essential headers back
        const ct = upstreamRes.headers.get('content-type') || 'video/mp2t';
        res.set('Content-Type', ct);

        const cl = upstreamRes.headers.get('content-length');
        if (cl) res.set('Content-Length', cl);

        const ar = upstreamRes.headers.get('accept-ranges');
        if (ar) res.set('Accept-Ranges', ar);

        const cr = upstreamRes.headers.get('content-range');
        if (cr) res.set('Content-Range', cr);

        if (upstreamRes.body) {
            const stream = typeof upstreamRes.body.pipe === 'function'
                ? upstreamRes.body
                : Readable.fromWeb(upstreamRes.body);

            stream.on('error', (err) => {
                console.error('[Anime] Proxy stream error:', err.message);
                if (!res.headersSent) {
                    res.status(500).send('Stream error');
                } else {
                    res.destroy();
                }
            });

            res.on('close', () => {
                if (stream.destroy) {
                    stream.destroy();
                }
            });

            stream.pipe(res);
        } else {
            res.end();
        }

    } catch (err) {
        console.error('[Anime] Proxy segment error:', err.message);
        if (!res.headersSent) {
            res.status(500).send('Segment proxy error');
        } else {
            res.destroy();
        }
    }
});

/**
 * Helper to shift WebVTT cue timestamps by offsetSeconds
 */
function shiftVttTimestamps(vttText, offsetSeconds) {
    if (!offsetSeconds || isNaN(offsetSeconds)) return vttText;

    function timeToSeconds(str) {
        const parts = str.trim().split(':');
        let h = 0, m = 0, s = 0;
        if (parts.length === 3) {
            h = parseFloat(parts[0]);
            m = parseFloat(parts[1]);
            s = parseFloat(parts[2].replace(',', '.'));
        } else if (parts.length === 2) {
            m = parseFloat(parts[0]);
            s = parseFloat(parts[1].replace(',', '.'));
        }
        return h * 3600 + m * 60 + s;
    }

    function secondsToTime(totalSec) {
        const clamped = Math.max(0, totalSec);
        const h = Math.floor(clamped / 3600);
        const m = Math.floor((clamped % 3600) / 60);
        const s = (clamped % 60).toFixed(3);
        const [secInt, secMs] = s.split('.');
        const pad = (n, width = 2) => String(n).padStart(width, '0');
        return `${pad(h)}:${pad(m)}:${pad(secInt)}.${secMs.padEnd(3, '0')}`;
    }

    const timeRegex = /(\d{2}:\d{2}:\d{2}[\.,]\d{3}|\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3}|\d{2}:\d{2}[\.,]\d{3})/g;
    return vttText.replace(timeRegex, (match, startStr, endStr) => {
        const startSec = timeToSeconds(startStr) + offsetSeconds;
        const endSec = timeToSeconds(endStr) + offsetSeconds;
        return `${secondsToTime(startSec)} --> ${secondsToTime(endSec)}`;
    });
}

/**
 * Dynamic Subtitle / WebVTT Proxy
 * Forwards requests with 'Referer: https://megaplay.buzz/' to bypass Cloudflare 403 Forbidden,
 * injects HLS MPEG-TS synchronization header (X-TIMESTAMP-MAP),
 * supports server-side timing shift (?offset=X),
 * and ensures Content-Type: text/vtt; charset=utf-8 with CORS headers.
 * GET /anime/sub?url=ENCODED_URL&offset=0
 */
router.get(['/anime/sub', '/api/anime/sub'], async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://megaplay.buzz/'
        };

        const upstreamRes = await fetch(targetUrl, {
            headers: fetchHeaders,
            timeout: 15000
        });

        if (!upstreamRes.ok) {
            console.error(`[Anime] Subtitle fetch failed with status ${upstreamRes.status} for ${targetUrl}`);
            return res.status(upstreamRes.status).send('Failed to fetch subtitle');
        }

        let vttText = await upstreamRes.text();

        // Strip UTF-8 BOM if present
        if (vttText.charCodeAt(0) === 0xFEFF) {
            vttText = vttText.slice(1);
        }

        // Apply time offset if requested
        const offset = parseFloat(req.query.offset);
        if (Number.isFinite(offset) && offset !== 0) {
            vttText = shiftVttTimestamps(vttText, offset);
        }

        // Inject X-TIMESTAMP-MAP for Video.js HLS (VHS) MPEG-TS synchronization
        // Maps local 00:00:00.000 to MPEGTS presentation timestamp 0
        if (!vttText.includes('X-TIMESTAMP-MAP=')) {
            vttText = vttText.replace(/^WEBVTT[^\r\n]*/, (match) => {
                return `${match}\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0`;
            });
        }

        res.set('Content-Type', 'text/vtt; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(vttText);
    } catch (err) {
        console.error('[Anime] Subtitle proxy error:', err.message);
        res.status(500).send('Failed to proxy subtitle');
    }
});

router.options(['/anime/sub', '/api/anime/sub'], (req, res) => {
    res.sendStatus(204);
});

// ============================================
// 2. DEDICATED API ROUTES
// ============================================

router.get(['/api/anime/:id/:s/:ep', '/api/anime/:id/:s/:ep/'], async (req, res) => {
    req.query.format = req.query.format === 'json' ? 'json' : 'html';
    const { id, s, ep } = req.params;
    await handleAnimeRequest(req, res, id, s, ep, true);
});

router.get(['/api/anime/:id/:ep', '/api/anime/:id/:ep/'], async (req, res) => {
    req.query.format = req.query.format === 'json' ? 'json' : 'html';
    const { id, ep } = req.params;
    await handleAnimeRequest(req, res, id, 1, ep, false);
});

router.get(['/api/anime/:id', '/api/anime/:id/'], async (req, res) => {
    req.query.format = req.query.format === 'json' ? 'json' : 'html';
    const { id } = req.params;
    const hasSeason = Boolean(req.query.s || req.query.season);
    const season = req.query.s || req.query.season || 1;
    const episode = req.query.ep || req.query.episode || 1;
    await handleAnimeRequest(req, res, id, season, episode, hasSeason);
});

// ============================================
// 3. PARAMETERIZED PLAYER ROUTES
// ============================================

/**
 * Route: /anime/:id/:s/:ep (e.g. /anime/21/1/1)
 */
router.get(['/anime/:id/:s/:ep', '/anime/:id/:s/:ep/'], async (req, res) => {
    const { id, s, ep } = req.params;
    await handleAnimeRequest(req, res, id, s, ep, true);
});

/**
 * Route: /anime/:id/:ep (e.g. /anime/21/1)
 */
router.get(['/anime/:id/:ep', '/anime/:id/:ep/'], async (req, res) => {
    const { id, ep } = req.params;
    await handleAnimeRequest(req, res, id, 1, ep, false);
});

/**
 * Route: /anime/:id (e.g. /anime/21 or /anime/21?s=1&ep=2)
 */
router.get(['/anime/:id', '/anime/:id/'], async (req, res) => {
    const { id } = req.params;
    const hasSeason = Boolean(req.query.s || req.query.season);
    const season = req.query.s || req.query.season || 1;
    const episode = req.query.ep || req.query.episode || 1;
    await handleAnimeRequest(req, res, id, season, episode, hasSeason);
});

/**
 * Core Anime Request Handler
 */
async function handleAnimeRequest(req, res, anilistId, season = 1, episode = 1, hasSeason = false) {
    const s = parseInt(season, 10) || 1;
    const ep = parseInt(episode, 10) || 1;
    const lang = (req.query.lang || 'sub').toLowerCase();
    const isJson = req.query.format === 'json' || (req.accepts('json') && !req.accepts('html'));
    const origin = getOrigin(req);

    try {
        // Fetch AniList metadata
        const meta = await anime.getAniListMeta(anilistId);
        if (!meta) {
            if (isJson) return res.status(404).json({ ok: false, error: 'Anime not found on AniList' });
            return res.status(404).send('<h1>404 - Anime not found on AniList</h1>');
        }

        // Resolve MegaPlay stream
        let streamData = null;
        let streamError = null;

        try {
            streamData = await anime.resolveAnimeStream(anilistId, ep, lang);
        } catch (err) {
            streamError = err.message;
            console.warn(`[Anime] Stream resolve notice for ${anilistId} S${s} E${ep}:`, err.message);
        }

        const proxiedM3u8Url = streamData?.masterUrl 
            ? `${origin}/anime/m3u8?url=${encodeURIComponent(streamData.masterUrl)}`
            : null;

        const proxiedTracks = (streamData?.tracks || []).map(t => {
            const rawFile = t.file;
            const isHttp = rawFile && rawFile.startsWith('http') && !rawFile.includes('/anime/sub');
            const proxiedFile = isHttp ? `${origin}/anime/sub?url=${encodeURIComponent(rawFile)}` : rawFile;
            return {
                ...t,
                file: proxiedFile,
                rawFile: rawFile
            };
        });

        if (isJson) {
            return res.json({
                ok: !streamError,
                anilistId: parseInt(anilistId, 10),
                season: s,
                episode: ep,
                hasSeason,
                lang,
                meta,
                streamUrl: proxiedM3u8Url,
                rawMasterUrl: streamData?.masterUrl || null,
                streams: streamData?.streams || [],
                tracks: proxiedTracks,
                rawTracks: streamData?.tracks || [],
                intro: streamData?.intro || null,
                outro: streamData?.outro || null,
                error: streamError
            });
        }

        // Render HTML player with poster displayed on load and on start
        const html = generateAnimePlayerHTML({
            anilistId: parseInt(anilistId, 10),
            season: s,
            hasSeason,
            episode: ep,
            lang,
            title: meta.title,
            titleRomaji: meta.titleRomaji,
            poster: meta.poster,
            backdrop: meta.backdrop,
            episodes: meta.episodes,
            genres: meta.genres,
            year: meta.year,
            overview: meta.overview,
            m3u8Url: proxiedM3u8Url || '',
            streams: streamData?.streams || [],
            tracks: proxiedTracks,
            intro: streamData?.intro || null,
            outro: streamData?.outro || null
        });

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        console.error('[Anime] Handler error:', err);
        if (isJson) {
            return res.status(500).json({ ok: false, error: err.message });
        }
        res.status(500).send(`<h1>500 - Streaming Error</h1><p>${err.message}</p>`);
    }
}

module.exports = router;
