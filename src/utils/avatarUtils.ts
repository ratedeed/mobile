// ================================================================
// Avatar & Banner Utilities — Dynamic Apple Music Gradients
// Features: 360° hue distribution, variable sweep directions, 
// multi-angle generation, anti-banding, and category anchoring.
// ================================================================

export interface CategoryColors {
  c1: string; // 0%
  c2: string; // 20%
  c3: string; // 39%
  c4: string; // 76%
  c5: string; // 100%
}

export interface BannerSize {
  width: number;
  height: number;
}

export interface GradientConfig {
  colors: CategoryColors;
  angle: { x1: string; y1: string; x2: string; y2: string };
}

type CategoryKey =
  | 'plumbers'
  | 'electricians'
  | 'painters'
  | 'landscaping'
  | 'hvac'
  | 'roofers'
  | 'cleaners'
  | 'handyman';

// ---- Category Detection ----

const CATEGORY_KEYWORDS: Record<CategoryKey, string[]> = {
  plumbers: ['plumber', 'plumbing', 'pipe', 'aqua', 'drain', 'water heater', 'sewer', 'hydro'],
  electricians: ['electrician', 'electrical', 'wiring', 'electric', 'smart home', 'ev charger', 'panel upgrade'],
  painters: ['painter', 'painting', 'paint', 'master suite'],
  landscaping: ['landscape', 'landscaping', 'lawn', 'garden', 'greenscape', 'tree', 'hardscape', 'irrigation'],
  hvac: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'heat pump', 'duct'],
  roofers: ['roofer', 'roofing', 'roof', 'premium roof'],
  cleaners: ['cleaner', 'cleaning', 'maid', 'sparkle'],
  handyman: ['handyman', 'handy', 'repair', 'maintenance', 'general contractor', 'renovation', 'remodel', 'builder', 'elite', 'exterior', 'home'],
};

export function detectCategory(category?: string): CategoryKey | null {
  if (!category) return null;
  const lower = category.toLowerCase();
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return key as CategoryKey;
  }
  return null;
}

// ---- Dynamic Gradient Engine ----

const CATEGORY_HUES: Record<CategoryKey, number> = {
  plumbers: 200,    // Deep Blue
  electricians: 35, // Amber/Orange
  painters: 320,    // Pink/Magenta
  landscaping: 130, // Green
  hvac: 350,        // Crimson/Red
  roofers: 220,     // Slate/Indigo
  cleaners: 180,    // Cyan/Teal
  handyman: 260     // Purple/Violet
};

// DJB2 Hash function for excellent string randomization
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// 6 distinct diagonal/linear angles for visual variety
const GRADIENT_ANGLES = [
  { x1: '100%', y1: '100%', x2: '0%', y2: '0%' },
  { x1: '0%', y1: '100%', x2: '100%', y2: '0%' },
  { x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
  { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  { x1: '50%', y1: '0%', x2: '50%', y2: '100%' },
  { x1: '0%', y1: '50%', x2: '100%', y2: '50%' },
];

export function getGradientConfig(category?: string, seed?: string): GradientConfig {
  const key = detectCategory(category);
  const baseHue = key ? CATEGORY_HUES[key] : 240;

  let startHue = baseHue;
  let satBase = 75;
  let lightBase = 55;
  let angleIndex = 0;
  let sweepDir = 1;
  let span = 60;

  if (seed) {
    const safeHash = hashString(seed);
    const hueShift = (safeHash % 80) - 40;
    startHue = (baseHue + hueShift + 360) % 360;
    satBase = 75 + (safeHash % 20);
    lightBase = 55 + ((safeHash >> 3) % 10);
    angleIndex = safeHash % GRADIENT_ANGLES.length;
    sweepDir = (safeHash % 2 === 0) ? 1 : -1;
    span = 45 + ((safeHash >> 5) % 40);
  }

  const h = (offset: number) => (startHue + sweepDir * offset + 360) % 360;

  return {
    colors: {
      c1: `hsl(${h(0)}, ${satBase}%, ${lightBase}%)`,
      c2: `hsl(${h(span * 0.25)}, ${Math.max(0, satBase - 5)}%, ${lightBase + 4}%)`,
      c3: `hsl(${h(span * 0.5)}, ${Math.max(0, satBase - 10)}%, ${lightBase + 8}%)`,
      c4: `hsl(${h(span * 0.75)}, ${Math.max(0, satBase - 5)}%, ${lightBase + 14}%)`,
      c5: `hsl(${h(span)}, ${satBase}%, ${lightBase + 20}%)`,
    },
    angle: GRADIENT_ANGLES[angleIndex]
  };
}

export function getCategoryColors(category?: string, seed?: string): CategoryColors {
  return getGradientConfig(category, seed).colors;
}

// ---- Utilities ----

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';
  const fillerWords = new Set(['the', 'and', 'of', 'in', 'a', 'an', 'for', 'at', 'to', 'with', 'co', 'inc', 'llc']);

  const words = name
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length > 0 && !fillerWords.has(w.toLowerCase()));

  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ---- Image URL Validators ----

const DEFAULT_PATTERNS = [
  /^\/images\//,
  /default_profile\.png$/,
  /\/backend\/uploads\/default/,
  /^https?:\/\/.*placeholder/i,
  /^https?:\/\/.*stock/i,
  /^https?:\/\/via\.placeholder\.com/i,
  /^data:image\/svg\+xml/i,
  /^$/,
  /^undefined$/,
  /^null$/,
];

export function isDefaultAvatar(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  return DEFAULT_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isRealImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (isDefaultAvatar(url)) return false;
  if (url.includes("generate-banner") || url.includes("generate-avatar")) return false;

  const trimmed = url.trim();

  if (trimmed.startsWith('file://') || /^data:image\/(?!svg).+$/i.test(trimmed)) return true;
  if (trimmed.startsWith('data:')) return false;

  if (trimmed.startsWith('http')) {
    if (trimmed.includes('placeholder') || trimmed.includes('stock')) return false;
    return true;
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/profile/') || trimmed.startsWith('/img/')) return true;
  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?.*)?$/i.test(trimmed)) return true;

  return false;
}

