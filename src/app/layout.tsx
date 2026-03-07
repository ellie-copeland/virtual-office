import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Virtual Office',
  description: 'Gather Town-style virtual office',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
