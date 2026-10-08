import type { TemplateId } from '@/types/campaign';

export type TemplatePalette = {
  primary: string; secondary: string; accent: string; surface: string;
  surfaceAlt: string; text: string; textInverse: string; border: string;
};

/** Initial values only. Campaigns own their copied design and section colors thereafter. */
export const templatePalettes: Record<Extract<TemplateId, 'promo-impact' | 'catalog-color' | 'editorial-organic' | 'brand-story'>, TemplatePalette> = {
  'promo-impact': {
    primary: '#641F2C', secondary: '#40151D', accent: '#F1E8D8', surface: '#FCFAF6',
    surfaceAlt: '#F1E8D8', text: '#151313', textInverse: '#FCFAF6', border: '#641F2C',
  },
  'catalog-color': {
    primary: '#397F78', secondary: '#174F50', accent: '#69AFA7', surface: '#F6F3EA',
    surfaceAlt: '#DCE9E4', text: '#1B2221', textInverse: '#FFFFFF', border: '#397F78',
  },
  'editorial-organic': {
    primary: '#9D654B', secondary: '#707159', accent: '#B98768', surface: '#F2ECE2',
    surfaceAlt: '#D7C3A5', text: '#292521', textInverse: '#FFFFFF', border: '#707159',
  },
  'brand-story': {
    primary: '#0D0D0D', secondary: '#242321', accent: '#B89A60', surface: '#F4F0E8',
    surfaceAlt: '#DDD0B5', text: '#0D0D0D', textInverse: '#F4F0E8', border: '#B89A60',
  },
};
