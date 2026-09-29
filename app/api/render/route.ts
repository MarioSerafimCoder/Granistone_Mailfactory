import { renderEmail } from '@/export/render';
import { isCampaign, isBrand } from '@/lib/storage';
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 8_000_000)
      return Response.json(
        { error: 'Conteúdo muito grande. Use URLs para as imagens.' },
        { status: 413 },
      );
    const { campaign, language, brand } = JSON.parse(raw);
    if (!isCampaign(campaign) || !isBrand(brand) || !['pt', 'en'].includes(language))
      return Response.json({ error: 'Campanha inválida.' }, { status: 400 });
    const [html, editorHtml] = await Promise.all([
      renderEmail(campaign, language, brand),
      renderEmail(campaign, language, brand, true),
    ]);
    return Response.json({ html, editorHtml });
  } catch {
    return Response.json(
      { error: 'Não foi possível gerar o preview. Revise os dados da campanha.' },
      { status: 400 },
    );
  }
}
