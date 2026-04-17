import { Montserrat, Great_Vibes } from 'next/font/google';
import StoreProvider from '@/store/StoreProvider';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-script',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Cake Bake — Freshly Baked, Delivered with Love',
    template: '%s | Cake Bake',
  },
  description:
    'Premium cakes delivered fresh to your doorstep in Amritsar. Birthday cakes, wedding cakes, custom designs, eggless options & more. Order online today!',
  keywords: [
    'cake delivery',
    'birthday cake',
    'wedding cake',
    'custom cake',
    'eggless cake',
    'Amritsar bakery',
    'online cake order',
    'Cake Bake',
  ],
  openGraph: {
    title: 'Cake Bake — Freshly Baked, Delivered with Love',
    description:
      'Premium cakes delivered fresh to your doorstep. Birthday, wedding, custom designs & more.',
    url: 'https://cakebake.in',
    siteName: 'Cake Bake',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cake Bake — Freshly Baked, Delivered with Love',
    description:
      'Premium cakes delivered fresh to your doorstep. Order online today!',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${greatVibes.variable}`}
    >
      <body className="min-h-screen flex flex-col font-montserrat antialiased">
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
