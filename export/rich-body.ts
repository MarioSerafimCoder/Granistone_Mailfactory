import { renderAsync } from '@react-email/render';
import { createElement, Fragment } from 'react';
import { Maily } from '@maily-to/render';
import { sanitizeRichText } from '@/lib/safety';
import type { RichNode } from '@/types/campaign';
import { emailTokens as t } from '@/lib/tokens/email';
export async function renderRichBody(body: RichNode, color: string = t.colors.text) {
  const renderer = new Maily(sanitizeRichText(body));
  renderer.setTheme({ colors: { paragraph: color }, fontSize: { paragraph: `${t.body}px` } });
  return (await renderAsync(createElement(Fragment, null, ...renderer.children()))).replace(/<!DOCTYPE[^>]*>/gi, '');
}
