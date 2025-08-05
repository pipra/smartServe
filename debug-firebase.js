// Debug script to test Firebase connection
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIOfFug2ACsxXaqQRYnOdSmf7dV6I5dyI",
  authDomain: "smartserve-583bc.firebaseapp.com",
  projectId: "smartserve-583bc",
  storageBucket: "smartserve-583bc.firebasestorage.app",
  messagingSenderId: "90291054889",
  appId: "1:90291054889:web:126e28c2c499a9c2696f38"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore();

async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    const testDoc = await addDoc(collection(db, 'test'), {
      message: 'Hello from test script',
      timestamp: new Date()
    });
    console.log('✅ Successfully added test document:', testDoc.id);
  } catch (error) {
    console.error('❌ Error adding test document:', error);
  }
}

testFirestore();
