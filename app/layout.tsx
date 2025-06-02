// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ContextProvider from '@/context';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DAO App',
  description: 'Powered by Catcents and Monad',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const cookies = headersList.get('cookie');

  return (
    <html lang="en">
      <body className={inter.className}>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  );
}