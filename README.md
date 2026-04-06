# Royal Road to EPUB 📖

A modern Next.js application that scrapes fictions from Royal Road and compiles them into beautifully formatted EPUB files for offline reading.

## Features

- **Link Scraping**: Paste a link to any Royal Road fiction to extract its title, author, description, and chapter list.
- **Selective Downloads**: Choose exactly which chapters you want to download.
- **Real-Time Progress**: Watch the download progress in real-time as each chapter is fetched and processed.
- **In-Memory Generation**: Bypasses local file system permission issues by securely building the EPUB file directly in volatile memory. 
- **Premium User Interface**: Dark theme aesthetics featuring glassmorphic designs, gold accents, and subtle background animations.
- **Dual Extraction Modes**:
  - *Standard*: Lightning-fast extraction utilizing raw HTTP requests.
  - *Browser/Accurate*: Employs a headless browser to render the page, accurately filter out hidden anti-piracy HTML text, and trigger JavaScript trackers to ensure the author properly receives their chapter reading views! 
- **Ethical Scraping**: Includes a 500ms request delay mechanism to avoid rate-limiting or abusing Royal Road's servers.

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI/UX**: Custom CSS (Dark Theme + CSS grid/flexbox + CSS Animations)
- **Scraping logic**: [Axios](https://axios-http.com/), [Cheerio](https://cheerio.js.org/), & [Puppeteer](https://pptr.dev/)
- **EPUB Generation**: [epub-gen-memory](https://www.npmjs.com/package/epub-gen-memory)

## Getting Started

First, make sure you have Node.js installed, then install the dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How it works

1. The frontend (`app/page.js`) receives a Royal Road string URL.
2. It hits the `/api/scrape` endpoint which makes a server-side request using Axios.
3. Cheerio parses the DOM to extract the `h1` titles, metadata, and `.chapter-content` links.
4. The user selects the chapters and hits Generate EPUB.
5. A connection is established to `/api/generate` via Server-Sent Events (SSE). It iterates through the chapter list, sequentially fetching each chunk of chapter prose.
6. Progress events are piped continuously to the browser.
7. Upon completion, `epub-gen-memory` compiles the buffer and pipes a `.epub` back down to the user via a Base64 string payload!

## Disclaimer

This tool is strictly for personal, offline reading. Please respect author rights and Royal Road's terms of service.
