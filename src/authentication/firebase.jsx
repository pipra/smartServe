import { initializeApp } from "firebase/app";
import {getAuth} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIOfFug2ACsxXaqQRYnOdSmf7dV6I5dyI",
  authDomain: "smartserve-583bc.firebaseapp.com",
  projectId: "smartserve-583bc",
  storageBucket: "smartserve-583bc.firebasestorage.app",
  messagingSenderId: "90291054889",
  appId: "1:90291054889:web:126e28c2c499a9c2696f38"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore();
export default app;