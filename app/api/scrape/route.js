import axios from 'axios';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function extractFictionId(url) {
  const match = url.match(/royalroad\.com\/fiction\/(\d+)/);
  return match ? match[1] : null;
}

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('royalroad.com/fiction/')) {
      return Response.json(
        { error: 'Invalid Royal Road URL. Please provide a URL like: https://www.royalroad.com/fiction/21220/mother-of-learning' },
        { status: 400 }
      );
    }

    const fictionId = extractFictionId(url);
    if (!fictionId) {
      return Response.json(
        { error: 'Could not extract fiction ID from URL.' },
        { status: 400 }
      );
    }

    // Normalize URL to just the fiction page
    const fictionUrl = url.split('/chapter/')[0].split('?')[0];

    const { data: html } = await axios.get(fictionUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(html);

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().replace(' | Royal Road', '').trim();

    // Extract author
    const authorLink = $('a[href*="/profile/"]').first();
    const author = authorLink.text().trim() || 'Unknown Author';

    // Extract description
    const description = $('.description .hidden-content').text().trim()
      || $('meta[property="og:description"]').attr('content')
      || '';

    // Extract cover image
    const coverImg = $('img.thumbnail').attr('src')
      || $('meta[property="og:image"]').attr('content')
      || '';

    // Extract chapter list
    const chapters = [];
    $('table#chapters tbody tr, #chapters a, table tbody tr a[href*="/chapter/"]').each((i, el) => {
      // Try to find anchor tags with chapter links
      const anchor = $(el).is('a') ? $(el) : $(el).find('a[href*="/chapter/"]').first();
      if (anchor.length > 0) {
        const href = anchor.attr('href');
        if (href && href.includes('/chapter/')) {
          const chapterTitle = anchor.text().trim();
          const fullUrl = href.startsWith('http') ? href : `https://www.royalroad.com${href}`;

          // Avoid duplicates
          if (!chapters.find(c => c.url === fullUrl) && chapterTitle) {
            chapters.push({
              title: chapterTitle,
              url: fullUrl,
            });
          }
        }
      }
    });

    // Fallback: scan all anchors for chapter links
    if (chapters.length === 0) {
      $(`a[href*="/fiction/${fictionId}/"][href*="/chapter/"]`).each((i, el) => {
        const href = $(el).attr('href');
        const chapterTitle = $(el).text().trim();
        const fullUrl = href.startsWith('http') ? href : `https://www.royalroad.com${href}`;
        if (!chapters.find(c => c.url === fullUrl) && chapterTitle) {
          chapters.push({ title: chapterTitle, url: fullUrl });
        }
      });
    }

    return Response.json({
      title,
      author,
      description: description.slice(0, 500),
      coverUrl: coverImg,
      chapters,
      fictionId,
    });
  } catch (error) {
    console.error('Scrape error:', error.message);
    return Response.json(
      { error: `Failed to fetch fiction data: ${error.message}` },
      { status: 500 }
    );
  }
}
