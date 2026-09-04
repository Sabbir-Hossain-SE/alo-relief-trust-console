import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppShell } from '@/components/layout/AppShell';
import { InitNavScript } from '@/components/layout/InitNavScript';
import { MockApiGate, MockApiProvider } from '@/server/MockApiProvider';
import { StoreProvider } from '@/store/StoreProvider';
import { ThemeRegistry } from '@/theme/ThemeRegistry';
import './globals.css';

// The wordmark's face and nothing else's. Without the optical axes nothing
// here ever varies, and unpreloaded it no longer competes with the body text
// for the first bytes of every route — a logo may swap in a moment late.
const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  preload: false,
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
        <InitNavScript />
        <ThemeRegistry>
          <StoreProvider>
            <MockApiProvider>
              <AppShell>
                <MockApiGate>{children}</MockApiGate>
              </AppShell>
            </MockApiProvider>
          </StoreProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
