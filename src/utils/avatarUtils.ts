// ================================================================
// Avatar & Banner Utilities — Client-side SVG generation
// Generates beautiful default avatars and banners
// as SVG data URIs. No API calls needed.
// ================================================================

// ---- Types ----

export interface CategoryColors {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  light: string;
  dark: string;
}

export interface BannerSize {
  width: number;
  height: number;
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

const PLACEHOLDER_PATTERNS = [
  /^\/images\//,
  /default_profile\.png$/,
  /\/backend\/uploads\/default/,
  /^https?:\/\/.*placeholder/,
  /^https?:\/\/.*stock/,
  /^https?:\/\/via\.placeholder\.com/,
  /^data:image\/svg\+xml/,
  /^$/,
  /^undefined$/,
  /^null$/,
];

export function isDefaultAvatar(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(url.trim()));
}

export function isRealImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (isDefaultAvatar(url)) return false;
  if (url.includes("generate-banner") || url.includes("generate-avatar")) return false;

  const trimmed = url.trim();
  if (trimmed.startsWith('file://')) return true; // React Native file URIs
  if (trimmed.startsWith('data:image/')) return true; // Allow data URIs for previews
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('http') && (trimmed.includes('cloudinary') || trimmed.includes('res.cloudinary'))) return true;
  if (trimmed.startsWith('http') && (trimmed.includes('placeholder') || trimmed.includes('stock'))) return false;
  if (trimmed.startsWith('http')) return true;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/profile/') || trimmed.startsWith('/img/')) return true;
  
  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?.*)?$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function generateAvatarDataUrl(name: string, size: number = 200, category?: string): string {
  const colors = getCategoryColors(category, name);
  const initials = getInitials(name);
  const hash = simpleHash(name || 'default');
  const uid = `av-${hash}`;
  const s = size;

  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const patternOpacity = 0.06 + rng(hash) * 0.06;
  const patternType = hash % 3;

  let patternSvg = '';
  if (patternType === 0) {
    const cx = 30 + rng(hash + 1) * 40;
    const cy = 30 + rng(hash + 2) * 40;
    for (let i = 1; i <= 4; i++) {
      const r = 10 + i * 8;
      patternSvg += `<circle cx="${cx}%" cy="${cy}%" r="${r}" fill="none" stroke="white" stroke-width="0.5" opacity="${patternOpacity * (1 - i * 0.15)}" />`;
    }
    for (let i = 0; i < 6; i++) {
      const dx = 15 + rng(hash + 10 + i) * 70;
      const dy = 15 + rng(hash + 20 + i) * 70;
      const dr = 1 + rng(hash + 30 + i) * 2.5;
      patternSvg += `<circle cx="${dx}%" cy="${dy}%" r="${dr}" fill="white" opacity="${patternOpacity * 0.8}" />`;
    }
  } else if (patternType === 1) {
    const baseX = 20 + rng(hash + 1) * 30;
    const baseY = 20 + rng(hash + 2) * 30;
    const hexR = 12 + rng(hash + 3) * 10;
    const hexPoints = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return `${baseX + hexR * Math.cos(angle)}%,${baseY + hexR * Math.sin(angle)}%`;
    }).join(' ');
    patternSvg += `<polygon points="${hexPoints}" fill="none" stroke="white" stroke-width="0.6" opacity="${patternOpacity}" />`;
    const hex2R = hexR * 0.55;
    const hex2X = 65 + rng(hash + 4) * 25;
    const hex2Y = 60 + rng(hash + 5) * 25;
    const hex2Points = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i;
      return `${hex2X + hex2R * Math.cos(angle)}%,${hex2Y + hex2R * Math.sin(angle)}%`;
    }).join(' ');
    patternSvg += `<polygon points="${hex2Points}" fill="none" stroke="white" stroke-width="0.5" opacity="${patternOpacity * 0.7}" />`;
  } else {
    for (let i = 0; i < 5; i++) {
      const x1 = 10 + rng(hash + 10 + i) * 30;
      const y1 = 5 + i * 22;
      const x2 = x1 + 15 + rng(hash + 20 + i) * 30;
      const y2 = y1 + 18 + rng(hash + 30 + i) * 12;
      patternSvg += `<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" stroke="white" stroke-width="0.5" opacity="${patternOpacity}" stroke-linecap="round" />`;
    }
  }

  const fontSize = s * (initials.length > 2 ? 0.22 : 0.3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="${uid}-rg1" cx="30%" cy="25%" r="80%" fx="25%" fy="20%">
      <stop offset="0%" stop-color="${colors.light}" stop-opacity="0.4" />
      <stop offset="45%" stop-color="${colors.primary}" />
      <stop offset="100%" stop-color="${colors.dark}" />
    </radialGradient>
    <radialGradient id="${uid}-rg2" cx="70%" cy="75%" r="60%" fx="75%" fy="80%">
      <stop offset="0%" stop-color="${colors.secondary}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="${uid}-rg3" cx="35%" cy="30%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.12" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </radialGradient>
    <clipPath id="${uid}-clip">
      <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" />
    </clipPath>
  </defs>
  <g clip-path="url(#${uid}-clip)">
    <rect width="${s}" height="${s}" fill="${colors.accent}" />
    <rect width="${s}" height="${s}" fill="url(#${uid}-rg1)" />
    <rect width="${s}" height="${s}" fill="url(#${uid}-rg2)" />
    <g>${patternSvg}</g>
    <rect width="${s}" height="${s}" fill="url(#${uid}-rg3)" />
    <text
      x="50%" y="52%"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="600"
      fill="white"
      letter-spacing="0.02em"
    >${initials}</text>
  </g>
  <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 0.5}" fill="none" stroke="white" stroke-opacity="0.15" stroke-width="1" />
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateBannerDataUrl(
  name: string,
  category?: string,
  size: BannerSize | { width: number; height: number } | number = { width: 1600, height: 800 },
  heightArg?: number
): string {
  const colors = getCategoryColors(category, name);
  const hash = simpleHash(name || 'default');
  const uid = `bn-${hash}`;
  
  let w = 1600;
  let h = 800;
  
  if (typeof size === 'number') {
    w = size;
    h = heightArg || 400;
  } else {
    w = size.width;
    h = size.height;
  }

  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  let patterns = '';
  
  const angle = 15 + rng(hash) * 30;
  patterns += `<path d="M${w * 0.4},0 L${w},0 L${w},${h} L${w * 0.1},${h} Z" fill="white" opacity="0.04" />`;
  patterns += `<path d="M${w * 0.6},0 L${w},0 L${w},${h * 0.7} Z" fill="black" opacity="0.03" />`;

  for (let i = 0; i < 3; i++) {
    const sw = 20 + rng(hash + i) * 60;
    const sx = rng(hash + i * 10) * w;
    patterns += `<rect x="${sx}" y="0" width="${sw}" height="${h}" fill="white" opacity="0.02" transform="skewX(${-angle})" />`;
  }

  const dotSpacing = 40;
  let dots = '';
  for (let x = dotSpacing; x < w; x += dotSpacing) {
    for (let y = dotSpacing; y < h; y += dotSpacing) {
      if (rng(hash + x + y) > 0.85) {
        dots += `<circle cx="${x}" cy="${y}" r="1.5" fill="white" opacity="0.1" />`;
      }
    }
  }
  patterns += dots;

  const meshColors = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.dark,
    colors.light
  ];
  
  const color1 = meshColors[hash % meshColors.length];
  const color2 = meshColors[(hash + 2) % meshColors.length];
  let displayName = name || 'Ratedeed';
  
  if (displayName.includes('-') && !displayName.includes(' ')) {
    displayName = displayName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  const categoryLabel = category || '';
  
  const charCount = displayName.length;
  let baseFontSizeMultiplier = 0.075;
  if (charCount > 20) baseFontSizeMultiplier = 0.06;
  if (charCount > 30) baseFontSizeMultiplier = 0.045;
  
  const titleFontSize = Math.min(w * baseFontSizeMultiplier, h * 0.18, 96);
  const categoryFontSize = Math.min(w * 0.025, h * 0.08, 32);

  const escapedName = escapeXml(displayName);
  const escapedCategory = categoryLabel ? escapeXml(categoryLabel) : '';

  const maxLineChars = Math.floor(w / (titleFontSize * 0.55));
  let nameSvg = '';
  let hasSecondLine = false;
  
  if (escapedName.length > maxLineChars) {
    const words = escapedName.split(/[\s-]+/);
    let line1 = '';
    let line2 = '';
    let currentLine = 1;
    
    for (const word of words) {
      if (currentLine === 1 && (line1.length + word.length + 1) <= maxLineChars) {
        line1 += (line1 ? ' ' : '') + word;
      } else if (currentLine === 1 && line1 === '') {
        line1 = word;
        currentLine = 2;
      } else {
        currentLine = 2;
        line2 += (line2 ? ' ' : '') + word;
      }
    }
    
    if (line2) {
      hasSecondLine = true;
      if (line2.length > maxLineChars) line2 = line2.substring(0, maxLineChars - 3) + '...';
      nameSvg = `
        <text x="50%" y="${h * 0.42}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="white">${line1}</text>
        <text x="50%" y="${h * 0.42 + titleFontSize * 1.15}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="white">${line2}</text>
      `;
    } else {
      nameSvg = `<text x="50%" y="${h * 0.45}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="white">${line1}</text>`;
    }
  } else {
    nameSvg = `<text x="50%" y="${h * 0.45}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="white">${escapedName}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${uid}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.primary}" />
      <stop offset="50%" stop-color="${colors.secondary}" />
      <stop offset="100%" stop-color="${colors.dark}" />
    </linearGradient>
    
    <radialGradient id="${uid}-mesh1" cx="20%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${color1}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="${color1}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="${uid}-mesh2" cx="80%" cy="70%" r="70%">
      <stop offset="0%" stop-color="${color2}" stop-opacity="0.5" />
      <stop offset="100%" stop-color="${color2}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#${uid}-bg)" />
  <rect width="${w}" height="${h}" fill="url(#${uid}-mesh1)" />
  <rect width="${w}" height="${h}" fill="url(#${uid}-mesh2)" />
  
  <g>${patterns}</g>
<!-- Text Content -->
<g>
  ${nameSvg}

  ${escapedCategory ? `
  <text
    x="50%"
    y="${h * (hasSecondLine ? 0.42 + (titleFontSize / h) * 2.2 : 0.45 + (titleFontSize / h) * 1.2)}"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${categoryFontSize}"
    font-weight="500"
    fill="white"
    fill-opacity="0.85"
    letter-spacing="0.1em"
    text-transform="uppercase"
  >${escapedCategory}</text>
  ` : ''}
</g>

  <rect width="${w}" height="${h}" fill="white" fill-opacity="0.03" />
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

export function getProfileImageUrl(
  name: string,
  profilePicture: string,
  category?: string,
  size: number = 200,
): string {
  if (isRealImageUrl(profilePicture)) return profilePicture;
  return generateAvatarDataUrl(name, size, category);
}

export function getCoverImageUrl(
  name: string,
  coverImage: string,
  category?: string,
  width: number = 1600,
  height: number = 800
): string {
  if (isRealImageUrl(coverImage)) return coverImage;
  return generateBannerDataUrl(name, category, { width, height });
}

export function getAvatarUrl(
  profilePicture: string,
  name: string,
  category?: string,
  size: number = 200,
): string {
  if (isRealImageUrl(profilePicture)) return profilePicture;
  return generateAvatarDataUrl(name, size, category);
}

export function isDefaultImage(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  return !isRealImageUrl(url);
}

export function isSvgUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  return url.startsWith('data:image/svg+xml') || url.includes('<svg') || url.includes('generate-banner') || url.includes('generate-avatar');
}
