import { db } from "../../lib/firebase.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { slug, rating, previousRating } = body;

    if (!slug || typeof rating !== 'number' || rating < 0 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    if (!db) {
      return new Response(JSON.stringify({ error: 'Firestore not configured' }), { status: 500 });
    }

    const docRef = doc(db, 'courses', slug);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404 });
    }

    const course = docSnap.data();
    
    // Default fallback values if not present
    const oldRating = course.rating || 0;
    const oldCount = course.ratingCount || 0;
    
    let newAverage, newCount;

    if (rating === 0 && typeof previousRating === 'number') {
      // Removing an existing rating
      newCount = Math.max(0, oldCount - 1);
      if (newCount === 0) {
        newAverage = 0; // Default fallback if no ratings left
      } else {
        const totalScore = (oldRating * oldCount) - previousRating;
        newAverage = Number((totalScore / newCount).toFixed(1));
      }
    } else if (typeof previousRating === 'number' && previousRating >= 1 && previousRating <= 5) {
      // Update existing rating: adjust average without changing count
      newCount = oldCount;
      const totalScore = (oldRating * oldCount) - previousRating + rating;
      // Safeguard against dividing by zero or getting weird numbers
      newAverage = newCount > 0 ? Number((totalScore / newCount).toFixed(1)) : rating;
    } else {
      // New rating: increment count
      newCount = oldCount + 1;
      newAverage = Number((((oldRating * oldCount) + rating) / newCount).toFixed(1));
    }

    await updateDoc(docRef, {
      rating: newAverage,
      ratingCount: newCount
    });

    return new Response(JSON.stringify({
      success: true,
      newRating: newAverage,
      newCount: newCount
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Error rating course:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}
