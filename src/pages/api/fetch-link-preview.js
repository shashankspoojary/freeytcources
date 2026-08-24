export async function POST({ request }) {
  try {
    const { url } = await request.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch URL' }), { status: 500 });
    }

    const html = await res.text();
    let image = null;

    // Look for og:image
    const ogImageMatch = html.match(/<meta\s+(?:[^>]*?\s+)?property="og:image"\s+content="([^"]+)"/i) || 
                         html.match(/<meta\s+(?:[^>]*?\s+)?content="([^"]+)"\s+property="og:image"/i);
    if (ogImageMatch) {
      image = ogImageMatch[1];
    } else {
      // Fallback to twitter:image
      const twImageMatch = html.match(/<meta\s+(?:[^>]*?\s+)?name="twitter:image"\s+content="([^"]+)"/i) || 
                           html.match(/<meta\s+(?:[^>]*?\s+)?content="([^"]+)"\s+name="twitter:image"/i);
      if (twImageMatch) {
        image = twImageMatch[1];
      }
    }

    // Default placeholder if none found
    if (!image) {
      image = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    }

    // Ensure image url is absolute if it's relative
    if (image && image.startsWith('/')) {
        try {
            const urlObj = new URL(url);
            image = `${urlObj.protocol}//${urlObj.host}${image}`;
        } catch(e) {}
    }

    return new Response(JSON.stringify({ image }), { status: 200 });

  } catch (err) {
    console.error("Error fetching link preview:", err);
    // Fallback to placeholder on error
    return new Response(JSON.stringify({ 
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    }), { status: 200 });
  }
}