// ---- Caching for Performance ----
const avatarCache = new Map<string, string>();
const bannerCache = new Map<string, string>();

// ---- Premium SVG Generators ----

function buildSvgDefs(uid: string, config: GradientConfig): string {
  const { colors, angle } = config;
  return `
    <defs>
      <linearGradient id="${uid}-grad" x1="${angle.x1}" y1="${angle.y1}" x2="${angle.x2}" y2="${angle.y2}">
        <stop offset="0%"   stop-color="${colors.c1}" />
        <stop offset="20%"  stop-color="${colors.c2}" />
        <stop offset="39%"  stop-color="${colors.c3}" />
        <stop offset="76%"  stop-color="${colors.c4}" />
        <stop offset="100%" stop-color="${colors.c5}" />
      </linearGradient>
      <filter id="${uid}-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.05 0" />
      </filter>
    </defs>
  `.trim();
}

// ─── FIX 1: Avatar — dy-based vertical centering + letter-spacing fix ─────────
// Removed letter-spacing which causes alignment shifts on centered text elements.
// Replaced dominant-baseline with a dynamic unitless pixel dy offset to ensure consistent rendering across Android/iOS.
export function generateAvatarDataUrl(name: string, size: number = 200, category?: string): string {
  const cacheKey = `av-${name}-${size}-${category}`;
  if (avatarCache.has(cacheKey)) return avatarCache.get(cacheKey)!;

  const config = getGradientConfig(category, name);
  const initials = getInitials(name);
  const hash = hashString(name || 'default');
  const uid = `av-${hash}-${size}`;
  const s = size;

  const fontSize = s * (initials.length > 2 ? 0.26 : 0.36);
  const dyVal = fontSize * 0.35; // mathematically centers capitals on the baseline

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" preserveAspectRatio="xMidYMid slice">
  ${buildSvgDefs(uid, config)}
  <clipPath id="${uid}-clip"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" /></clipPath>
  <g clip-path="url(#${uid}-clip)">
    <rect width="${s}" height="${s}" fill="url(#${uid}-grad)" />
    <rect width="${s}" height="${s}" filter="url(#${uid}-noise)" pointer-events="none" />
    <text x="${s / 2}" y="${s / 2}" dy="${dyVal}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${initials}</text>
  </g>
  <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 0.75}" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5" />
</svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  avatarCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/[\s-]+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length > 2) {
    lines[1] = lines.slice(1).join(' ');
    if (lines[1].length > maxChars) {
      lines[1] = lines[1].substring(0, maxChars - 3).trimEnd() + '...';
    }
    lines.length = 2;
  }
  return lines;
}

