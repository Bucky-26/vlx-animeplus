const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;
const authClient = supabaseUrl && (process.env.SUPABASE_ANON_KEY || serviceRoleKey)
    ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || serviceRoleKey, { auth: { persistSession: false } })
    : null;

const cacheTtl = Number(process.env.CORS_CACHE_TTL_MS || 60000);
let cachedOrigins = null;
let cachedAt = 0;
let missingTableWarningShown = false;

function getFallbackOrigins() {
    return (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

function normalizeOrigin(value) {
    const parsed = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' && parsed.pathname !== '') {
        throw new Error('Origin must be an http(s) origin without a path');
    }
    return parsed.origin;
}

async function getAllowedOrigins(force = false) {
    if (!force && cachedOrigins && Date.now() - cachedAt < cacheTtl) return cachedOrigins;
    if (!supabase) {
        cachedOrigins = [];
        cachedAt = Date.now();
        return cachedOrigins;
    }

    const { data, error } = await supabase
        .from('cors_origins')
        .select('origin')
        .eq('enabled', true)
        .order('origin');
    if (error) {
        if (error.code === 'PGRST205') {
            if (!missingTableWarningShown) {
                console.warn('[AnimePlus] Supabase table public.cors_origins is missing. Using CORS_ALLOWED_ORIGINS fallback until supabase.sql is applied.');
                missingTableWarningShown = true;
            }
            cachedOrigins = getFallbackOrigins();
            cachedAt = Date.now();
            return cachedOrigins;
        }
        throw error;
    }

    cachedOrigins = (data || []).map(row => row.origin);
    cachedAt = Date.now();
    return cachedOrigins;
}

async function isOriginAllowed(origin) {
    if (!origin) return true;
    const origins = await getAllowedOrigins();
    return origins.includes(origin);
}

async function addOrigin(value) {
    const origin = normalizeOrigin(value);
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
        .from('cors_origins')
        .upsert({ origin, enabled: true }, { onConflict: 'origin' })
        .select()
        .single();
    if (error) throw error;
    await getAllowedOrigins(true);
    return data;
}

async function removeOrigin(value) {
    const origin = normalizeOrigin(value);
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.from('cors_origins').delete().eq('origin', origin);
    if (error) throw error;
    await getAllowedOrigins(true);
}

async function signInAdmin(email, password) {
    if (!authClient) throw new Error('Supabase is not configured');
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error('Invalid Supabase email or password');

    const allowedEmails = (process.env.SUPABASE_ADMIN_EMAILS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    if (allowedEmails.length && !allowedEmails.includes(data.user.email?.toLowerCase())) {
        throw new Error('Supabase account is not an AnimePlus admin');
    }

    return data.user;
}

module.exports = { addOrigin, getAllowedOrigins, isOriginAllowed, normalizeOrigin, removeOrigin, signInAdmin };
