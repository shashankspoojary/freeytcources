import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * @typedef {Object} Chapter
 * @property {string} title
 * @property {string} duration
 * @property {string} [videoId]
 * @property {string} [creatorDescription]
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
 * @property {boolean} [isEmbeddable]
 * @property {string} [creatorDescription]
 * @property {string} creatorDescription
 * @property {Chapter[]} chapters
 * @property {Chapter[]} [modules]
 * @property {string} [videoUrl]
 * @property {string} [youtubeId]
 * @property {boolean} [isCreatorSubmission]
 * @property {boolean} [showcaseFeatured]
 * @property {any} [creatorSubmittedAt]
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

function computeCourseDuration(course) {
  let totalMinutes = 0;
  const chapters = course.chapters || course.modules || [];
  
  if (chapters.length > 0) {
    chapters.forEach(ch => {
      const d = ch.duration || '';
      const timeMatch = d.match(/^(?:(?:(\d+):)?(\d+):)?(\d+)$/);
      if (timeMatch) {
        if (timeMatch[1]) {
           totalMinutes += parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        } else if (timeMatch[2]) {
           totalMinutes += parseInt(timeMatch[2], 10);
        }
      } else {
        const hMatch = d.match(/(\d+)\s*h/i);
        const mMatch = d.match(/(\d+)\s*m/i);
        const minsMatch = d.match(/(\d+)\s*mins?/i);
        if (hMatch) totalMinutes += parseInt(hMatch[1], 10) * 60;
        if (mMatch) totalMinutes += parseInt(mMatch[1], 10);
        else if (minsMatch) totalMinutes += parseInt(minsMatch[1], 10);
      }
    });
  }

  if (totalMinutes > 0) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }
  
  return course.duration !== "1h 30m" ? course.duration : "TBD";
}

export async function getAllCourses() {
  if (!db) {
    console.info("Firestore not configured/active. Returning empty array.");
    return [];
  }

  try {
    const fetched = [];
    
    // 1. Fetch courses
    const querySnapshot = await getDocs(collection(db, "courses"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      data.duration = computeCourseDuration(data);
      fetched.push({ id: doc.id, ...data });
    });

    // 2. Fetch playlists and map them to standard course shape
    try {
      const plSnapshot = await getDocs(collection(db, "playlists"));
      plSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let sampleVid = '';
        if (data.modules && data.modules.length > 0) {
          sampleVid = data.modules[0].videoId;
        }
        
        const mappedData = {
          id: docSnap.id,
          slug: docSnap.id,
          title: data.name || 'Curated Course',
          description: data.overview || '',
          overview: data.overview || '',
          category: data.category || 'Playlists', // or extract from tags
          language: data.language || 'English',
          rating: 4.8,
          votes: 1,
          views: 10,
          publishDate: data.createdAt || new Date().toISOString(),
          duration: '',
          author: data.author || 'FreeYTcourses',
          creatorName: data.author || 'FreeYTcourses',
          creatorLogo: '/favicon.svg',
          type: 'free',
          sampleVideoId: sampleVid,
          youtubeUrl: sampleVid ? `https://youtube.com/watch?v=${sampleVid}` : '',
          tools: data.tags || [],
          thumbnail: sampleVid ? `https://img.youtube.com/vi/${sampleVid}/hqdefault.jpg` : (data.logo || '/favicon.svg'),
          moduleType: data.modules && data.modules.length > 1 ? 'multi' : 'single',
          isEmbeddable: true,
          chapters: data.modules ? data.modules.map((m) => ({
            title: m.title,
            duration: m.duration,
            videoId: m.videoId,
            creatorDescription: m.notes || ''
          })) : [],
          isCuratedPlaylist: true
        };
        mappedData.duration = computeCourseDuration(mappedData);
        fetched.push(mappedData);
      });
    } catch (plErr) {
      console.warn("Failed to fetch/merge playlists:", plErr);
    }
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
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      data.duration = computeCourseDuration(data);
      return { id: docSnap.id, ...data };
    }
    
    // Fallback: Check playlists collection
    const plDoc = await getDoc(doc(db, "playlists", slug));
    if (plDoc.exists()) {
      const data = plDoc.data();
      let sampleVid = '';
      if (data.modules && data.modules.length > 0) {
        sampleVid = data.modules[0].videoId;
      }
      
      const mappedData = {
        id: plDoc.id,
        slug: plDoc.id,
        title: data.name || 'Curated Course',
        description: data.overview || '',
        overview: data.overview || '',
        category: data.category || 'Playlists',
        language: data.language || 'English',
        rating: 4.8,
        votes: 1,
        views: 10,
        publishDate: data.createdAt || new Date().toISOString(),
        duration: '',
        author: data.author || 'FreeYTcourses',
        creatorName: data.author || 'FreeYTcourses',
        creatorLogo: '/favicon.svg',
        type: 'free',
        sampleVideoId: sampleVid,
        youtubeUrl: sampleVid ? `https://youtube.com/watch?v=${sampleVid}` : '',
        tools: data.tags || [],
        thumbnail: sampleVid ? `https://img.youtube.com/vi/${sampleVid}/hqdefault.jpg` : (data.logo || '/favicon.svg'),
        moduleType: data.modules && data.modules.length > 1 ? 'multi' : 'single',
        isEmbeddable: true,
        chapters: data.modules ? data.modules.map((m) => ({
          title: m.title,
          duration: m.duration,
          videoId: m.videoId,
          creatorDescription: m.notes || ''
        })) : [],
        isCuratedPlaylist: true
      };
      mappedData.duration = computeCourseDuration(mappedData);
      return mappedData;
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
  if (!videoId) return "";
  let id = videoId;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = videoId.match(regExp);
  if (match && match[2].length === 11) {
    id = match[2];
  }
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
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

/**
 * Fetches all playlists from Firestore.
 * @returns {Promise<any[]>}
 */
export async function getAllPlaylists() {
  if (!db) {
    return [];
  }
  try {
    const querySnapshot = await getDocs(collection(db, "playlists"));
    const fetched = [];
    querySnapshot.forEach((doc) => {
      fetched.push({ id: doc.id, ...doc.data() });
    });
    return fetched;
  } catch (e) {
    console.warn("Failed to fetch playlists from Firestore.", e);
    return [];
  }
}

/**
 * Fetches a specific playlist by its ID/slug.
 * @param {string} slug
 * @returns {Promise<any|undefined>}
 */
export async function getPlaylistBySlug(slug) {
  if (!db) return undefined;
  try {
    const docRef = doc(db, "playlists", slug);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return undefined;
  } catch (e) {
    console.warn(`Failed to fetch playlist '${slug}'.`, e);
    return undefined;
  }
}

export { app, db, auth, googleProvider };
