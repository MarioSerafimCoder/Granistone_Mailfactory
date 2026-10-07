import type { Background, CampaignDesign } from '@/types/design';
export const backgroundColors = { white: '#FFFFFF', stone: '#F5F3EF', black: '#111111', beige: '#EAE6DF', mineral: '#E5E7E8', dark: '#252725', graphite: '#343434', sand: '#CFC3B3' };
export const backgroundPresets: Record<string, { name: string; background: Exclude<Background, { kind: 'preset' }>; textColor: string }> = {
  white: { name: 'Branco Editorial', background: { kind: 'solid', color: backgroundColors.white }, textColor: backgroundColors.black },
  stone: { name: 'Stone', background: { kind: 'solid', color: backgroundColors.stone }, textColor: backgroundColors.black },
  black: { name: 'Preto Premium', background: { kind: 'solid', color: backgroundColors.black }, textColor: backgroundColors.white },
  beige: { name: 'Bege Arquitetura', background: { kind: 'solid', color: backgroundColors.beige }, textColor: backgroundColors.black },
  mineral: { name: 'Cinza Mineral', background: { kind: 'solid', color: backgroundColors.mineral }, textColor: backgroundColors.black },
  dark: { name: 'Dark Stone', background: { kind: 'solid', color: backgroundColors.dark }, textColor: backgroundColors.white },
  graphite: { name: 'Gradiente Grafite', background: { kind: 'gradient', start: backgroundColors.black, end: backgroundColors.graphite, direction: 'vertical', fallback: backgroundColors.black }, textColor: backgroundColors.white },
  sand: { name: 'Gradiente Sand', background: { kind: 'gradient', start: backgroundColors.stone, end: backgroundColors.sand, direction: 'diagonal', fallback: backgroundColors.stone }, textColor: backgroundColors.black },
  material: { name: 'Imagem Material', background: { kind: 'image', image: '', size: 'cover', position: 'center', fallback: backgroundColors.stone, overlay: 0 }, textColor: backgroundColors.black },
};
export const defaultDesign = (): CampaignDesign => ({ email: { kind: 'preset', preset: 'stone' }, content: { kind: 'preset', preset: 'white' }, textColor: backgroundColors.black });
export function resolveBackground(background: Background): Exclude<Background, { kind: 'preset' }> {
  return background.kind === 'preset' ? (backgroundPresets[background.preset] ?? backgroundPresets.white).background : background;
}
export const colorValid = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function backgroundValid(value: unknown): value is Background {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  if (b.kind === 'solid') return colorValid(b.color);
  if (b.kind === 'preset') return typeof b.preset === 'string' && Object.hasOwn(backgroundPresets, b.preset);
  if (!colorValid(b.fallback)) return false;
  if (b.kind === 'gradient') return colorValid(b.start) && colorValid(b.end) && ['vertical', 'horizontal', 'diagonal'].includes(String(b.direction));
  return b.kind === 'image' && typeof b.image === 'string' && b.image.length <= 2000000 && ['cover', 'contain'].includes(String(b.size)) && ['center', 'top', 'bottom'].includes(String(b.position)) && typeof b.overlay === 'number' && b.overlay >= 0 && b.overlay <= .8;
}
export function designValid(value: unknown): value is CampaignDesign {
  if (!value || typeof value !== 'object') return false;
  const d = value as CampaignDesign; return backgroundValid(d.email) && backgroundValid(d.content) && colorValid(d.textColor);
}
