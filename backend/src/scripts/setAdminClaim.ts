import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = process.argv[2];
const flag = process.argv[3] ?? "true";

if (!uid) {
  console.error("Usage: npm run set-admin <uid> [true|false]");
  process.exit(1);
}

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error("Missing Firebase admin credentials in environment variables.");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const run = async () => {
  const adminFlag = flag.toLowerCase() === "true";
  await getAuth().setCustomUserClaims(uid, { admin: adminFlag });
  console.log(`Set admin=${adminFlag} for user ${uid}`);
};

run().catch((error) => {
  console.error("Failed to set admin claim", error);
  process.exit(1);
});
