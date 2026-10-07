import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Iron Tide — Multiplayer Battleship',
  openGraph: { title: 'Iron Tide — Rule the sea', description: 'Hidden fleets. Direct hits. Play solo, duel a friend, or join a four-player naval battle.', images: [{ url: '/iron-tide-share.png', width: 1200, height: 630, alt: 'Iron Tide — Rule the sea. Solo, duel, and team naval battles.' }], type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Iron Tide — Rule the sea', images: ['/iron-tide-share.png'] },
  icons: { icon: '/favicon.svg' },
  description: 'A game of hidden fleets and calculated shots. Play solo, challenge friends, or battle in teams from any device.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
