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
      <body style={{ backgroundColor: '#0B0F19', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
