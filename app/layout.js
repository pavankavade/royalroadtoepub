import "./globals.css";

export const metadata = {
  title: "Royal Road to EPUB — Download Fiction as EPUB",
  description: "Convert Royal Road web novels to beautifully formatted EPUB files for offline reading. Paste a link, select chapters, and download.",
  keywords: "Royal Road, EPUB, web novel, offline reading, fiction downloader",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
