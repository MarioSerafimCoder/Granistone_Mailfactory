import type { Metadata } from 'next';
import '@maily-to/core/style.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Granistone Mail Studio',
  description: 'Do planejamento de CRM a e-mails consistentes com a marca Granistone.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
