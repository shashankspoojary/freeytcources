export async function POST({ request }) {
  try {
    const body = await request.json();
    const url = body.url;

    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400 });
    }

    const YOUTUBE_API_KEY = import.meta.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY is not configured in .env' }), { status: 500 });
    }

    const isPlaylist = url.includes('list=');
    let playlistId = null;
    let videoId = null;

    if (isPlaylist) {
      const match = url.match(/[?&]list=([^&]+)/);
      if (match) playlistId = match[1];
    } else {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (match) videoId = match[1];
    }

    if (!playlistId && !videoId) {
      return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400 });
    }

    let courseTitle = '';
    let channelTitle = '';
    let channelId = '';
    let rawDescription = '';
    let thumbnail = '';
    let publishDate = '';
    let isEmbeddable = true;
    let modules = [];
    let views = 0;

    // Helper: parse ISO 8601 duration
    const parseDuration = (isoString) => {
      if (!isoString) return '0 mins';
      const match = isoString.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return '0 mins';
      const d = parseInt(match[1] || '0', 10);
      const h = parseInt(match[2] || '0', 10);
      const m = parseInt(match[3] || '0', 10);
      const s = parseInt(match[4] || '0', 10);
      
      let totalH = h + (d * 24);
      if (totalH > 0) {
        if (m > 0) return `${totalH} hr ${m} mins`;
        return `${totalH} hr`;
      }
      if (m > 0) {
        if (s > 0) return `${m} mins ${s} secs`;
        return `${m} mins`;
      }
      return `${s} secs`;
    };


    if (playlistId) {
      // 1. Get playlist details
      const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`);
      const plData = await plRes.json();
      if (!plData.items || plData.items.length === 0) throw new Error('Playlist not found');
      
      const snippet = plData.items[0].snippet;
      courseTitle = snippet.title;
      channelTitle = snippet.channelTitle;
      channelId = snippet.channelId;
      rawDescription = snippet.description;
      publishDate = snippet.publishedAt;
      thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url;

      // 2. Get playlist items
      let items = [];
      let nextPageToken = '';
      let pagesFetched = 0;
      do {
        const urlReq = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const itemsRes = await fetch(urlReq);
        const itemsData = await itemsRes.json();
        if (itemsData.items) items = items.concat(itemsData.items);
        nextPageToken = itemsData.nextPageToken;
        pagesFetched++;
      } while (nextPageToken && pagesFetched < 3);

      // 3. Get video details for all items to check duration and embeddable status
      const videoIds = items.map(item => item.contentDetails.videoId).filter(Boolean);
      const chunks = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
      }

      const videoDetails = {};
      for (const chunk of chunks) {
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status,statistics&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`);
        const vData = await vRes.json();
        vData.items?.forEach(v => {
          videoDetails[v.id] = v;
          if (!v.status.embeddable) isEmbeddable = false;
        });
      }

      items.forEach((item, index) => {
        const vid = item.contentDetails.videoId;
        const details = videoDetails[vid];
        if (index === 0 && details) views = parseInt(details.statistics?.viewCount || '0', 10);
        
        modules.push({
          title: `MODULE ${index + 1}: ${item.snippet.title}`,
          videoId: `https://youtu.be/${vid}`,
          duration: details ? parseDuration(details.contentDetails.duration) : '0 mins',
          creatorDescription: item.snippet.description
        });
      });

    } else if (videoId) {
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`);
      const vData = await vRes.json();
      if (!vData.items || vData.items.length === 0) throw new Error('Video not found');
      
      const v = vData.items[0];
      const snippet = v.snippet;
      courseTitle = snippet.title;
      channelTitle = snippet.channelTitle;
      channelId = snippet.channelId;
      rawDescription = snippet.description;
      publishDate = snippet.publishedAt;
      thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url;
      views = parseInt(v.statistics?.viewCount || '0', 10);
      if (!v.status.embeddable) isEmbeddable = false;

      modules = [{
        title: `MODULE 1: ${courseTitle}`,
        videoId: `https://youtu.be/${videoId}`,
        duration: parseDuration(v.contentDetails.duration),
        creatorDescription: rawDescription
      }];
    }

    // No AI generation as requested, set review to empty
    let generatedReview = '';

    // Auto-generate tags and tools (simple extraction based on keywords)
    const keywords = ['React', 'Next.js', 'Python', 'Node.js', 'JavaScript', 'TypeScript', 'AI', 'Machine Learning', 'Tailwind', 'CSS', 'HTML', 'Video Editing', 'DaVinci Resolve', 'Premiere Pro', 'AWS', 'Firebase'];
    const tags = [];
    const tools = [];
    const searchStr = `${courseTitle} ${rawDescription}`.toLowerCase();
    keywords.forEach(kw => {
      if (searchStr.includes(kw.toLowerCase())) {
        tags.push(kw);
        tools.push(kw);
      }
    });

    if (tags.length === 0) tags.push("Technology");

    return new Response(JSON.stringify({
      title: courseTitle,
      creatorName: channelTitle,
      channelId: channelId,
      thumbnail: thumbnail,
      views: views,
      publishDate: publishDate.split('T')[0],
      isEmbeddable,
      modules,
      overview: generatedReview,
      rawDescription,
      tags: [...new Set(tags)],
      tools: [...new Set(tools)],
      youtubeUrl: playlistId ? `https://www.youtube.com/playlist?list=${playlistId}` : `https://youtube.com/watch?v=${videoId}`,
      sampleVideoId: videoId || (modules.length > 0 ? modules[0].videoId.split('/').pop() : '')
    }), { status: 200 });

  } catch (err) {
    console.error("Auto import error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
