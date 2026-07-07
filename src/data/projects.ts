// Projects shown in the "work" index. Shaped to match the design's work-item
// row: number · title · year · description · tags · buttons.

export interface Project {
  slug: string;
  name: string;
  year: string;
  description: string;    // English
  descriptionNl: string;  // Dutch
  tags: string[];
  repo?: string;          // GitHub URL — GitHub button shows when set
  url?: string;           // the project itself (live site / demo / docs), if any
  article?: string;       // related article slug under src/content/articles
}

export const projects: Project[] = [
  {
    slug: 'online-bibliotheek-catalogus',
    name: 'online-bibliotheek-catalogus',
    year: '2026',
    description:
      "The official onlinebibliotheek.nl search drove me up the wall, so I scraped the whole catalog into SQLite + FTS5 and gave it the fast, faceted search it deserved. Enumerate, parse, normalize with an atomic rebuild, rank with bm25.",
    descriptionNl:
      "De officiële zoekfunctie van onlinebibliotheek.nl dreef me tot wanhoop, dus schraapte ik de hele catalogus naar SQLite + FTS5 en gaf 'm de snelle, gefacetteerde zoekfunctie die-ie verdient. Enumereren, parsen, normaliseren met een atomische rebuild, ranken met bm25.",
    tags: ['python', 'fastapi', 'sqlite', 'fts5'],
    repo: 'https://github.com/h11t-labs/online-bibliotheek-catalogus',
    article: 'online-bibliotheek-catalogus',
  },
  {
    slug: 'firm',
    name: 'firm',
    year: '2026',
    description:
      "I wanted Rails 8's Solid stack in Python, so I built it. Background jobs, caching, pub/sub, and an append-only audit log that all live in the SQL database you already run — no Redis. Four independent modules; SQLite, PostgreSQL, and MySQL.",
    descriptionNl:
      "Ik wilde de Solid-stack van Rails 8 in Python, dus bouwde ik 'm. Achtergrondtaken, caching, pub/sub en een append-only auditlog die allemaal in de SQL-database draaien die je toch al hebt — geen Redis. Vier onafhankelijke modules; SQLite, PostgreSQL en MySQL.",
    tags: ['python', 'postgres', 'sqlite', 'mysql'],
    repo: 'https://github.com/h11t-labs/firm',
    article: 'firm',
  },
];
