import { db } from "../../lib/firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST({ request }) {
  try {
    const body = await request.json();
    const url = body.url;

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

    if (targetId) {
       const q1 = query(collection(db, "courses"), where("sampleVideoId", "==", targetId));
       if (!(await getDocs(q1)).empty) isDuplicate = true;
       
       if (!isDuplicate) {
           const q2 = query(collection(db, "courses"), where("youtubeId", "==", targetId));
           if (!(await getDocs(q2)).empty) isDuplicate = true;
       }
    }
    
    if (!isDuplicate) {
       const q4 = query(collection(db, "courses"), where("youtubeUrl", "==", url));
       if (!(await getDocs(q4)).empty) isDuplicate = true;
    }

    return new Response(JSON.stringify({ isDuplicate }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
