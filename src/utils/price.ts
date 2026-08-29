export function parsePriceRange(priceStr: string) {
  const clean = (priceStr || '').trim();
  if (!clean) {
    return { min: '', max: '', contactForQuote: false };
  }
  
  if (
    clean.toLowerCase().includes('quote') || 
    clean.toLowerCase().includes('contact') || 
    clean.toLowerCase() === 'n/a' || 
    clean.toLowerCase() === 'na' || 
    clean.toLowerCase() === 'custom'
  ) {
    return { min: '', max: '', contactForQuote: true };
  }

  // Look for two numbers (handles integers and decimals like 75.50 - 150.00)
  const numbers = clean.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (numbers && numbers.length >= 2) {
    return { min: numbers[0], max: numbers[1], contactForQuote: false };
  } else if (numbers && numbers.length === 1) {
    if (clean.includes('+') || clean.toLowerCase().includes('start')) {
      return { min: numbers[0], max: '', contactForQuote: false };
    }
    if (clean.toLowerCase().includes('up to') || clean.toLowerCase().includes('under')) {
      return { min: '', max: numbers[0], contactForQuote: false };
    }
    return { min: numbers[0], max: numbers[0], contactForQuote: false };
  }

  return { min: '', max: '', contactForQuote: false };
}

export function formatPriceRange(minPrice: string, maxPrice: string, contactForQuote: boolean): string {
  if (contactForQuote) {
    return 'Contact for Quote';
  }
  const min = (minPrice || '').replace(/[^0-9.]/g, '').trim();
  const max = (maxPrice || '').replace(/[^0-9.]/g, '').trim();
  if (min && max) {
    return `$${Number(min).toLocaleString(undefined, { minimumFractionDigits: min.includes('.') ? 2 : 0, maximumFractionDigits: 2 })} – $${Number(max).toLocaleString(undefined, { minimumFractionDigits: max.includes('.') ? 2 : 0, maximumFractionDigits: 2 })}`;
  } else if (min) {
    return `$${Number(min).toLocaleString(undefined, { minimumFractionDigits: min.includes('.') ? 2 : 0, maximumFractionDigits: 2 })}+`;
  } else if (max) {
    return `Up to $${Number(max).toLocaleString(undefined, { minimumFractionDigits: max.includes('.') ? 2 : 0, maximumFractionDigits: 2 })}`;
  }
  return 'Contact for Quote';
}
