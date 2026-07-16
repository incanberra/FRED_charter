import { brand } from '../brand';
import { todayStamp } from './dates';

export interface ExportOptions {
  svg: SVGSVGElement;
  title: string;
  width: number;
  height: number;
  scale: number;
  quality: number;
}

export async function exportSvgToJpg(options: ExportOptions): Promise<void> {
  const { svg, title, width, height, scale, quality } = options;
  await document.fonts.ready;

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('width', String(width));
  clonedSvg.setAttribute('height', String(height));
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const css = collectApplicableStyles();
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  clonedSvg.prepend(style);

  const serialized = new XMLSerializer().serializeToString(clonedSvg);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');

    context.fillStyle = brand.colors.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const jpg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (output) => (output ? resolve(output) : reject(new Error('JPG export failed.'))),
        'image/jpeg',
        quality,
      );
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(jpg);
    link.download = `${slugify(title || 'fred-chart')}-${todayStamp()}.jpg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The chart SVG could not be rasterised.'));
    image.src = url;
  });
}

function collectApplicableStyles(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) rules.push(rule.cssText);
    } catch {
      // Cross-origin stylesheets cannot be read. The chart uses local styles/tokens.
    }
  }
  return rules.join('\n');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
