// ================================================================
// Avatar & Banner Utilities — Client-side SVG generation
// Generates beautiful default avatars and banners as SVG data URIs.
// Ported from web version.
// ================================================================

import { API_BASE_URL } from '../config';

export interface CategoryColors {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  light: string;
  dark: string;
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
    for (const kw of keywords) {
      if (lower.includes(kw)) return key as CategoryKey;
    }
  }
  return null;
}

const COLOR_PALETTES: Record<CategoryKey, CategoryColors> = {
  plumbers: {
    primary: '#0ea5e9', secondary: '#0284c7', accent: '#0369a1',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
    light: '#bae6fd', dark: '#075985',
  },
  electricians: {
    primary: '#f59e0b', secondary: '#d97706', accent: '#b45309',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
    light: '#fde68a', dark: '#92400e',
  },
  painters: {
    primary: '#ec4899', secondary: '#db2777', accent: '#be185d',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)',
    light: '#fbcfe8', dark: '#9d174d',
  },
  landscaping: {
    primary: '#10b981', secondary: '#059669', accent: '#047857',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
    light: '#a7f3d0', dark: '#065f46',
  },
  hvac: {
    primary: '#f97316', secondary: '#ea580c', accent: '#dc2626',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
    light: '#fed7aa', dark: '#9a3412',
  },
  roofers: {
    primary: '#78716c', secondary: '#57534e', accent: '#44403c',
    gradient: 'linear-gradient(135deg, #78716c 0%, #57534e 50%, #44403c 100%)',
    light: '#d6d3d1', dark: '#292524',
  },
  cleaners: {
    primary: '#06b6d4', secondary: '#0891b2', accent: '#0e7490',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
    light: '#a5f3fc', dark: '#155e75',
  },
  handyman: {
    primary: '#6366f1', secondary: '#4f46e5', accent: '#4338ca',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)',
    light: '#c7d2fe', dark: '#3730a3',
  },
};

const DEFAULT_PALETTE: CategoryColors = {
  primary: '#7c3aed', secondary: '#6d28d9', accent: '#5b21b6',
  gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
  light: '#ddd6fe', dark: '#4c1d95',
};

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeterministicColors(seed: string): CategoryColors {
  const hash = simpleHash(seed || 'default');
  const hues = [225, 210, 260, 160, 185, 335, 45, 25, 195];
  const hue = hues[hash % hues.length];
  const finalHue = (hue + (hash % 20) - 10 + 360) % 360;
  return {
    primary: `hsl(${finalHue}, 70%, 50%)`,
    secondary: `hsl(${(finalHue + 20) % 360}, 75%, 45%)`,
    accent: `hsl(${(finalHue + 40) % 360}, 80%, 40%)`,
    gradient: `linear-gradient(135deg, hsl(${finalHue}, 70%, 50%) 0%, hsl(${(finalHue + 30) % 360}, 75%, 45%) 100%)`,
    light: `hsl(${finalHue}, 80%, 85%)`,
    dark: `hsl(${finalHue}, 90%, 25%)`,
  };
}

export function getCategoryColors(category?: string, seed?: string): CategoryColors {
  if (seed) return getDeterministicColors(seed);
  const key = detectCategory(category);
  if (!key) return DEFAULT_PALETTE;
  return COLOR_PALETTES[key];
}

export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';
  const fillerWords = new Set(['the', 'and', 'of', 'in', 'a', 'an', 'for', 'at', 'to', 'with', 'co', 'inc', 'llc']);
  const words = name
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !fillerWords.has(w.toLowerCase()));
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateAvatarDataUrl(name: string, size: number = 200, category?: string): string {
  const colors = getCategoryColors(category, name);
  const initials = getInitials(name);
  const hash = simpleHash(name || 'default');
  const uid = `av-${hash}`;
  const s = size;
  const fontSize = s * (initials.length > 2 ? 0.22 : 0.3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="${uid}-rg1" cx="30%" cy="25%" r="80%" fx="25%" fy="20%">
      <stop offset="0%" stop-color="${colors.light}" stop-opacity="0.4" />
      <stop offset="45%" stop-color="${colors.primary}" />
      <stop offset="100%" stop-color="${colors.dark}" />
    </radialGradient>
    <clipPath id="${uid}-clip"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" /></clipPath>
  </defs>
  <g clip-path="url(#${uid}-clip)">
    <rect width="${s}" height="${s}" fill="${colors.accent}" />
    <rect width="${s}" height="${s}" fill="url(#${uid}-rg1)" />
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="600" fill="white">${initials}</text>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generate a beautiful SVG data URI for a contractor banner/cover image.
 */
export function generateBannerDataUrl(
  name: string,
  category?: string,
  width: number = 800,
  height: number = 400,
): string {
  const colors = getCategoryColors(category, name);
  const hash = simpleHash(name || 'default');
  const uid = `bn-${hash}`;
  const w = width;
  const h = height;

  const titleFontSize = Math.min(w * 0.065, 44);
  const categoryFontSize = Math.min(w * 0.03, 22);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${uid}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.primary}" />
      <stop offset="100%" stop-color="${colors.dark}" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${uid}-bg)" />
  <g>
    <text
      x="50%"
      y="${h * 0.45}"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="sans-serif"
      font-size="${titleFontSize}"
      font-weight="800"
      fill="white"
    >${escapeXml(name || 'Ratedeed')}</text>
    
    ${category ? `
    <text
      x="50%"
      y="${h * 0.45 + titleFontSize * 1.2}"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="sans-serif"
      font-size="${categoryFontSize}"
      font-weight="500"
      fill="white"
      fill-opacity="0.85"
    >${escapeXml(category)}</text>
    ` : ''}
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 
 * Check if a URL is a real uploaded image.
 * Returns FALSE for generated placeholders or empty strings.
 */
export function isRealImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  
  // Explicitly ignore generated endpoints
  if (trimmed.includes('generate-banner') || trimmed.includes('generate-avatar')) return false;
  
  // Data URIs are not "real uploaded images" (they are local or generated)
  if (trimmed.startsWith('data:')) return false;
  
  // Local assets are not "real uploaded images"
  if (trimmed.startsWith('/images/') || trimmed.startsWith('/img/')) return false;
  
  // Check for Cloudinary or standard HTTP images
  if (trimmed.includes('cloudinary') || trimmed.includes('res.cloudinary')) return true;
  if (trimmed.startsWith('http')) {
    // Only return true if it's NOT a generate endpoint (checked above)
    return true;
  }
  
  // Fallback check for common image extensions
  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?.*)?$/i.test(trimmed)) return true;
  
  return false;
}

export function isDefaultImage(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  return !isRealImageUrl(url);
}

export function getProfileImageUrl(name: string, profilePicture: string, category?: string): string {
  if (isRealImageUrl(profilePicture)) return profilePicture;
  return generateAvatarDataUrl(name, 200, category);
}

export function getCoverImageUrl(name: string, coverImage: string, category?: string): string {
  if (isRealImageUrl(coverImage)) return coverImage;
  return generateBannerDataUrl(name, category);
}

export function isSvgUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  return url.startsWith('data:image/svg+xml') || url.includes('<svg') || url.includes('generate-banner') || url.includes('generate-avatar');
}
