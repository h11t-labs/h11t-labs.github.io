import type { APIContext } from 'astro';
import { getArticlePairs } from '../lib/articles';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(context: APIContext) {
  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://h11t-labs.nl';
  const articles = await getArticlePairs();

  const items = articles
    .map(
      (a) => `    <item>
      <title>${esc(a.en.data.title)}</title>
      <link>${site}/writing/${a.slug}</link>
      <guid>${site}/writing/${a.slug}</guid>
      <pubDate>${a.en.data.pubDate.toUTCString()}</pubDate>
      <description>${esc(a.en.data.description)}</description>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>h11t labs</title>
    <link>${site}</link>
    <description>Notes from the h11t labs workbench.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
