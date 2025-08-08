// Script to populate sample menu items in the database
// Run this in the browser console or create a button in admin dashboard

import { db } from './src/services/firebase/config.js'
import { collection, addDoc } from 'firebase/firestore'
import { sampleMenuItems } from './src/data/sampleMenuData.js'

// Function to populate menu items
export const populateMenuItems = async () => {
  try {
    console.log('Starting to populate menu items...')
    
    for (const item of sampleMenuItems) {
      const menuItemData = {
        name: item.name,
        price: item.price,
        category: item.category,
        subcategory: item.subcategory || '',
        description: item.description,
        isVegetarian: item.isVegetarian,
        isSpicy: item.isSpicy,
        isVisible: item.isVisible,
        rating: item.rating,
        imageUrl: item.imageUrl,
        image: item.image,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'MenuItems'), menuItemData)
      console.log(`Added menu item: ${item.name} with ID: ${docRef.id}`)
    }
    
    console.log('✅ All sample menu items have been added successfully!')
    
  } catch (error) {
    console.error('❌ Error populating menu items:', error)
  }
}

// Uncomment the line below to run automatically
// populateMenuItems()
