import type { Metadata } from 'next';
import '@maily-to/core/style.css';
import './globals.css';
import './collaboration.css';
import './theme.css';
export const metadata: Metadata = {
  title: 'Granistone Mail Studio',
  description: 'Do planejamento de CRM a e-mails consistentes com a marca Granistone.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{const saved=localStorage.getItem('granistone-ui-theme');document.documentElement.dataset.theme=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}" }} /></head>
      <body>{children}</body>
    </html>
  );
}
