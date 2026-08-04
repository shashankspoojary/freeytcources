import { getAllCourses, getCreatorSlug } from '../lib/firebase.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  // Default to the request origin, or fallback if needed
  const site = url.origin || 'https://freeytcourses.com';

  const courses = await getAllCourses();

  // Core static routes
  const staticPages = [
    '',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/external',
    '/courses'
  ];

  // Dynamic course routes
  const courseSlugs = courses.map(c => `/courses/${c.slug}`);
  
  // Dynamic SEO landing pages
  const landingSlugs = courses.map(c => `/best-free-${c.slug}-course`);
  
  // Dynamic creator routes
  const creatorSlugs = Array.from(new Set(courses.map(c => getCreatorSlug(c.author || c.creatorName))));
  const creatorPages = creatorSlugs.filter(Boolean).map(slug => `/creators/${slug}`);

  const allPages = [
    ...staticPages,
    ...courseSlugs,
    ...landingSlugs,
    ...creatorPages
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${site}${page}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
