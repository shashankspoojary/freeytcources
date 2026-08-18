import { db } from "../../lib/firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST({ request }) {
  try {
    const body = await request.json();
    const url = body.url;
    const videoIds = body.videoIds || [];

    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400 });
    }

    if (!db) {
      return new Response(JSON.stringify({ error: 'Firestore not configured' }), { status: 500 });
    }

    const isPlaylist = url.includes('list=');
    let targetId = null;

    if (isPlaylist) {
      const match = url.match(/[?&]list=([^&]+)/);
      if (match) targetId = match[1];
    } else {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (match) targetId = match[1];
    }

    let isDuplicate = false;

    if (targetId && !isPlaylist) {
       const q1 = query(collection(db, "courses"), where("sampleVideoId", "==", targetId));
       if (!(await getDocs(q1)).empty) isDuplicate = true;
       
       if (!isDuplicate) {
           const q2 = query(collection(db, "courses"), where("youtubeId", "==", targetId));
           if (!(await getDocs(q2)).empty) isDuplicate = true;
       }
    }
    
    if (!isDuplicate) {
       // 1. Exact match
       const qExact = query(collection(db, "courses"), where("youtubeUrl", "==", url));
       if (!(await getDocs(qExact)).empty) isDuplicate = true;
    }

    if (!isDuplicate) {
       // 2. Base match (strip tracking params like &si=)
       const baseUrl = url.split('&')[0];
       if (baseUrl !== url) {
           const qBase = query(collection(db, "courses"), where("youtubeUrl", "==", baseUrl));
           if (!(await getDocs(qBase)).empty) isDuplicate = true;
       }
    }

    if (!isDuplicate && isPlaylist && targetId) {
       // 3. Common playlist URL variations
       const variations = [
           `https://www.youtube.com/playlist?list=${targetId}`,
           `https://youtube.com/playlist?list=${targetId}`
       ];
       
       for (const variant of variations) {
           if (variant !== url) {
               const qVar = query(collection(db, "courses"), where("youtubeUrl", "==", variant));
               if (!(await getDocs(qVar)).empty) {
                   isDuplicate = true;
                   break;
               }
           }
       }
    }

    if (!isDuplicate && (targetId || videoIds.length > 0)) {
       // 4. Fallback: Full collection scan to ensure we don't miss unusual formats or overlapping playlist videos
       const allCourses = await getDocs(collection(db, "courses"));
       for (const doc of allCourses.docs) {
           const data = doc.data();
           
           if (targetId && data.youtubeUrl && data.youtubeUrl.includes(targetId)) {
               isDuplicate = true;
               break;
           }

           // Check deep overlap for any provided video IDs
           if (videoIds.length > 0) {
               for (const vid of videoIds) {
                   if (data.sampleVideoId === vid || data.youtubeId === vid) {
                       isDuplicate = true;
                       break;
                   }
                   if (data.chapters && Array.isArray(data.chapters) && data.chapters.some(ch => ch.videoId === vid)) {
                       isDuplicate = true;
                       break;
                   }
                   if (data.modules && Array.isArray(data.modules) && data.modules.some(ch => ch.videoId === vid)) {
                       isDuplicate = true;
                       break;
                   }
               }
           }
           if (isDuplicate) break;
       }
    }

    return new Response(JSON.stringify({ isDuplicate }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
