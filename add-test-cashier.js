// Script to add test cashier data for testing the admin dashboard
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc } from 'firebase/firestore'

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

async function addTestCashier() {
  try {
    const cashierData = {
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      email: 'john.cashier@test.com',
      phone: '1234567890',
      experience: '2',
      skills: ['Cash Handling', 'POS Systems', 'Customer Service'],
      preferredShift: 'morning',
      status: 'pending',
      approval: false,
      createdAt: new Date().toISOString(),
      role: 'cashier'
    }

    const docRef = await addDoc(collection(db, 'Cashiers'), cashierData)
    console.log('Test cashier added with ID:', docRef.id)
    
    // Add another one
    const cashierData2 = {
      firstName: 'Jane',
      lastName: 'Smith',
      name: 'Jane Smith',
      email: 'jane.cashier@test.com',
      phone: '0987654321',
      experience: '3',
      skills: ['Cash Handling', 'Inventory Management', 'Payment Processing'],
      preferredShift: 'afternoon',
      status: 'pending',
      approval: false,
      createdAt: new Date().toISOString(),
      role: 'cashier'
    }

    const docRef2 = await addDoc(collection(db, 'Cashiers'), cashierData2)
    console.log('Second test cashier added with ID:', docRef2.id)
    
  } catch (error) {
    console.error('Error adding test cashier:', error)
  }
}

addTestCashier()
