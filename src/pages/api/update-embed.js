import { db } from '../../lib/firebase.js';
import { doc, updateDoc } from 'firebase/firestore';

export const POST = async ({ request }) => {
  try {
    if (!db) {
      return new Response(JSON.stringify({ error: "Firestore not configured" }), { status: 500 });
    }

    const body = await request.json();
    const { slug, isEmbeddable } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400 });
    }

    const docRef = doc(db, "courses", slug);
    await updateDoc(docRef, { isEmbeddable });

    return new Response(JSON.stringify({ success: true, slug, isEmbeddable }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("Error updating course embed status:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
