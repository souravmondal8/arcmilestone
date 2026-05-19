import './globals.css';

export const metadata = {
  title: 'ArcMilestone Protocol',
  description: 'Secure Milestone Escrow Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
