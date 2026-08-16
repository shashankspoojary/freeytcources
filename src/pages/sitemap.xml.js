import { db } from "../lib/firebase.js";
import { collection, getDocs, query } from "firebase/firestore";

export async function GET() {
  const baseUrl = "https://freeytcourses.com";
  let courses = [];
  
  if (db) {
    try {
      const q = query(collection(db, "courses"));
      const snapshot = await getDocs(q);
      courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Error fetching courses for sitemap:", e);
    }
  }

  const staticPages = [
    "",
    "/courses",
    "/submit-course"
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  staticPages.forEach(page => {
    xml += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${page === "" ? "1.0" : "0.8"}</priority>\n  </url>\n`;
  });

  courses.forEach(course => {
    if (course.slug) {
      // Exclude courses that might be in a draft/pending state if you wish, 
      // but assuming all live courses in the DB should be indexed:
      xml += `  <url>\n    <loc>${baseUrl}/courses/${course.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
  });

  xml += `</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
