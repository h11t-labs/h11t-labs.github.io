import { getCollection, type CollectionEntry } from 'astro:content';

// Each article is authored twice — an `lang: en` file and a `lang: nl` file that
// share the same `slug`. We pair them by slug so the same URL renders either
// language via the on-page toggle (no separate /nl/ URLs).
export type ArticlePair = {
  slug: string;
  en: CollectionEntry<'articles'>;
  nl: CollectionEntry<'articles'> | null;
};

export async function getArticlePairs(): Promise<ArticlePair[]> {
  const all = await getCollection('articles');
  const bySlug = new Map<string, ArticlePair>();
  for (const entry of all) {
    if (entry.data.draft) continue;
    const slug = entry.data.key;
    const pair = bySlug.get(slug) ?? { slug, en: undefined as any, nl: null };
    if (entry.data.lang === 'nl') pair.nl = entry;
    else pair.en = entry;
    bySlug.set(slug, pair);
  }
  return [...bySlug.values()]
    .filter((p) => p.en) // an English version is required
    .sort((a, b) => b.en.data.pubDate.getTime() - a.en.data.pubDate.getTime());
}
