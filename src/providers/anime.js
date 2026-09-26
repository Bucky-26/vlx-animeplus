/**
 * Anime Provider - MegaPlay & AniList Integration
 * Resolves anime metadata from AniList GraphQL and extracts decrypted HLS streams from MegaPlay.
 */

const crypto = require('crypto');
const fetch = typeof global.fetch !== 'undefined' ? global.fetch : require('node-fetch');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://megaplay.buzz/'
};

// Cache metadata in memory for 1 hour to prevent redundant external API hits
const metaCache = new Map();
const streamCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Fetch Anime details and images from AniList GraphQL API
 * @param {number|string} anilistId
 * @returns {Promise<Object>}
 */
async function getAniListMeta(anilistId) {
    const id = parseInt(anilistId, 10);
    if (!id || isNaN(id)) return null;

    const cached = metaCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const query = `
    query ($id: Int) {
        Media (id: $id, type: ANIME) {
            id
            idMal
            title {
                romaji
                english
                native
            }
            bannerImage
            coverImage {
                extraLarge
                large
                medium
                color
            }
            episodes
            duration
            genres
            averageScore
            description
            seasonYear
            status
        }
    }
    `;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id } }),
            timeout: 10000
        });

        const json = await res.json();
        const m = json.data && json.data.Media;
        if (!m) return null;

        const poster = m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || null;
        const backdrop = m.bannerImage || poster;
        const title = m.title?.english || m.title?.romaji || m.title?.native || `Anime ${id}`;

        const data = {
            id: m.id,
            malId: m.idMal,
            title,
            titleRomaji: m.title?.romaji,
            titleNative: m.title?.native,
            poster,
            backdrop,
            color: m.coverImage?.color || '#6366f1',
            episodes: m.episodes || 1,
            duration: m.duration || 24,
            genres: m.genres || [],
            year: m.seasonYear || null,
            score: m.averageScore || null,
            status: m.status || 'FINISHED',
            overview: m.description ? m.description.replace(/<[^>]*>/g, '').trim() : ''
        };

        metaCache.set(id, { data, timestamp: Date.now() });
        return data;
    } catch (e) {
        console.error('[Anime] AniList meta fetch error:', e.message);
        return {
            id,
            title: `Anime ${id}`,
            poster: null,
            backdrop: null,
            episodes: 1,
            genres: []
        };
    }
}

/**
 * Decrypt MegaPlay AES-256-CBC encrypted payload
 * @param {string} enc - URL-safe Base64 encrypted string
 * @returns {Object} Decrypted JSON object
 */
