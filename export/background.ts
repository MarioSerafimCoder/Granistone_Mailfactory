import type { Background } from '@/types/design';
import { resolveBackground, colorValid, backgroundColors } from '@/lib/tokens/backgrounds';
import { escapeHtml as e, safeUrl } from '@/lib/safety';
export function backgroundAttributes(input: Background): string {
  const b = resolveBackground(input);
  const fallback = b.kind === 'solid' ? b.color : b.fallback;
  const color = colorValid(fallback) ? fallback : backgroundColors.white;
  let style = `background-color:${color};`, attribute = '';
  if (b.kind === 'gradient') style += `background-image:linear-gradient(${{ vertical: 180, horizontal: 90, diagonal: 135 }[b.direction]}deg,${b.start},${b.end});`;
  if (b.kind === 'image' && safeUrl(b.image, true)) {
    // Encode CSS delimiters as URL bytes before HTML escaping; never accept arbitrary CSS.
    const url = safeUrl(b.image, true).replace(/[\\'"()<>\s]/g, char => encodeURIComponent(char).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29'));
    attribute = ` background="${e(url)}"`;
    const overlay = b.overlay ? `linear-gradient(rgba(0,0,0,${b.overlay}),rgba(0,0,0,${b.overlay})),` : '';
    style += `background-image:${overlay}url('${url}');background-size:${b.size};background-position:center ${b.position};background-repeat:no-repeat;`;
  }
  return `bgcolor="${color}"${attribute} style="${e(style)}"`;
}
