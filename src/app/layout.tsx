import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppShell } from '@/components/layout/AppShell';
import { MockApiProvider } from '@/server/MockApiProvider';
import { ThemeRegistry } from '@/theme/ThemeRegistry';
import './globals.css';

const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK'],
});

const body = Inter({
  variable: '--font-body',
  subsets: ['latin'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Alo Relief Trust — Document Console',
  description: 'Upload, process and review the Alo Relief Trust document archive.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <ThemeRegistry>
          <AppShell>
            <MockApiProvider>{children}</MockApiProvider>
          </AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
