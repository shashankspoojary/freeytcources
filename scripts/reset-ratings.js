import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.PUBLIC_FIREBASE_APP_ID,
};

console.log("Connecting to Firebase...", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching courses...");
  const querySnapshot = await getDocs(collection(db, "courses"));
  let updated = 0;
  
  for (const d of querySnapshot.docs) {
    const data = d.data();
    if (data.ratingCount > 0 || data.rating > 0) {
      console.log(`Resetting: ${data.title} (slug: ${d.id}, was ${data.rating} avg / ${data.ratingCount} count)`);
      await updateDoc(doc(db, "courses", d.id), {
        rating: 0,
        ratingCount: 0
      });
      updated++;
    }
  }
  
  console.log(`Done! Reset ${updated} courses to 0 ratings.`);
  process.exit(0);
}

run().catch(console.error);
