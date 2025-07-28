// Script to add an approved test cashier for login testing
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCkr6nJV5Z5X7AYQIbtN0CRsV2JDw_y9jM",
  authDomain: "waiter-approval-system.firebaseapp.com",
  projectId: "waiter-approval-system",
  storageBucket: "waiter-approval-system.firebasestorage.app",
  messagingSenderId: "426594259450",
  appId: "1:426594259450:web:6b3ad56f8a18e3c4ba0a08"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

async function createApprovedCashier() {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, 'test.cashier@example.com', 'password123')
    const user = userCredential.user

    // Create approved cashier document
    const cashierData = {
      firstName: 'Test',
      lastName: 'Cashier',
      name: 'Test Cashier',
      email: 'test.cashier@example.com',
      phone: '1234567890',
      experience: '2',
      skills: ['Cash Handling', 'POS Systems', 'Customer Service'],
      preferredShift: 'morning',
      status: 'active',
      approval: true,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      role: 'cashier'
    }

    await setDoc(doc(db, 'Cashiers', user.uid), cashierData)
    console.log('Approved test cashier created successfully!')
    console.log('Email: test.cashier@example.com')
    console.log('Password: password123')
    
  } catch (error) {
    console.error('Error creating approved cashier:', error)
  }
}

createApprovedCashier()
