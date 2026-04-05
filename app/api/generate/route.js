import axios from 'axios';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChapterContent(url) {
  const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(html);

  let content = '';

  // Try multiple selectors for chapter content
  const selectors = [
    '.chapter-content',
    '.chapter-inner.chapter-content',
    '#chapter-content',
    '.entry-content',
    '.prose',
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      // Remove author notes, ads, navigation etc
      el.find('.portlet, .nav-buttons, .advertisement, script, style, .author-note, .authors-note').remove();
      content = el.html();
      break;
    }
  }

  // Fallback: look for the largest text block
  if (!content) {
    let maxLen = 0;
    $('div').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > maxLen && text.length > 500) {
        maxLen = text.length;
        content = $(el).html();
      }
    });
  }

  return content || '<p>Chapter content could not be extracted.</p>';
}

export async function POST(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const body = await request.json();
        const { chapters, title, author, coverUrl } = body;

        if (!chapters || !chapters.length) {
          sendEvent({ type: 'error', message: 'No chapters provided' });
          controller.close();
          return;
        }

        sendEvent({ type: 'start', total: chapters.length, title });

        // Fetch each chapter content
        const epubContent = [];

        for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          sendEvent({
            type: 'progress',
            current: i + 1,
            total: chapters.length,
            chapterTitle: chapter.title,
          });

          try {
            const content = await fetchChapterContent(chapter.url);
            epubContent.push({
              title: chapter.title,
              content: content,
            });
          } catch (err) {
            console.error(`Failed to fetch chapter ${i + 1}: ${err.message}`);
            epubContent.push({
              title: chapter.title,
              content: `<p><em>Failed to load this chapter: ${err.message}</em></p>`,
            });
          }

          // Rate limiting - 500ms delay between requests
          if (i < chapters.length - 1) {
            await sleep(500);
          }
        }

        sendEvent({ type: 'generating', message: 'Generating EPUB file...' });

        // Generate EPUB in memory using epub-gen-memory
        const epubGenMemory = (await import('epub-gen-memory')).default;

        const epubOptions = {
          title: title,
          author: author || 'Unknown',
          publisher: 'Royal Road',
          description: `Downloaded from Royal Road - ${title}`,
        };

        // Add cover if available
        if (coverUrl) {
          epubOptions.cover = coverUrl;
        }

        const epubBuffer = await epubGenMemory(epubOptions, epubContent);

        // Convert Buffer to base64
        const base64 = Buffer.from(epubBuffer).toString('base64');
        const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

        sendEvent({
          type: 'complete',
          filename: `${safeTitle}.epub`,
          data: base64,
          size: epubBuffer.length,
        });

      } catch (error) {
        console.error('EPUB generation error:', error);
        sendEvent({ type: 'error', message: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
