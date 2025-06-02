// lib/utils.ts
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Existing utilities (ensure these are preserved)
export function getRandomCatEmoji(seed: string): string {
  const catEmojis = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return catEmojis[Math.abs(hash) % catEmojis.length];
}

export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}