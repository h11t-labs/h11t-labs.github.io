import type { APIContext } from 'astro';
import { getArticlePairs } from '../lib/articles';
import { projects } from '../data/projects';

// /llms.txt — the llmstxt.org convention: a concise, machine-readable index of
// the site so language models can find and read everything without scraping.
export async function GET(ctx: APIContext) {
  const site = ctx.site?.toString().replace(/\/$/, '') ?? 'https://h11t-labs.nl';
  const articles = await getArticlePairs();
  const L: string[] = [];

  L.push('# h11t labs');
  L.push('');
  L.push(
    "> h11t labs is where one developer hosts and shows their personal projects — mostly Python (data & scraping, homelab/automation, dev tooling), from one-file scrapers to a full background-jobs stack. Some are open source, some private. Pages are bilingual (English/Dutch); this index is in English."
  );
  L.push('');

  L.push('## Projects');
  for (const p of projects) {
    const url = p.article ? `${site}/writing/${p.article}` : p.url ?? p.repo ?? site;
    const repo = p.repo ? ` (repo: ${p.repo})` : '';
    L.push(`- [${p.name}](${url}): ${p.description}${repo}`);
  }
  L.push('');

  L.push('## Writing');
  for (const a of articles) {
    L.push(`- [${a.en.data.title}](${site}/writing/${a.slug}): ${a.en.data.description} (${a.en.data.readMin} min)`);
  }
  L.push('');

  L.push('## Pages');
  L.push(`- [Home](${site}/)`);
  L.push(`- [Work](${site}/work): all projects`);
  L.push(`- [Writing](${site}/writing): all articles`);
  L.push(`- [About](${site}/about)`);
  L.push('');

  L.push('## Full text');
  L.push(`- [llms-full.txt](${site}/llms-full.txt): every project blurb and the full text of every article (English + Dutch) in one file`);
  L.push('');

  return new Response(L.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
