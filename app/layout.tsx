import './src/app/globals.css';

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
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0B0F19' }}>
        {children}
      </body>
    </html>
  );
}