function decryptMegaPlayEnc(enc) {
    // 32-byte key: "i?LMTAx0Q6,:}50U" zero-padded to 32 bytes
    const key = Buffer.alloc(32);
    Buffer.from('i?LMTAx0Q6,:}50U').copy(key);

    // 16-byte IV: "W0;27ToaUpl_P%'c"
    const iv = Buffer.alloc(16);
    Buffer.from("W0;27ToaUpl_P%'c").copy(iv);

    const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
    const ciphertext = Buffer.from(b64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}

/**
 * Resolve MegaPlay stream for a given anilistId and episode number
 * @param {number|string} anilistId
 * @param {number|string} episode
 * @param {string} lang - 'sub' or 'dub'
 * @returns {Promise<Object>}
 */
async function resolveAnimeStream(anilistId, episode = 1, lang = 'sub') {
    const ep = parseInt(episode, 10) || 1;
    const cacheKey = `${anilistId}-${ep}-${lang}`;

    const cached = streamCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minutes cache for stream URLs
        return cached.data;
    }

    const embedUrl = `https://megaplay.buzz/stream/ani/${encodeURIComponent(anilistId)}/${encodeURIComponent(ep)}/${encodeURIComponent(lang)}`;
    const embedRes = await fetch(embedUrl, {
        headers: HEADERS,
        timeout: 15000
    });

    const html = await embedRes.text();
    const dataIdMatch = html.match(/id=["']megaplay-player["'][^>]*data-id=["'](\d+)["']/) ||
                        html.match(/data-id=["'](\d+)["'][^>]*id=["']megaplay-player["']/);

    if (!dataIdMatch) {
        throw new Error(`MegaPlay stream not found for AniList ID ${anilistId} Episode ${ep}`);
    }

    const dataId = dataIdMatch[1];
    const sourcesUrl = `https://megaplay.buzz/stream/getSources?id=${encodeURIComponent(dataId)}`;
    const sourcesRes = await fetch(sourcesUrl, {
        headers: {
            ...HEADERS,
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
    });

    const sourcesData = await sourcesRes.json();
    if (!sourcesData || !sourcesData.enc) {
        throw new Error('Sources response did not return an encrypted payload');
    }

    const decrypted = decryptMegaPlayEnc(sourcesData.enc);
    const masterUrl = decrypted.file;

    // Fetch and parse master playlist to determine available resolution streams
    const masterRes = await fetch(masterUrl, {
        headers: { 'Referer': 'https://megaplay.buzz/' },
        timeout: 10000
    });
    const masterText = await masterRes.text();

    const streams = [];
    const lines = masterText.split(/\r?\n/);
    let currentStream = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            const bwMatch = line.match(/BANDWIDTH=(\d+)/);
            currentStream = {
                resolution: resMatch ? resMatch[1] : 'auto',
                bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
                quality: resMatch ? `${resMatch[1].split('x')[1]}p` : 'Auto'
            };
        } else if (line && !line.startsWith('#') && currentStream) {
            currentStream.url = new URL(line, masterUrl).href;
            streams.push(currentStream);
            currentStream = null;
        }
    }

    const result = {
        masterUrl,
        streams,
        tracks: sourcesData.tracks || [],
        intro: sourcesData.intro || null,
        outro: sourcesData.outro || null,
        server: sourcesData.server || null
    };

    streamCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
}

/**
 * Fetch upstream m3u8 playlist and rewrite all sub-playlists and media segment URLs to route through proxy
 * @param {string} targetUrl - Upstream m3u8 URL
 * @param {string} origin - Server base URL (e.g. http://localhost:3000)
 * @returns {Promise<string>}
 */
async function fetchAndRewriteM3u8(targetUrl, origin) {
    const res = await fetch(targetUrl, {
        headers: {
            'User-Agent': HEADERS['User-Agent'],
            'Referer': 'https://megaplay.buzz/'
        },
        timeout: 15000
    });

    if (!res.ok) {
        throw new Error(`Upstream returned HTTP ${res.status}`);
    }

    const content = await res.text();
    const isMaster = content.includes('#EXT-X-STREAM-INF');
    const lines = content.split(/\r?\n/);
    const rewritten = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (!line) {
            rewritten.push(line);
            continue;
        }

        if (line.startsWith('#')) {
            // Rewrite URI in tags like #EXT-X-KEY:METHOD=...,URI="..."
            if (line.includes('URI="')) {
                line = line.replace(/URI="([^"]+)"/, (m, uri) => {
                    const absUri = new URL(uri, targetUrl).href;
                    const proxiedUri = `${origin}/anime/proxy?url=${encodeURIComponent(absUri)}`;
                    return `URI="${proxiedUri}"`;
                });
            }
            rewritten.push(line);
            continue;
        }

        // URL line (either sub-playlist or segment)
        const absUrl = new URL(line, targetUrl).href;
        if (isMaster) {
            // Master playlist: sub-playlists should also be rewritten via /anime/m3u8
            rewritten.push(`${origin}/anime/m3u8?url=${encodeURIComponent(absUrl)}`);
        } else {
            // Media playlist: chunks should be routed via /anime/proxy
            rewritten.push(`${origin}/anime/proxy?url=${encodeURIComponent(absUrl)}`);
        }
    }

    return rewritten.join('\n');
}

module.exports = {
    getAniListMeta,
    decryptMegaPlayEnc,
    resolveAnimeStream,
    fetchAndRewriteM3u8
};
