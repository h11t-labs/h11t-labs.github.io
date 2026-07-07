import type { APIContext } from 'astro';
import { getArticlePairs } from '../lib/articles';
import { projects } from '../data/projects';

// /llms-full.txt — the whole site as one clean plain-text/markdown document, so
// an LLM can read every article and project in a single fetch. Article bodies
// come straight from the markdown source, so this stays in sync automatically.
export async function GET(ctx: APIContext) {
  const site = ctx.site?.toString().replace(/\/$/, '') ?? 'https://h11t-labs.nl';
  const articles = await getArticlePairs();
  const O: string[] = [];

  O.push('# h11t labs — full text');
  O.push('');
  O.push(
    "h11t labs is where one developer hosts and shows their personal projects. Mostly Python: data & scraping, homelab/automation, and developer tooling. Plain, legible tools — from a one-file scraper to a full background-jobs stack, some open source, some private. The website is bilingual (English and Dutch); article text below is included in both languages."
  );
  O.push('');
  O.push('---');
  O.push('');

  O.push('## Projects');
  O.push('');
  for (const p of projects) {
    O.push(`### ${p.name}`);
    O.push('');
    O.push(p.description);
    O.push('');
    O.push(`- Tech: ${p.tags.join(', ')}`);
    if (p.repo) O.push(`- Repository: ${p.repo}`);
    if (p.article) O.push(`- Write-up: ${site}/writing/${p.article}`);
    O.push('');
  }

  O.push('---');
  O.push('');
  O.push('## Articles');
  O.push('');

  for (const a of articles) {
    const date = a.en.data.pubDate.toISOString().slice(0, 10);
    O.push(`### ${a.en.data.title}`);
    O.push(`${site}/writing/${a.slug} — ${a.en.data.readMin} min — ${date}`);
    O.push('');
    O.push((a.en.body ?? '').trim());
    O.push('');
    if (a.nl) {
      O.push(`### ${a.nl.data.title} (Nederlands)`);
      O.push('');
      O.push((a.nl.body ?? '').trim());
      O.push('');
    }
    O.push('---');
    O.push('');
  }

  return new Response(O.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