// ─── FIX 2: Banner — group centering + verticalBias for mobile nav overlap ────
//
// WHY verticalBias EXISTS:
//   On mobile, the back-button / action-button row is overlaid transparently
//   on the top of the banner. That nav area is roughly 25–30 % of the banner
//   height. Centering at 50 % of the SVG puts the text too close to those
//   buttons. verticalBias shifts the group's center downward as a fraction of
//   the banner height so the text sits in the visual middle of the *empty*
//   gradient space below the nav row.
//
//   Recommended value for a typical mobile profile header:  0.10 – 0.13
//   Default (0) keeps the old geometric center for web / non-overlay contexts.
//
export function generateBannerDataUrl(
  name: string,
  category?: string,
  size: BannerSize | number = { width: 1600, height: 800 },
  heightArg?: number,
  // ↓ NEW: fraction of banner height to shift the text block downward.
  //        Pass ~0.12 for mobile layouts where a nav bar is overlaid at top.
  verticalBias: number = 0
): string {
  const { width: w, height: h } = typeof size === 'number'
    ? { width: size, height: heightArg || 400 }
    : { width: size.width, height: size.height };

  const cacheKey = `bn-${name}-${category}-${w}x${h}-${verticalBias}`;
  if (bannerCache.has(cacheKey)) return bannerCache.get(cacheKey)!;

  const config = getGradientConfig(category, name);
  const hash = hashString(name || 'default');
  const uid = `bn-${hash}-${w}x${h}`;

  let displayName = name || 'Ratedeed';
  if (displayName.includes('-') && !displayName.includes(' ')) {
    displayName = displayName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const charCount = displayName.length;
  const fontScale = charCount > 30 ? 0.045 : charCount > 20 ? 0.06 : 0.075;
  const titleFontSize = Math.min(w * fontScale, h * 0.16, 84);
  const categoryFontSize = Math.min(w * 0.016, h * 0.035, 20);

  const maxLineChars = Math.floor(w / (titleFontSize * 0.55));
  const lines = wrapText(displayName, maxLineChars);

  const lineHeight = titleFontSize * 1.15;
  const hasCategory = !!category;

  // Total visual height of all elements stacked:
  //   titleBlockHeight  = height of all title lines
  //   separatorGap      = space below last title line to the separator
  //   separatorSize     = stroke width of the separator line
  //   categoryGap       = space from separator bottom to top of category text
  //   categoryFontSize  = height of the category label
  const titleBlockHeight = titleFontSize + (lines.length - 1) * lineHeight;
  const separatorGap  = hasCategory ? h * 0.045 : 0;
  const separatorSize = hasCategory ? 2          : 0;
  const categoryGap   = hasCategory ? h * 0.025  : 0;
  const totalGroupHeight = titleBlockHeight
    + (hasCategory ? separatorGap + separatorSize + categoryGap + categoryFontSize : 0);

  // Center the group, then apply verticalBias to push it below any nav overlay.
  // verticalBias = 0   → geometric center (web / no overlay)
  // verticalBias = 0.12 → center shifted 12 % of banner height downward (mobile)
  const groupTopY = (h - totalGroupHeight) / 2 + h * verticalBias;
  const startY    = groupTopY + titleFontSize / 2;   // visual center of first title line

  const dyTitle = titleFontSize * 0.35;
  const dyCategory = categoryFontSize * 0.35;

  const nameSvg = lines.map((line, i) =>
    `<text x="${w / 2}" y="${startY + i * lineHeight}" dy="${dyTitle}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-size="${titleFontSize}" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`
  ).join('\n  ');

  let categorySvg = '';
  if (hasCategory) {
    const separatorY = groupTopY + titleBlockHeight + separatorGap;
    const categoryY  = separatorY + separatorSize + categoryGap + categoryFontSize / 2;

    categorySvg = `
  <line x1="${w / 2 - 16}" y1="${separatorY}" x2="${w / 2 + 16}" y2="${separatorY}"
    stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" />
  <text x="${w / 2}" y="${categoryY}" dy="${dyCategory}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-size="${categoryFontSize}" font-weight="700" fill="rgba(255,255,255,0.9)">${escapeXml((category!).toUpperCase())}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  ${buildSvgDefs(uid, config)}
  <rect width="${w}" height="${h}" fill="url(#${uid}-grad)" />
  <rect width="${w}" height="${h}" filter="url(#${uid}-noise)" pointer-events="none" />
  <rect x="1" y="1" width="${w-2}" height="${h-2}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" rx="4" pointer-events="none" />
  <g>
  ${nameSvg}${categorySvg}
  </g>
</svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  bannerCache.set(cacheKey, dataUrl);
  return dataUrl;
}

// ---- Public API Helpers ----

export function getProfileImageUrl(name: string, profilePicture: string, category?: string, size: number = 200): string {
  return isRealImageUrl(profilePicture) ? profilePicture : generateAvatarDataUrl(name, size, category);
}

// Updated: pass verticalBias ≈ 0.12 for mobile to account for nav bar overlay
export function getCoverImageUrl(
  name: string,
  coverImage: string,
  category?: string,
  width: number = 1600,
  height: number = 800,
  verticalBias: number = 0
): string {
  return isRealImageUrl(coverImage)
    ? coverImage
    : generateBannerDataUrl(name, category, { width, height }, undefined, verticalBias);
}

export function getAvatarUrl(profilePicture: string, name: string, category?: string, size: number = 200): string {
  return getProfileImageUrl(name, profilePicture, category, size);
}

export function isDefaultImage(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  return !isRealImageUrl(url);
}

export function isSvgUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  return url.startsWith('data:image/svg+xml') || url.includes('<svg') || url.includes('generate-banner') || url.includes('generate-avatar');
}