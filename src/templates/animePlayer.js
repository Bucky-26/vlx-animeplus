/**
 * Anime Player HTML Template Generator
 * Custom HLS player interface
 * 
 * Features:
 * - Full Video.js integration with HTTP Live Streaming (VHS HLS)
 * - Mobile-friendly responsive design, touch targets, and double-tap to seek (±10s)
 * - VLX-style Resume Playback modal & automatic progress saving (localStorage)
 * - Anime poster shown on loading screen and on initial start
 * - Dynamic ambient blurred backdrop
 * - Intro / Outro skipping buttons
 * - Subtitle tracks and quality options
 * - PostMessage API for iframe integration
 */

function generateAnimePlayerHTML(options) {
    const {
        anilistId,
        season = 1,
        hasSeason = false,
        episode = 1,
        lang = 'sub',
        title,
        titleRomaji,
        poster,
        backdrop,
        episodes = 1,
        genres = [],
        year,
        overview,
        m3u8Url,
        streams = [],
        tracks = [],
        intro = null,
        outro = null
    } = options;

    const safeTitle = (title || 'Anime').replace(/"/g, '&quot;');
    const safeTitleRomaji = (titleRomaji || '').replace(/"/g, '&quot;');
    const safePoster = poster || '';
    const safeBackdrop = backdrop || poster || '';
    const safeOverview = (overview || '').replace(/"/g, '&quot;');

    function getLanguageCode(label = '') {
        const l = label.toLowerCase();
        if (l.includes('eng')) return 'en';
        if (l.includes('spa') || l.includes('esp')) return 'es';
        if (l.includes('por') || l.includes('pt')) return 'pt';
        if (l.includes('fre') || l.includes('fra')) return 'fr';
        if (l.includes('ger') || l.includes('deu')) return 'de';
        if (l.includes('ita')) return 'it';
        if (l.includes('rus')) return 'ru';
        if (l.includes('jap') || l.includes('jpn')) return 'ja';
        if (l.includes('ara')) return 'ar';
        if (l.includes('hin')) return 'hi';
        return l.slice(0, 2) || 'en';
    }

    // Subtitle tracks for Video.js
    const subtitleTracks = (tracks || []).map((t, idx) => {
        const isDefault = t.default || (t.label && t.label.toLowerCase().includes('english')) || idx === 0;
        const srclang = getLanguageCode(t.label || '');
        const kind = t.kind || 'subtitles';
        const label = t.label || 'English';
        return `<track src="${t.file}" label="${label}" kind="${kind}" srclang="${srclang}" ${isDefault ? 'default' : ''}>`;
    }).join('\n        ');

    const epDisplay = hasSeason ? `S${season} E${episode}` : `Episode ${episode}`;
    const epLongDisplay = hasSeason ? `Season ${season} • Episode ${episode}` : `Episode ${episode}`;

    const introJson = JSON.stringify(intro || null);
    const outroJson = JSON.stringify(outro || null);
    const streamsJson = JSON.stringify(streams || []);
    const tracksJson = JSON.stringify(tracks || []);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="referrer" content="no-referrer">
    <title>Watch ${safeTitle} ${hasSeason ? `Season ${season}` : ''} - Episode ${episode}</title>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    
    <!-- Video.js 8 Core Styles & Scripts -->
    <link href="https://vjs.zencdn.net/8.16.1/video-js.css" rel="stylesheet" />
    <script src="https://vjs.zencdn.net/8.16.1/video.min.js"></script>

    <style>
        :root {
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --primary-glow: rgba(99, 102, 241, 0.45);
            --accent: #ec4899;
            --bg-dark: #07090e;
            --card-bg: rgba(15, 23, 42, 0.85);
            --card-border: rgba(255, 255, 255, 0.12);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: var(--bg-dark);
            color: #f8fafc;
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none;
            touch-action: manipulation;
        }

        .player-wrapper {
            position: relative;
            width: 100vw;
            height: 100vh;
            max-width: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        /* Ambient blurred background using poster/banner */
        .ambient-backdrop {
            position: absolute;
            inset: -40px;
            background-size: cover;
            background-position: center;
            filter: blur(55px) brightness(0.22);
            opacity: 0.85;
            pointer-events: none;
            z-index: 1;
            transition: opacity 1.2s ease;
        }

        /* Video.js custom container styles */
        .video-js-container {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            z-index: 2;
        }

        .video-js {
            width: 100% !important;
            height: 100% !important;
            font-family: 'Outfit', sans-serif !important;
            background-color: transparent !important;
        }

        .video-js .vjs-tech {
            object-fit: contain;
        }

        /* Video.js Poster Styling */
        .video-js .vjs-poster {
            background-size: contain !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-color: #000 !important;
            transition: opacity 0.5s ease;
        }

        /* Center Big Play Button (Pixel-perfect Center Alignment) */
        .video-js .vjs-big-play-button {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            width: 80px !important;
            height: 80px !important;
            line-height: 80px !important;
            border-radius: 50% !important;
            background: rgba(15, 23, 42, 0.82) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            border: 2px solid rgba(255, 255, 255, 0.25) !important;
            color: #ffffff !important;
            font-size: 38px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 25px var(--primary-glow) !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer;
        }

        .video-js:hover .vjs-big-play-button,
        .video-js .vjs-big-play-button:focus,
        .video-js .vjs-big-play-button:active {
            background: var(--primary) !important;
            border-color: rgba(255, 255, 255, 0.6) !important;
            transform: translate(-50%, -50%) scale(1.12) !important;
            box-shadow: 0 15px 40px rgba(99, 102, 241, 0.6), 0 0 35px var(--primary) !important;
        }

        /* Control Bar Styling & Flex Alignment */
        .video-js .vjs-control-bar {
            height: 58px !important;
            background: linear-gradient(0deg, rgba(7, 9, 14, 0.96) 0%, rgba(7, 9, 14, 0.72) 65%, transparent 100%) !important;
            padding: 0 18px !important;
            padding-bottom: max(6px, env(safe-area-inset-bottom)) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            z-index: 10 !important;
            transition: opacity 0.3s ease, transform 0.3s ease !important;
        }

        .video-js.vjs-user-inactive.vjs-playing .vjs-control-bar {
            opacity: 0 !important;
            transform: translateY(10px);
            pointer-events: none;
        }

        /* Full-Width Top-Edge Progress Bar (VLX Style) */
        .video-js .vjs-progress-control.vjs-control {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 16px !important;
            transform: translateY(-50%) !important;
            margin: 0 !important;
            padding: 0 16px !important;
            display: flex !important;
            align-items: center !important;
            cursor: pointer !important;
            z-index: 25 !important;
            touch-action: none !important;
        }

        .video-js .vjs-progress-control .vjs-progress-holder {
            width: 100% !important;
            height: 5px !important;
            margin: 0 !important;
            background: rgba(255, 255, 255, 0.25) !important;
            border-radius: 4px !important;
            transition: height 0.18s ease !important;
            position: relative !important;
            flex: 1 1 auto !important;
            display: block !important;
        }

        .video-js .vjs-progress-control:hover .vjs-progress-holder,
        .video-js .vjs-progress-control:active .vjs-progress-holder {
            height: 8px !important;
        }

        .video-js .vjs-play-progress {
            height: 100% !important;
            background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%) !important;
            border-radius: 4px !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
        }

        .video-js .vjs-play-progress::before {
            content: "" !important;
            width: 14px !important;
            height: 14px !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            position: absolute !important;
            top: 50% !important;
            right: -7px !important;
            transform: translateY(-50%) !important;
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.9), 0 2px 6px rgba(0, 0, 0, 0.5) !important;
            opacity: 1 !important;
            z-index: 30 !important;
        }

        .video-js .vjs-load-progress {
            height: 100% !important;
            background: rgba(255, 255, 255, 0.35) !important;
            border-radius: 4px !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
        }

        .video-js .vjs-load-progress div {
            background: rgba(255, 255, 255, 0.2) !important;
            height: 100% !important;
        }

        /* Time Tooltip on Progress Bar Hover */
        .video-js .vjs-play-progress .vjs-time-tooltip {
            display: none !important;
        }

        .video-js .vjs-mouse-display {
            background-color: rgba(255, 255, 255, 0.4) !important;
            width: 2px !important;
            z-index: 35 !important;
        }

        .video-js .vjs-mouse-display .vjs-time-tooltip,
        .video-js .vjs-progress-control:hover .vjs-time-tooltip {
            display: block !important;
            visibility: visible !important;
            background: rgba(15, 23, 42, 0.96) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            border-radius: 6px !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            color: #ffffff !important;
            padding: 4px 8px !important;
            top: -30px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6) !important;
            pointer-events: none !important;
            white-space: nowrap !important;
        }

        /* Spacer pushes Left Controls (Play, Volume, Time) and Right Controls (Subs, Speed, PiP, Fullscreen) apart */
        .video-js .vjs-custom-control-spacer {
            display: flex !important;
            flex: 1 1 auto !important;
        }

        /* Unified Buttons Alignment (Targets only buttons, preserving progress & volume containers) */
        .video-js .vjs-button {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 44px !important;
            height: 44px !important;
            margin: 0 1px !important;
            color: #ffffff !important;
            cursor: pointer !important;
            background: none !important;
            border: none !important;
            transition: color 0.15s ease, transform 0.15s ease !important;
        }

        .video-js .vjs-button:hover {
            color: var(--primary) !important;
            transform: scale(1.08);
        }

        .video-js .vjs-button .vjs-icon-placeholder:before {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            font-size: 21px !important;
            line-height: 44px !important;
        }

        /* Inline Volume Panel Alignment */
        .video-js .vjs-volume-panel {
            display: flex !important;
            align-items: center !important;
            margin-right: 4px !important;
            transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .video-js .vjs-volume-panel.vjs-volume-panel-horizontal.vjs-slider-active,
        .video-js .vjs-volume-panel.vjs-volume-panel-horizontal:hover,
        .video-js .vjs-volume-panel.vjs-volume-panel-horizontal:focus {
            width: 10em !important;
        }

        .video-js .vjs-volume-control.vjs-volume-horizontal {
            display: flex !important;
            align-items: center !important;
            height: 44px !important;
        }

        .video-js .vjs-volume-bar.vjs-slider-horizontal {
            height: 4px !important;
            background: rgba(255, 255, 255, 0.25) !important;
            border-radius: 4px !important;
            margin: 0 4px !important;
        }

        .video-js .vjs-volume-level {
            background: #ffffff !important;
            border-radius: 4px !important;
        }

        /* Time Display Alignment (Current Time / Duration) */
        .video-js .vjs-current-time,
        .video-js .vjs-time-divider,
        .video-js .vjs-duration {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 2px !important;
            height: 44px !important;
            line-height: 44px !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            color: #cbd5e1 !important;
            font-variant-numeric: tabular-nums !important;
        }

        .video-js .vjs-time-divider {
            min-width: unset !important;
            padding: 0 3px !important;
            color: rgba(255, 255, 255, 0.4) !important;
        }

        .video-js .vjs-current-time-display,
        .video-js .vjs-duration-display {
            line-height: 44px !important;
        }

        /* Playback Rate & Subtitles Buttons */
        .video-js .vjs-playback-rate {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }

        .video-js .vjs-playback-rate .vjs-playback-rate-value {
            font-size: 13px !important;
            font-weight: 700 !important;
            line-height: 44px !important;
            color: #e2e8f0 !important;
        }

        /* Popup Menus & Tooltips (Subtitles & Playback Speed) */
        .video-js .vjs-menu-button-popup .vjs-menu {
            display: none;
            position: absolute !important;
            bottom: 56px !important;
            right: -6px !important;
            left: auto !important;
            min-width: 140px !important;
            width: max-content !important;
            max-width: 220px !important;
            height: auto !important;
            margin: 0 !important;
            z-index: 99 !important;
        }

        .video-js .vjs-menu-button-popup.vjs-hover .vjs-menu,
        .video-js .vjs-menu-button-popup .vjs-menu.vjs-lock-showing {
            display: block !important;
        }

        .video-js .vjs-menu-button-popup .vjs-menu .vjs-menu-content {
            position: static !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
            width: 100% !important;
            max-height: 240px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            background: rgba(15, 23, 42, 0.96) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255, 255, 255, 0.16) !important;
            border-radius: 12px !important;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.85), 0 0 25px rgba(99, 102, 241, 0.25) !important;
            padding: 6px !important;
            margin: 0 !important;
        }

        /* Sleek Modern Scrollbar for Menu */
        .video-js .vjs-menu-content::-webkit-scrollbar {
            width: 5px !important;
        }

        .video-js .vjs-menu-content::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.6) !important;
            border-radius: 4px !important;
        }

        .video-js .vjs-menu-content::-webkit-scrollbar-thumb {
            background: rgba(99, 102, 241, 0.5) !important;
            border-radius: 4px !important;
        }

        .video-js .vjs-menu-content::-webkit-scrollbar-thumb:hover {
            background: var(--primary) !important;
        }

        /* Menu Items */
        .video-js .vjs-menu li.vjs-menu-item {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 9px 14px !important;
            margin: 0 !important;
            border-radius: 8px !important;
            font-family: 'Outfit', -apple-system, sans-serif !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            color: #cbd5e1 !important;
            text-transform: capitalize !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
            line-height: 1.3 !important;
            text-align: left !important;
        }

        .video-js .vjs-menu li.vjs-menu-item:hover,
        .video-js .vjs-menu li.vjs-menu-item:focus {
            background: rgba(255, 255, 255, 0.12) !important;
            color: #ffffff !important;
        }

        .video-js .vjs-menu li.vjs-menu-item.vjs-selected {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45) !important;
        }

        /* Hide the redundant ugly CC icon inside menu items */
        .video-js .vjs-menu-item .vjs-icon-placeholder,
        .video-js .vjs-menu-item .vjs-icon-placeholder:before,
        .video-js .vjs-menu-item .vjs-menu-item-text .vjs-icon-placeholder,
        .video-js .vjs-menu-item .vjs-menu-item-text .vjs-icon-placeholder:before {
            display: none !important;
        }

        /* Hide captions settings */
        .video-js .vjs-caption-settings-menu-item,
        .video-js .vjs-texttrack-settings {
            display: none !important;
        }

        /* Custom Subtitles & Captions Display */
        .video-js .vjs-text-track-display {
            position: absolute !important;
            bottom: 5.5rem !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            pointer-events: none !important;
            z-index: 15 !important;
            transition: bottom 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .video-js.vjs-user-inactive.vjs-playing .vjs-text-track-display {
            bottom: 2.2rem !important;
        }

        .video-js .vjs-text-track-cue {
            font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            line-height: 1.35 !important;
        }

        .video-js .vjs-text-track-cue > div {
            background-color: rgba(10, 14, 26, 0.82) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            color: #ffffff !important;
            font-weight: 600 !important;
            font-size: clamp(15px, 2.2vw, 24px) !important;
            padding: 6px 14px !important;
            border-radius: 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.14) !important;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.8) !important;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45) !important;
            white-space: pre-wrap !important;
        }

        /* Subtitle Timing Sync Toast */
        .sync-toast {
            position: absolute;
            top: 75px;
            left: 50%;
            transform: translateX(-50%) translateY(-10px);
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(99, 102, 241, 0.45);
            color: #ffffff;
            padding: 8px 20px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.35);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease;
            z-index: 100;
        }

        .sync-toast.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .sync-toast svg {
            color: #818cf8;
        }

        /* Subtitle Menu Sync Bar */
        .vjs-sub-sync-control {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            padding: 9px 12px;
            margin-top: 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            user-select: none;
        }

        .vjs-sub-sync-control .sync-btn-group {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .vjs-sub-sync-control .sync-adj-btn,
        .vjs-sub-sync-control .sync-reset-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.18);
            color: #ffffff;
            border-radius: 6px;
            padding: 3px 7px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .vjs-sub-sync-control .sync-adj-btn:hover,
        .vjs-sub-sync-control .sync-reset-btn:hover {
            background: var(--primary);
            border-color: var(--primary);
        }

        .vjs-sub-sync-control .sync-val-display {
            font-variant-numeric: tabular-nums;
            color: #e2e8f0;
            font-weight: 700;
            min-width: 38px;
            text-align: center;
        }

        /* Ensure screen reader text does not show in tooltip */
        .video-js .vjs-control-text {
            border: 0 !important;
            clip: rect(0 0 0 0) !important;
            height: 1px !important;
            margin: -1px !important;
            overflow: hidden !important;
            padding: 0 !important;
            position: absolute !important;
            width: 1px !important;
        }

        /* Top Media Info Header Bar */
        .top-info-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 72px;
            padding: 16px 20px;
            padding-top: max(16px, env(safe-area-inset-top));
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(180deg, rgba(7, 9, 14, 0.9) 0%, rgba(7, 9, 14, 0.5) 60%, transparent 100%);
            z-index: 12;
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .top-info-bar.hidden {
            opacity: 0;
            transform: translateY(-12px);
        }

        .top-info-left {
            display: flex;
            align-items: center;
            gap: 14px;
            pointer-events: auto;
            min-width: 0;
        }

        .top-thumb {
            width: 38px;
            height: 52px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
            flex-shrink: 0;
        }

        .top-titles {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .top-title-main {
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 50vw;
        }

        .top-meta-sub {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .badge-pill {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-ep {
            background: rgba(99, 102, 241, 0.25);
            border: 1px solid rgba(99, 102, 241, 0.5);
            color: #c7d2fe;
        }

        .badge-lang {
            background: rgba(236, 72, 153, 0.25);
            border: 1px solid rgba(236, 72, 153, 0.5);
            color: #fbcfe8;
        }

        /* POSTER LOADING SCREEN (Displayed on load while stream is being fetched/parsed) */
        .loading-screen {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(7, 9, 14, 0.88);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            transition: opacity 0.5s ease;
            pointer-events: auto;
        }

        .loading-screen.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .loading-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 28px 24px;
            border-radius: 20px;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px var(--primary-glow);
            max-width: 380px;
            width: 88%;
            text-align: center;
            animation: cardFloat 3s ease-in-out infinite;
        }

        @keyframes cardFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
        }

        .loading-poster-img {
            width: 130px;
            height: 185px;
            object-fit: cover;
            border-radius: 12px;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.35);
            border: 2px solid rgba(255, 255, 255, 0.25);
            margin-bottom: 18px;
        }

        .loading-title {
            font-size: 19px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }

        .loading-badges {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .spinner-ring {
            width: 36px;
            height: 36px;
            border: 3px solid rgba(255, 255, 255, 0.15);
            border-top-color: var(--primary);
            border-right-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.85s linear infinite;
            margin-bottom: 12px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-status-text {
            font-size: 13px;
            color: #94a3b8;
            font-weight: 500;
        }

        /* VLX-STYLE RESUME MODAL */
        .resume-modal {
            position: absolute;
            inset: 0;
            z-index: 25;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.35s ease;
        }

        .resume-modal.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .resume-box {
            background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
            border: 1px solid rgba(99, 102, 241, 0.4);
            border-radius: 20px;
            padding: 30px 24px;
            text-align: center;
            max-width: 380px;
            width: 88%;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px var(--primary-glow);
            transform: scale(0.92);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .resume-modal.visible .resume-box {
            transform: scale(1);
        }

        .resume-icon {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.2);
            border: 1px solid rgba(99, 102, 241, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px auto;
            color: var(--primary);
        }

        .resume-icon svg {
            width: 26px;
            height: 26px;
            fill: currentColor;
            margin-left: 2px;
        }

        .resume-title {
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .resume-subtitle {
            color: #94a3b8;
            font-size: 13px;
            margin-bottom: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .resume-time {
            color: #c7d2fe;
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 22px;
            background: rgba(99, 102, 241, 0.15);
            padding: 6px 14px;
            border-radius: 12px;
            display: inline-block;
            border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .resume-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .resume-btn {
            flex: 1;
            padding: 12px 18px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .resume-btn.primary {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #ffffff;
            box-shadow: 0 4px 15px var(--primary-glow);
        }

        .resume-btn.primary:hover, .resume-btn.primary:active {
            transform: scale(1.04);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
        }

        .resume-btn.secondary {
            background: rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .resume-btn.secondary:hover, .resume-btn.secondary:active {
            background: rgba(255, 255, 255, 0.16);
            color: #ffffff;
        }

        /* SKIP INTRO / SKIP OUTRO BUTTON */
        .skip-btn {
            position: absolute;
            bottom: 74px;
            right: 20px;
            z-index: 15;
            padding: 10px 18px;
            border-radius: 24px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            background: rgba(99, 102, 241, 0.88);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.35);
            color: #ffffff;
            display: none;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px var(--primary-glow);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .skip-btn:hover, .skip-btn:active {
            background: var(--primary);
            transform: scale(1.06);
            box-shadow: 0 10px 30px rgba(99, 102, 241, 0.7);
        }

        .skip-btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        /* MOBILE DOUBLE-TAP TO SEEK OVERLAYS */
        .seek-ripple {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 40%;
            z-index: 14;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .seek-ripple.left { left: 0; }
        .seek-ripple.right { right: 0; }

        .seek-ripple-content {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 14px 20px;
            border-radius: 50px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
            transform: scale(0.85);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .seek-ripple.animate {
            opacity: 1;
        }

        .seek-ripple.animate .seek-ripple-content {
            transform: scale(1);
        }

        /* ERROR OVERLAY */
        .error-banner {
            position: absolute;
            inset: 0;
            z-index: 22;
            background: rgba(7, 9, 14, 0.95);
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            text-align: center;
        }

        .error-banner.show { display: flex; }
        .error-banner h2 { font-size: 22px; color: #f87171; margin-bottom: 8px; }
        .error-banner p { font-size: 14px; color: #94a3b8; max-width: 440px; margin-bottom: 20px; }

        .error-retry-btn {
            background: var(--primary);
            color: #fff;
            padding: 10px 22px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
        }

        /* MOBILE RESPONSIVE TWEAKS */
        @media (max-width: 640px) {
            .top-info-bar {
                height: 60px;
                padding: 10px 14px;
            }

            .top-thumb {
                width: 30px;
                height: 42px;
            }

            .top-title-main {
                font-size: 14px;
                max-width: 60vw;
            }

            .top-meta-sub {
                font-size: 11px;
            }

            .video-js .vjs-big-play-button {
                width: 64px !important;
                height: 64px !important;
                line-height: 64px !important;
                font-size: 28px !important;
                transform: translate(-50%, -50%) !important;
                margin: 0 !important;
            }

            .video-js .vjs-control-bar {
                height: 50px !important;
                padding: 0 10px !important;
                padding-bottom: max(4px, env(safe-area-inset-bottom)) !important;
            }

            .video-js .vjs-progress-control.vjs-control {
                padding: 0 10px !important;
            }

            .video-js .vjs-button {
                width: 36px !important;
                height: 36px !important;
            }

            .video-js .vjs-button .vjs-icon-placeholder:before {
                font-size: 18px !important;
                line-height: 36px !important;
            }

            .video-js .vjs-current-time,
            .video-js .vjs-time-divider,
            .video-js .vjs-duration {
                font-size: 11px !important;
                height: 36px !important;
                line-height: 36px !important;
                padding: 0 1px !important;
            }

            .skip-btn {
                bottom: 64px;
                right: 12px;
                padding: 8px 14px;
                font-size: 12px;
            }

            .loading-card, .resume-box {
                padding: 22px 18px;
            }

            .loading-poster-img {
                width: 105px;
                height: 150px;
                margin-bottom: 14px;
            }

            .loading-title, .resume-title {
                font-size: 17px;
            }
        }
    </style>
</head>
<body>
    <div class="player-wrapper" id="playerWrapper">

        <!-- Dynamic Ambient Blurred Backdrop -->
        <div class="ambient-backdrop" id="ambientBackdrop" style="background-image: url('${safeBackdrop}');"></div>

        <!-- Video.js Player Container -->
        <div class="video-js-container" id="videoContainer">
            <video-js 
                id="animeVideo" 
                class="video-js vjs-big-play-centered vjs-fill" 
                controls 
                preload="auto" 
                poster="${safePoster}" 
                playsinline="true" 
                webkit-playsinline="true"
                crossorigin="anonymous">
                ${m3u8Url ? `<source src="${m3u8Url}" type="application/x-mpegurl">` : ''}
                ${subtitleTracks}
            </video-js>
        </div>

        <!-- Top Media Header Bar -->
        <div class="top-info-bar" id="topInfoBar">
            <div class="top-info-left">
                ${safePoster ? `<img src="${safePoster}" alt="${safeTitle}" class="top-thumb" />` : ''}
                <div class="top-titles">
                    <span class="top-title-main">${safeTitle}</span>
                    <span class="top-meta-sub">
                        <span>${epLongDisplay}${episodes > 1 ? ` of ${episodes}` : ''}</span>
                        <span class="badge-pill badge-lang">${lang.toUpperCase()}</span>
                        ${genres.length ? `<span>• ${genres.slice(0, 2).join(', ')}</span>` : ''}
                    </span>
                </div>
            </div>
        </div>

        <!-- Poster Loading Screen (Shown on load while stream is being fetched/parsed) -->
        <div class="loading-screen" id="loadingScreen">
            <div class="loading-card">
                ${safePoster ? `<img src="${safePoster}" alt="${safeTitle}" class="loading-poster-img" />` : ''}
                <div class="loading-title">${safeTitle}</div>
                <div class="loading-badges">
                    <span class="badge-pill badge-ep">${epDisplay}</span>
                    <span class="badge-pill badge-lang">${lang.toUpperCase()}</span>
                    ${year ? `<span class="badge-pill badge-ep">${year}</span>` : ''}
                </div>
                <div class="spinner-ring"></div>
                <div class="loading-status-text" id="loadingStatus">Initializing stream...</div>
            </div>
        </div>

        <!-- VLX-Style Resume Playback Modal -->
        <div class="resume-modal" id="resumeModal">
            <div class="resume-box">
                <div class="resume-icon">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div class="resume-title">Resume Playback?</div>
                <div class="resume-subtitle">${safeTitle} • ${epDisplay}</div>
                <div class="resume-time" id="resumeTimeText">Continue from 0:00</div>
                <div class="resume-buttons">
                    <button class="resume-btn secondary" id="startOverBtn">Start Over</button>
                    <button class="resume-btn primary" id="resumeBtn">Resume</button>
                </div>
            </div>
        </div>

        <!-- Skip Intro Button -->
        <button class="skip-btn" id="skipIntroBtn">
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            <span>Skip Intro</span>
        </button>

        <!-- Skip Outro Button -->
        <button class="skip-btn" id="skipOutroBtn">
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            <span>Skip Outro</span>
        </button>

        <!-- Double-Tap To Seek Feedback (Mobile) -->
        <div class="seek-ripple left" id="seekRippleLeft">
            <div class="seek-ripple-content">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                <span>-10s</span>
            </div>
        </div>
        <div class="seek-ripple right" id="seekRippleRight">
            <div class="seek-ripple-content">
                <span>+10s</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            </div>
        </div>

        <!-- Error Banner -->
        <div class="error-banner" id="errorBanner">
            <h2>Playback Error</h2>
            <p id="errorMessage">Unable to load stream for this episode. Please try another episode or refresh.</p>
            <button class="error-retry-btn" onclick="window.location.reload()">Retry</button>
        </div>

        <!-- Subtitle Timing Sync Toast -->
        <div class="sync-toast" id="syncToast">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span id="syncToastText">Subtitle Sync: 0.00s</span>
        </div>

    </div>

    <script>
        // Global parameters
        const ANILIST_ID = ${anilistId};
        const SEASON = ${season};
        const HAS_SEASON = ${hasSeason ? 'true' : 'false'};
        const EPISODE = ${episode};
        const M3U8_URL = "${m3u8Url}";
        const INTRO = ${introJson};
        const OUTRO = ${outroJson};
        const STREAMS = ${streamsJson};
        const TRACKS = ${tracksJson};

        // Storage Key for Resume Playback
        const PROGRESS_KEY = 'progress_' + ANILIST_ID + (HAS_SEASON ? '_s' + SEASON : '') + '_ep' + EPISODE;
        const mediaId = String(ANILIST_ID) + (HAS_SEASON ? '_s' + SEASON : '') + '_ep' + EPISODE;

        // DOM Elements
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingStatus = document.getElementById('loadingStatus');
        const topInfoBar = document.getElementById('topInfoBar');
        const resumeModal = document.getElementById('resumeModal');
        const resumeTimeText = document.getElementById('resumeTimeText');
        const resumeBtn = document.getElementById('resumeBtn');
        const startOverBtn = document.getElementById('startOverBtn');
        const skipIntroBtn = document.getElementById('skipIntroBtn');
        const skipOutroBtn = document.getElementById('skipOutroBtn');
        const seekRippleLeft = document.getElementById('seekRippleLeft');
        const seekRippleRight = document.getElementById('seekRippleRight');
        const errorBanner = document.getElementById('errorBanner');
        const errorMessage = document.getElementById('errorMessage');

        let player = null;
        let savedResumeTime = 0;
        let progressSaveTimer = null;
        let hasCheckedResume = false;

        // ============================================
        // 1. FORMAT TIME HELPER (M:SS or H:MM:SS)
        // ============================================
        function formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) {
                return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            }
            return m + ':' + String(s).padStart(2, '0');
        }

        // ============================================
        // 2. VLX PROGRESS STORAGE FUNCTIONS
        // ============================================
        function getSavedProgress() {
            try {
                const raw = localStorage.getItem(PROGRESS_KEY) || localStorage.getItem('vidpro_progress_anime_' + ANILIST_ID + (HAS_SEASON ? '_s' + SEASON : '') + '_ep' + EPISODE);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    // 30 days valid
                    if (Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
                        return parsed;
                    }
                }
            } catch (e) {}
            return null;
        }

        function saveProgress() {
            if (!player || player.paused()) return;
            const cur = player.currentTime();
            const dur = player.duration();

            // Save only if played more than 10s and not within final 30s
            if (cur > 10 && dur && (dur - cur > 30)) {
                try {
                    const payload = {
                        time: Math.floor(cur),
                        duration: Math.floor(dur),
                        timestamp: Date.now(),
                        title: "${safeTitle}",
                        episode: EPISODE,
                        season: SEASON
                    };
                    localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
                } catch (e) {}
            }
        }

        function clearProgress() {
            try {
                localStorage.removeItem(PROGRESS_KEY);
            } catch (e) {}
        }

        // ============================================
        // 3. RESUME PLAYBACK PROMPT
        // ============================================
        function checkAndShowResume() {
            if (hasCheckedResume) return;
            hasCheckedResume = true;

            // Check query param startAt / resumeAt / resume / start / t first
            const params = new URLSearchParams(window.location.search);
            const startAt = parseFloat(params.get('startAt') || params.get('resumeAt') || params.get('resume') || params.get('start') || params.get('t'));
            if (Number.isFinite(startAt) && startAt > 0) {
                player.currentTime(startAt);
                if (params.get('autoplay') === '1' || params.get('autoplay') === 'true') {
                    player.play().catch(() => {});
                }
                return;
            }

            const saved = getSavedProgress();
            if (saved && saved.time > 15) {
                savedResumeTime = saved.time;
                resumeTimeText.textContent = 'Continue from ' + formatTime(savedResumeTime);
                resumeModal.classList.add('visible');
            }
        }

        function hideResumeModal() {
            resumeModal.classList.remove('visible');
        }

        resumeBtn.addEventListener('click', () => {
            hideResumeModal();
            if (player) {
                player.currentTime(savedResumeTime);
                player.play().catch(() => {});
            }
        });

        startOverBtn.addEventListener('click', () => {
            hideResumeModal();
            clearProgress();
            if (player) {
                player.currentTime(0);
                player.play().catch(() => {});
            }
        });

        // ============================================
        // 4. VIDEO.JS INITIALIZATION
        // ============================================
        function initVideoJS() {
            if (!M3U8_URL) {
                loadingScreen.classList.add('hidden');
                errorMessage.textContent = 'No playable stream found for this episode.';
                errorBanner.classList.add('show');
                return;
            }

            loadingStatus.textContent = 'Buffering stream segments...';

            player = videojs('animeVideo', {
                fluid: false,
                fill: true,
                responsive: true,
                autoplay: false,
                controls: true,
                preload: 'auto',
                playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
                controlBar: {
                    children: [
                        'playToggle',
                        'volumePanel',
                        'currentTimeDisplay',
                        'timeDivider',
                        'durationDisplay',
                        'customControlSpacer',
                        'subsCapsButton',
                        'playbackRateMenuButton',
                        'pictureInPictureToggle',
                        'fullscreenToggle',
                        'progressControl'
                    ],
                    volumePanel: {
                        inline: true
                    }
                },
                html5: {
                    vhs: {
                        overrideNative: !videojs.browser.IS_ANY_SAFARI,
                        enableLowInitialPlaylist: true
                    },
                    nativeAudioTracks: false,
                    nativeVideoTracks: false
                }
            });

            // Subtitle & Caption Timing Management
            let userChoseTrack = false;
            let currentSubtitleOffset = 0;
            const SUB_SYNC_KEY = 'anime_sub_sync_' + ANILIST_ID;
            try {
                const savedOffset = parseFloat(localStorage.getItem(SUB_SYNC_KEY));
                if (Number.isFinite(savedOffset)) {
                    currentSubtitleOffset = savedOffset;
                }
            } catch(e) {}

            let syncToastTimer = null;
            function showSyncToast(text) {
                const toast = document.getElementById('syncToast');
                const toastText = document.getElementById('syncToastText');
                if (!toast || !toastText) return;
                toastText.textContent = text;
                toast.classList.add('visible');
                clearTimeout(syncToastTimer);
                syncToastTimer = setTimeout(() => {
                    toast.classList.remove('visible');
                }, 1800);
            }

            function updateSyncUI() {
                const valEl = document.getElementById('subSyncVal');
                if (valEl) {
                    valEl.textContent = (currentSubtitleOffset >= 0 ? '+' : '') + currentSubtitleOffset.toFixed(2) + 's';
                }
            }

            function applySyncToTrack(tr) {
                if (!tr || !tr.cues || tr.cues.length === 0 || currentSubtitleOffset === 0) return;
                if (tr._syncApplied === currentSubtitleOffset) return;
                const delta = currentSubtitleOffset - (tr._syncApplied || 0);
                tr._syncApplied = currentSubtitleOffset;
                for (let j = 0; j < tr.cues.length; j++) {
                    tr.cues[j].startTime += delta;
                    tr.cues[j].endTime += delta;
                }
            }

            function setSubtitleOffset(newOffset) {
                const delta = newOffset - currentSubtitleOffset;
                currentSubtitleOffset = Math.round(newOffset * 100) / 100;

                try {
                    localStorage.setItem(SUB_SYNC_KEY, currentSubtitleOffset.toString());
                } catch(e) {}

                if (player) {
                    const tracks = player.textTracks();
                    if (tracks) {
                        for (let i = 0; i < tracks.length; i++) {
                            const tr = tracks[i];
                            tr._syncApplied = currentSubtitleOffset;
                            if (tr.cues) {
                                for (let j = 0; j < tr.cues.length; j++) {
                                    tr.cues[j].startTime += delta;
                                    tr.cues[j].endTime += delta;
                                }
                            }
                        }
                    }
                }

                updateSyncUI();
                showSyncToast('Subtitle Sync: ' + (currentSubtitleOffset >= 0 ? '+' : '') + currentSubtitleOffset.toFixed(2) + 's');
            }

            function adjustSubtitleOffset(deltaSeconds) {
                setSubtitleOffset(currentSubtitleOffset + deltaSeconds);
            }

            function injectSubSyncMenuControls() {
                const subsBtn = player.controlBar && player.controlBar.subsCapsButton;
                if (!subsBtn || !subsBtn.menu || !subsBtn.menu.contentEl_) return;
                const menuContent = subsBtn.menu.contentEl_;
                if (menuContent.querySelector('.vjs-sub-sync-control')) return;

                const syncDiv = document.createElement('div');
                syncDiv.className = 'vjs-sub-sync-control';
                syncDiv.innerHTML = '<span>Sync:</span>' +
                    '<div class="sync-btn-group">' +
                        '<button type="button" class="sync-adj-btn" id="subSyncMinus" title="Show earlier (-0.25s)">-0.25s</button>' +
                        '<span class="sync-val-display" id="subSyncVal">' + (currentSubtitleOffset >= 0 ? '+' : '') + currentSubtitleOffset.toFixed(2) + 's</span>' +
                        '<button type="button" class="sync-adj-btn" id="subSyncPlus" title="Show later (+0.25s)">+0.25s</button>' +
                        '<button type="button" class="sync-reset-btn" id="subSyncReset" title="Reset to 0s">0s</button>' +
                    '</div>';

                syncDiv.querySelector('#subSyncMinus').addEventListener('click', (e) => {
                    e.stopPropagation();
                    adjustSubtitleOffset(-0.25);
                });
                syncDiv.querySelector('#subSyncPlus').addEventListener('click', (e) => {
                    e.stopPropagation();
                    adjustSubtitleOffset(+0.25);
                });
                syncDiv.querySelector('#subSyncReset').addEventListener('click', (e) => {
                    e.stopPropagation();
                    setSubtitleOffset(0);
                });

                menuContent.appendChild(syncDiv);
            }

            function initCaptions() {
                try {
                    const textTracks = player.textTracks();
                    if (!textTracks) return;

                    // If tracks were not picked up automatically from DOM <track> tags, add them
                    if (textTracks.length === 0 && Array.isArray(TRACKS) && TRACKS.length > 0) {
                        TRACKS.forEach((t, idx) => {
                            const isDefault = t.default || (t.label && t.label.toLowerCase().includes('english')) || idx === 0;
                            player.addRemoteTextTrack({
                                kind: t.kind || 'subtitles',
                                label: t.label || 'English',
                                srclang: (t.label && t.label.toLowerCase().includes('eng')) ? 'en' : 'auto',
                                src: t.file,
                                default: isDefault
                            }, false);
                        });
                    }

                    function applyDefaultTrack() {
                        if (userChoseTrack) return;
                        const tracks = player.textTracks();
                        if (!tracks || tracks.length === 0) return;

                        // Check if any track is already showing
                        for (let i = 0; i < tracks.length; i++) {
                            if (tracks[i].mode === 'showing') return;
                        }

                        // Try to find default or English track
                        let target = null;
                        for (let i = 0; i < tracks.length; i++) {
                            const tr = tracks[i];
                            if (tr.kind === 'subtitles' || tr.kind === 'captions') {
                                if (tr.default || (tr.label && tr.label.toLowerCase().includes('english'))) {
                                    target = tr;
                                    break;
                                }
                            }
                        }
                        if (!target) {
                            for (let i = 0; i < tracks.length; i++) {
                                if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
                                    target = tracks[i];
                                    break;
                                }
                            }
                        }
                        if (target) {
                            target.mode = 'showing';
                        }
                    }

                    // Apply sync to any cues
                    for (let i = 0; i < textTracks.length; i++) {
                        const tr = textTracks[i];
                        applySyncToTrack(tr);
                        tr.oncuechange = () => applySyncToTrack(tr);
                    }

                    textTracks.on('change', () => {
                        userChoseTrack = true;
                        for (let i = 0; i < textTracks.length; i++) {
                            applySyncToTrack(textTracks[i]);
                        }
                    });

                    textTracks.on('addtrack', (e) => {
                        applyDefaultTrack();
                        if (e && e.track) {
                            applySyncToTrack(e.track);
                        }
                    });

                    applyDefaultTrack();
                    injectSubSyncMenuControls();
                } catch (e) {
                    console.warn('[Video.js] Captions init warning:', e);
                }
            }

            player.ready(() => {
                initCaptions();
            });

            // Stream loaded and metadata ready
            player.on('loadedmetadata', () => {
                loadingScreen.classList.add('hidden');
                checkAndShowResume();
                initCaptions();
            });

            player.on('canplay', () => {
                loadingScreen.classList.add('hidden');
            });

            player.on('play', () => {
                hideResumeModal();
                loadingScreen.classList.add('hidden');
                // Periodic save every 10 seconds during playback
                clearInterval(progressSaveTimer);
                progressSaveTimer = setInterval(saveProgress, 10000);
                initCaptions();
                emitPostMessage('play');
            });

            player.on('pause', () => {
                clearInterval(progressSaveTimer);
                saveProgress();
                emitPostMessage('pause');
            });

            player.on('ended', () => {
                clearInterval(progressSaveTimer);
                clearProgress();
                emitPostMessage('ended');
            });

            player.on('timeupdate', () => {
                const cur = player.currentTime();
                handleIntroOutro(cur);
                emitPostMessage('timeupdate');
            });

            player.on('seeked', () => {
                emitPostMessage('seeked');
            });

            player.on('volumechange', () => {
                emitPostMessage('volumechange');
            });

            player.on('useractive', () => {
                topInfoBar.classList.remove('hidden');
            });

            player.on('userinactive', () => {
                if (player && !player.paused()) {
                    topInfoBar.classList.add('hidden');
                }
            });

            player.on('error', () => {
                loadingScreen.classList.add('hidden');
                const err = player.error();
                console.error('[Video.js] Playback error:', err);
                errorMessage.textContent = err ? (err.message || 'Stream playback encountered a problem.') : 'Playback failed.';
                errorBanner.classList.add('show');
            });

            window.addEventListener('beforeunload', saveProgress);

            // Setup mobile touch gestures
            setupMobileGestures();
        }

        // ============================================
        // 5. INTRO / OUTRO SKIP CONTROLS
        // ============================================
        function handleIntroOutro(cur) {
            // Intro
            if (INTRO && INTRO.start && INTRO.end && cur >= INTRO.start && cur < INTRO.end) {
                skipIntroBtn.style.display = 'flex';
            } else {
                skipIntroBtn.style.display = 'none';
            }

            // Outro
            if (OUTRO && OUTRO.start && OUTRO.end && cur >= OUTRO.start && cur < OUTRO.end) {
                skipOutroBtn.style.display = 'flex';
            } else {
                skipOutroBtn.style.display = 'none';
            }
        }

        skipIntroBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (player && INTRO && INTRO.end) {
                player.currentTime(INTRO.end + 0.5);
                skipIntroBtn.style.display = 'none';
            }
        });

        skipOutroBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (player && OUTRO && OUTRO.end) {
                player.currentTime(OUTRO.end + 0.5);
                skipOutroBtn.style.display = 'none';
            }
        });

        // ============================================
        // 6. MOBILE DOUBLE-TAP TO SEEK (±10s)
        // ============================================
        function setupMobileGestures() {
            const container = document.getElementById('videoContainer');
            let lastTapTime = 0;
            let lastTapX = 0;

            container.addEventListener('touchend', (e) => {
                const now = Date.now();
                const touch = e.changedTouches[0];
                if (!touch) return;

                const delta = now - lastTapTime;
                const touchX = touch.clientX;
                const width = window.innerWidth;

                // Double tap detected (< 300ms and within 80px)
                if (delta > 40 && delta < 300 && Math.abs(touchX - lastTapX) < 80) {
                    if (touchX < width * 0.4) {
                        // Double tap left: Seek -10s
                        e.preventDefault();
                        if (player) {
                            player.currentTime(Math.max(0, player.currentTime() - 10));
                            triggerSeekRipple(seekRippleLeft);
                        }
                    } else if (touchX > width * 0.6) {
                        // Double tap right: Seek +10s
                        e.preventDefault();
                        if (player) {
                            player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 10));
                            triggerSeekRipple(seekRippleRight);
                        }
                    }
                }

                lastTapTime = now;
                lastTapX = touchX;
            });
        }

        function triggerSeekRipple(el) {
            el.classList.add('animate');
            setTimeout(() => {
                el.classList.remove('animate');
            }, 550);
        }

        // ============================================
        // 7. KEYBOARD SHORTCUTS
        // ============================================
        window.addEventListener('keydown', (e) => {
            if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) return;
            if (!player) return;

            switch(e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    player.paused() ? player.play() : player.pause();
                    break;
                case 'f':
                    e.preventDefault();
                    player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    player.muted(!player.muted());
                    break;
                case 'arrowleft':
                case 'j':
                    e.preventDefault();
                    player.currentTime(Math.max(0, player.currentTime() - 10));
                    triggerSeekRipple(seekRippleLeft);
                    break;
                case 'arrowright':
                case 'l':
                    e.preventDefault();
                    player.currentTime(Math.min(player.duration() || 0, player.currentTime() + 10));
                    triggerSeekRipple(seekRippleRight);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    player.volume(Math.min(1, player.volume() + 0.1));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    player.volume(Math.max(0, player.volume() - 0.1));
                    break;
                case '[':
                case 'z':
                    e.preventDefault();
                    adjustSubtitleOffset(-0.25);
                    break;
                case ']':
                case 'x':
                    e.preventDefault();
                    adjustSubtitleOffset(+0.25);
                    break;
                case '0':
                    e.preventDefault();
                    setSubtitleOffset(0);
                    break;
            }
        });

        // ============================================
        // 8. 3RD PARTY API - VidPro Player API & PostMessage
        // ============================================
        window.Player = {
            getState: function() {
                if (!player) {
                    return {
                        id: String(ANILIST_ID),
                        mediaId: mediaId,
                        season: SEASON,
                        episode: EPISODE,
                        currentTime: 0,
                        duration: 0,
                        progress: 0,
                        paused: true,
                        ended: false,
                        volume: 1,
                        muted: false,
                        playbackRate: 1
                    };
                }
                const cur = player.currentTime() || 0;
                const dur = player.duration() || 0;
                return {
                    id: String(ANILIST_ID),
                    mediaId: mediaId,
                    season: SEASON,
                    episode: EPISODE,
                    currentTime: cur,
                    duration: dur,
                    progress: dur > 0 ? (cur / dur) * 100 : 0,
                    paused: Boolean(player.paused()),
                    ended: Boolean(player.ended()),
                    volume: player.volume !== undefined ? player.volume() : 1,
                    muted: Boolean(player.muted()),
                    playbackRate: player.playbackRate ? player.playbackRate() : 1
                };
            },
            setProgress: function(value, isPercentage = true) {
                if (!player) return;
                const dur = player.duration() || 0;
                if (isPercentage) {
                    player.currentTime((value / 100) * dur);
                } else {
                    player.currentTime(value);
                }
            },
            setCurrentTime: function(seconds) {
                if (player) player.currentTime(seconds);
            },
            play: function() {
                return player ? player.play() : Promise.reject(new Error('Player not ready'));
            },
            pause: function() {
                if (player) player.pause();
            },
            toggle: function() {
                if (player) {
                    player.paused() ? player.play() : player.pause();
                }
            },
            setVolume: function(vol) {
                if (player) player.volume(Math.max(0, Math.min(1, vol)));
            },
            setMuted: function(muted) {
                if (player) player.muted(Boolean(muted));
            },
            setPlaybackRate: function(rate) {
                if (player && player.playbackRate) player.playbackRate(rate);
            },
            seek: function(seconds) {
                if (player) player.currentTime((player.currentTime() || 0) + seconds);
            },
            onProgress: function(callback, interval = 1000) {
                return setInterval(() => callback(this.getState()), interval);
            },
            on: function(event, callback) {
                if (player) player.on(event, () => callback(this.getState()));
            },
            getMediaId: function() {
                return mediaId;
            },
            setSubtitleOffset: function(seconds) {
                setSubtitleOffset(Number(seconds) || 0);
            },
            getSubtitleOffset: function() {
                return currentSubtitleOffset;
            }
        };

        // Compatibility Aliases
        window.VidProPlayer = window.Player;
        window.AnimePlayer = window.Player;

        // PostMessage API for iframe communication
        window.addEventListener('message', function(event) {
            const data = event.data;
            if (!data || !data.action) return;

            let response = { action: data.action, success: true };
            try {
                switch(data.action) {
                    case 'getState':
                        response.state = window.Player.getState();
                        break;
                    case 'setProgress':
                        window.Player.setProgress(
                            data.progress !== undefined ? data.progress : data.value,
                            data.isPercentage !== false
                        );
                        break;
                    case 'setCurrentTime':
                        window.Player.setCurrentTime(
                            data.time !== undefined ? data.time : (data.seconds !== undefined ? data.seconds : data.value)
                        );
                        break;
                    case 'play':
                        window.Player.play();
                        break;
                    case 'pause':
                        window.Player.pause();
                        break;
                    case 'toggle':
                        window.Player.toggle();
                        break;
                    case 'setVolume':
                    case 'volume':
                        window.Player.setVolume(
                            data.volume !== undefined ? data.volume : data.value
                        );
                        break;
                    case 'setMuted':
                    case 'mute':
                        window.Player.setMuted(
                            data.muted !== undefined ? data.muted : true
                        );
                        break;
                    case 'unmute':
                        window.Player.setMuted(false);
                        break;
                    case 'setPlaybackRate':
                        window.Player.setPlaybackRate(
                            data.rate !== undefined ? data.rate : (data.playbackRate !== undefined ? data.playbackRate : data.value)
                        );
                        break;
                    case 'seek':
                        window.Player.seek(
                            data.seconds !== undefined ? data.seconds : data.value
                        );
                        break;
                    case 'setSubtitleOffset':
                        window.Player.setSubtitleOffset(data.offset !== undefined ? data.offset : data.value);
                        response.offset = currentSubtitleOffset;
                        break;
                    case 'getSubtitleOffset':
                        response.offset = currentSubtitleOffset;
                        break;
                    default:
                        response.success = false;
                        response.error = 'Unknown action';
                }
            } catch(e) {
                response.success = false;
                response.error = e.message;
            }

            if (event.source && typeof event.source.postMessage === 'function') {
                event.source.postMessage(response, '*');
            }
        });

        // Periodic 1-second progress broadcast to parent frame (unbranded)
        setInterval(() => {
            if (window.parent !== window && window.Player && player) {
                const state = window.Player.getState();
                window.parent.postMessage({ type: 'progress', state: state }, '*');
            }
        }, 1000);

        function emitPostMessage(eventType) {
            if (window.parent !== window && window.Player && player) {
                const state = window.Player.getState();
                window.parent.postMessage({ type: 'event', event: eventType, state: state }, '*');
            }
        }

        // Start initialization
        document.addEventListener('DOMContentLoaded', initVideoJS);
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initVideoJS();
        }
    </script>
</body>
</html>`;
}

module.exports = {
    generateAnimePlayerHTML
};
