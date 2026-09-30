import type { BrandSettings, Language } from '@/types/campaign';
import { emailTokens as t } from '@/lib/tokens/email';
import { escapeHtml as e, safeUrl } from '@/lib/safety';
import { GRANISTONE_UNSUBSCRIBE_URL } from '@/data/granistone.config';
export function assetUrl(brand: BrandSettings, file: string) {
  return brand.assetBaseUrl
    ? `${brand.assetBaseUrl.replace(/\/$/, '')}/brand/${file}`
    : `/brand/${file}`;
}
export function GranistoneHeader(brand: BrandSettings) {
  return `<tr><td align="center" style="padding:38px ${t.sectionPaddingDesktop}px 34px"><img src="${e(safeUrl(brand.logoUrl || assetUrl(brand, 'granistone-logo.png'), true))}" alt="${e(brand.brandName)}" width="${t.logoWidth}" style="display:block;width:${t.logoWidth}px;max-width:100%;height:auto;border:0"/><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="22" style="height:22px;line-height:22px">&#8202;</td></tr><tr><td height="1" bgcolor="${t.border}" style="height:1px;line-height:1px;font-size:1px">&#8202;</td></tr></table></td></tr>`;
}
export function GranistoneFooter(brand: BrandSettings, lang: Language) {
  const en = lang === 'en';
  const es = lang === 'es';
  const social = [
    ['facebook', 'Facebook', brand.facebook],
    ['instagram', 'Instagram', brand.instagram],
    ['link', 'Site', brand.website],
    ['whatsapp', 'WhatsApp', brand.whatsapp],
  ];
  const icons = social
    .map(([file, label, url]) => {
      const img = `<img width="26" height="26" src="${e(assetUrl(brand, `${file}.png`))}" alt="${label}" style="display:block;border:0"/>`;
      return `<td style="padding:0 9px">${safeUrl(url) ? `<a href="${e(safeUrl(url))}">${img}</a>` : img}</td>`;
    })
    .join('');
  const email = safeUrl(brand.email ? `mailto:${brand.email}` : '');
  const phone = safeUrl(brand.phone ? `tel:${brand.phone.replace(/[^+\d]/g, '')}` : '');
  const unsubscribe = `<br/>${en ? 'If you no longer wish to receive these emails,' : es ? 'Si ya no desea recibir estos correos,' : 'Caso não queira mais receber estes e-mails,'} <a href="${e(GRANISTONE_UNSUBSCRIBE_URL)}" style="color:${t.colors.text};text-decoration:underline">${en ? 'unsubscribe.' : es ? 'cancele su suscripción.' : 'cancele sua inscrição.'}</a>`;
  return `<tr><td align="center" bgcolor="${t.colors.footer}" style="padding:28px 28px 32px;color:${t.colors.text};font-family:${t.typography.body};text-align:center">
    <p style="font-size:13px;line-height:1.4;margin:0 auto 24px;max-width:420px">${en ? 'Thank you for your presence and your trust in being part of our story.' : es ? 'Gracias por su presencia y por la confianza en formar parte de nuestra historia.' : 'Agradecemos pela sua presença e pela confiança em fazer parte da nossa história.'}</p>
    <table align="center" role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px"><tr>${icons}</tr></table>
    <p style="font-size:11px;line-height:1.5;margin:0;color:${t.colors.gray}">${en ? 'Sent by' : es ? 'Enviado por' : 'Enviado por'} ${e(brand.brandName)}<br/>${e(brand.address)}${phone ? `<br/><a href="${e(phone)}" style="color:${t.colors.text}">${e(brand.phone)}</a>` : ''}${email ? ` · <a href="${e(email)}" style="color:${t.colors.text}">${e(brand.email)}</a>` : ''}${unsubscribe}</p>
  </td></tr>`;
}
