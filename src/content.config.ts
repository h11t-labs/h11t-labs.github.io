import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Articles: markdown under src/content/articles/. Each article has an English and
// a Dutch file that share a `slug` (the URL) and differ by `lang`; they're paired
// in src/lib/articles.ts so one URL can render either language via the toggle.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // groups the language variants of one article (also its URL). NOT named
    // `slug`: the glob loader treats a `slug` field as the entry id, which would
    // collide the en/nl files into one entry.
    key: z.string(),
    lang: z.enum(['en', 'nl']).default('en'),
    // estimated read time in minutes
    readMin: z.number().default(5),
    // slug of the related project (see src/data/projects.ts)
    project: z.string().optional(),
    // canonical GitHub URL for the article's subject
    repo: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
