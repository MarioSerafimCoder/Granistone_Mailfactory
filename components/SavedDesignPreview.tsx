import type { SavedDesign } from '@/types/design';
import { blockRegistry } from '@/blocks/registry';
import { backgroundColors, resolveBackground } from '@/lib/tokens/backgrounds';
import { safeUrl } from '@/lib/safety';
export default function SavedDesignPreview({ design }: { design: SavedDesign }) {
  const section = design.kind === 'block' ? design.payload : design.payload.sections.find(section => section.enabled && !['divider', 'spacer'].includes(section.type));
  const content = section?.content.pt;
  const url = content?.image || content?.image2 || '';
  const image = safeUrl(url, true);
  const background = resolveBackground(design.kind === 'template' ? design.payload.design.content : design.payload.settings.background);
  const color = background.kind === 'none' ? backgroundColors.white : background.kind === 'solid' ? background.color : background.fallback;
  const textColor = design.kind === 'template' ? design.payload.design.textColor : design.payload.settings.textColor;
  return <div className="saved-design-preview" aria-hidden="true" style={{ backgroundColor: color, color: textColor }}>
    <div className="saved-design-preview-paper">
      <span className="saved-design-preview-overline">GRANISTONE</span>
      {image ? <img src={image} alt="" loading="lazy" /> : <span className="saved-design-preview-image" />}
      <strong>{content?.title?.replace(/^\[|\]$/g, '') || blockRegistry[section?.type ?? 'centeredText'].name}</strong>
      <span className="saved-design-preview-line" /><span className="saved-design-preview-line short" />
    </div>
  </div>;
}
