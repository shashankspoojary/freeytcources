import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * @typedef {Object} Chapter
 * @property {string} title
 * @property {string} duration
 * @property {string} [videoId]
 * 
 * @typedef {Object} Course
 * @property {string|number} id
 * @property {string} slug
 * @property {string} title
 * @property {string} description
 * @property {string} category
 * @property {string} language
 * @property {number} rating
 * @property {number} votes
 * @property {number} views
 * @property {boolean} [featured]
 * @property {number} [publishedYear]
 * @property {string} publishDate
 * @property {string} duration
 * @property {string} author
 * @property {string} creatorName
 * @property {string} creatorLogo
 * @property {string} [channelId]
 * @property {string} [creatorSubscribers]
 * @property {string} type
 * @property {string} sampleVideoId
 * @property {string} youtubeUrl
 * @property {string[]} tools
 * @property {string} [summary]
 * @property {string} [thumbnail]
 * @property {'single' | 'multi'} [moduleType]
 * @property {string} overview
 * @property {Chapter[]} chapters
 */

// Firebase Config initialized using Astro env system
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

// Check if we have a valid configuration (e.g. project ID is populated)
const isValidConfig = firebaseConfig.projectId && firebaseConfig.projectId !== "mock-project-id" && firebaseConfig.projectId !== "";

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;

/** @type {import('firebase/firestore').Firestore | null} */
let db = null;

/** @type {import('firebase/auth').Auth | null} */
let auth = null;

/** @type {import('firebase/auth').GoogleAuthProvider} */
let googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (isValidConfig) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.warn("Firebase initialization failed:", e);
  }
}

/**
 * Fetches all courses from Firestore.
 * @returns {Promise<Course[]>}
 */
export async function getAllCourses() {
  if (!db) {
    console.info("Firestore not configured/active. Returning empty array.");
    return [];
  }

  try {
    const querySnapshot = await getDocs(collection(db, "courses"));
    const fetched = [];
    querySnapshot.forEach((doc) => {
      fetched.push({ id: doc.id, ...doc.data() });
    });
    
    return fetched;
  } catch (e) {
    console.warn("Failed to fetch courses from Firestore.", e);
    return [];
  }
}

/**
 * Fetches a single course matching the slug parameter from Firestore.
 * @param {string} slug
 * @returns {Promise<Course|undefined>}
 */
export async function getCourseBySlug(slug) {
  if (!db) {
    return undefined;
  }

  try {
    const q = query(collection(db, "courses"), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    console.warn(`Course slug '${slug}' not found in Firestore.`);
    return undefined;
  } catch (e) {
    console.warn(`Failed to fetch course slug '${slug}' from Firestore.`, e);
    return undefined;
  }
}

/**
 * Translates a sampleVideoId to YouTube's standard static maxresdefault thumbnail URL.
 */
export function getYoutubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Generates a URL-friendly slug from a creator's name.
 * @param {string} name
 * @returns {string}
 */
export function getCreatorSlug(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export { app, db, auth, googleProvider };
