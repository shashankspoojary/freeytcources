import { db } from "../../lib/firebase.js";
import { collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    if (!db) {
      return new Response(JSON.stringify({ error: 'Firestore not configured' }), { status: 500 });
    }

    const q = query(collection(db, "courses"), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404 });
    }

    const docSnapshot = querySnapshot.docs[0];
    const docRef = doc(db, 'courses', docSnapshot.id);

    await updateDoc(docRef, {
      siteViews: increment(1)
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Error recording view:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}
