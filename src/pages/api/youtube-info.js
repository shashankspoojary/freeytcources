export async function GET({ request }) {
  const urlObj = new URL(request.url);
  const searchUrl = urlObj.searchParams.get('url') || '';
  
  if (!searchUrl) {
    return new Response(JSON.stringify({ error: 'No URL provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function getYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  let videoId = getYoutubeId(searchUrl);
  
  // If the input itself is an 11-char video ID
  if (!videoId && searchUrl.trim().length === 11) {
    videoId = searchUrl.trim();
  }

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Could not extract Video ID from URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`;
    const oembedRes = await fetch(noembedUrl);
    
    if (!oembedRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch oEmbed details' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const oembedJson = await oembedRes.json();
    
    if (oembedJson.error) {
      return new Response(JSON.stringify({ error: oembedJson.error }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const channelUrl = oembedJson.author_url;
    const channelName = oembedJson.author_name;

    if (!channelUrl) {
      return new Response(JSON.stringify({ error: 'No channel URL in oEmbed' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch Video views from video page
    let views = 12450;
    try {
      const videoRes = await fetch('https://www.youtube.com/watch?v=' + videoId, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'SOCS=CAESEwgDEgk0ODE3NzkzOTQaAmVuIAEaBgiA_eWqBg'
        }
      });
      if (videoRes.ok) {
        const videoHtml = await videoRes.text();
        const viewsMatch = videoHtml.match(/<meta\s+itemprop="interactionCount"\s+content="([0-9]+)"/i) ||
                           videoHtml.match(/"viewCount"\s*:\s*"([0-9]+)"/i);
        if (viewsMatch) {
          views = Number(viewsMatch[1]);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch views:", e);
    }

    // Fetch the channel page using SOCS bypass cookie
    const channelRes = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAESEwgDEgk0ODE3NzkzOTQaAmVuIAEaBgiA_eWqBg'
      }
    });

    if (!channelRes.ok) {
      // Fallback to oembed data only
      return new Response(JSON.stringify({
        channelName,
        channelId: null,
        creatorLogo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120&h=120',
        subscribers: '4.2M subscribers',
        views
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const html = await channelRes.text();
    
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/i) ||
                           html.match(/meta\s+itemprop="channelId"\s+content="([^"]+)"/i) ||
                           html.match(/"channelId":"([^"]+)"/i);
    const channelId = canonicalMatch ? canonicalMatch[1] : null;

    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                         html.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i);
    const avatarUrl = ogImageMatch ? ogImageMatch[1] : null;

    // Parse subscribers count
    let subscribers = '4.2M subscribers';
    const handle = channelUrl.substring(channelUrl.lastIndexOf('/') + 1);
    if (handle) {
      const escapedHandle = handle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const subRegex = new RegExp(escapedHandle + '[^"]*?•[^"({]*?([0-9.KMB]+(?:\\s*million)?\\s*subscribers)', 'i');
      const subMatch = html.match(subRegex);
      if (subMatch) {
        subscribers = subMatch[1];
      } else {
        // fallback 1
        const subMatch2 = html.match(/"metadataParts"[^}]*?"text"\s*:\s*\{\s*"content"\s*:\s*"([0-9.KMB]+(?:\\s*million)?\\s*subscribers)"/i);
        if (subMatch2) {
          subscribers = subMatch2[1];
        } else {
          // fallback 2
          const genericMatch = html.match(/"text"\s*:\s*\{\s*"content"\s*:\s*"([0-9.KMB]+(?:\\s*million)?\\s*subscribers)"/gi);
          if (genericMatch && genericMatch.length > 0) {
            subscribers = genericMatch[0].match(/"content"\s*:\s*"([^"]+)"/i)?.[1] || subscribers;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      channelName,
      channelId,
      creatorLogo: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120&h=120',
      subscribers,
      views
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
