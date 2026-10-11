// Font families for the Text effect: system fonts plus Google Fonts loaded on demand.

export interface FontFamily {
  name: string;
  google?: boolean;
}

export const FONT_FAMILIES: FontFamily[] = [
  { name: 'Inter', google: true },
  { name: 'Helvetica' },
  { name: 'Arial' },
  { name: 'Georgia' },
  { name: 'Times New Roman' },
  { name: 'Courier New' },
  { name: 'Impact' },
  { name: 'Archivo Black', google: true },
  { name: 'Anton', google: true },
  { name: 'Bebas Neue', google: true },
  { name: 'Oswald', google: true },
  { name: 'Montserrat', google: true },
  { name: 'Unbounded', google: true },
  { name: 'Syne', google: true },
  { name: 'Playfair Display', google: true },
  { name: 'DM Serif Display', google: true },
  { name: 'Abril Fatface', google: true },
  { name: 'Instrument Serif', google: true },
  { name: 'Space Grotesk', google: true },
  { name: 'Space Mono', google: true },
  { name: 'IBM Plex Mono', google: true },
  { name: 'JetBrains Mono', google: true },
  { name: 'VT323', google: true },
  { name: 'Press Start 2P', google: true },
  { name: 'Silkscreen', google: true },
  { name: 'Pixelify Sans', google: true },
  { name: 'Major Mono Display', google: true },
  { name: 'Monoton', google: true },
  { name: 'Bungee', google: true },
  { name: 'Rubik Mono One', google: true },
  { name: 'Permanent Marker', google: true },
  { name: 'Pacifico', google: true },
  { name: 'Lobster', google: true },
  { name: 'UnifrakturMaguntia', google: true },
];

const loaded = new Map<string, Promise<void>>();

export function loadFont(name: string): Promise<void> {
  const fam = FONT_FAMILIES.find((f) => f.name === name);
  if (!fam || !fam.google) return Promise.resolve();
  let p = loaded.get(name);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700&display=block`;
      link.onload = () => {
        Promise.all([document.fonts.load(`400 64px "${name}"`), document.fonts.load(`700 64px "${name}"`)])
          .catch(() => undefined)
          .then(() => {
            document.dispatchEvent(new CustomEvent('fontloaded', { detail: name }));
            resolve();
          });
      };
      link.onerror = () => resolve();
      document.head.append(link);
    });
    loaded.set(name, p);
  }
  return p;
}

export function isFontReady(name: string): boolean {
  const fam = FONT_FAMILIES.find((f) => f.name === name);
  if (!fam?.google) return true;
  return document.fonts.check(`64px "${name}"`);
}
