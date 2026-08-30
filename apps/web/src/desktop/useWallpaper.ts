import { useEffect, useState } from 'react';

const ROTATE_MS = 10 * 60 * 1000;
const MAX_PROBE = 10;
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

function probe(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Wallpaper rotation: drop files into apps/web/public/wallpapers/ named
 * 1.jpg, 2.jpg, … (png/webp also fine). Discovered at load, rotated every
 * 10 minutes. Falls back to /wallpaper.jpg, then the CSS gradient.
 */
export function useWallpaper(): string | null {
  const [found, setFound] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const urls: string[] = [];
      for (let i = 1; i <= MAX_PROBE; i++) {
        const hits = await Promise.all(EXTENSIONS.map((ext) => probe(`/wallpapers/${i}.${ext}`)));
        const hit = hits.find(Boolean);
        if (hit) urls.push(hit);
        else if (i > 1) break; // stop at the first gap after 1
      }
      if (urls.length === 0) {
        const single = await probe('/wallpaper.jpg');
        if (single) urls.push(single);
      }
      if (alive) {
        setFound(urls);
        setIndex(Math.floor(Math.random() * Math.max(1, urls.length)));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (found.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % found.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [found.length]);

  return found[index % Math.max(1, found.length)] ?? null;
}
