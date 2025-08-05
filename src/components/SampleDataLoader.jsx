import React, { useState } from 'react'
import { db } from '../authentication/firebase'
import { collection, addDoc } from 'firebase/firestore'
import { sampleMenuItems } from '../data/sampleMenuData'

export default function SampleDataLoader({ onDataChange }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const addSampleData = async () => {
    console.log('Starting to add sample data...')
    console.log('Sample data count:', sampleMenuItems.length)
    setLoading(true)
    setMessage('')
    
    try {
      for (const item of sampleMenuItems) {
        console.log('Adding item:', item.name)
        const docRef = await addDoc(collection(db, 'MenuItems'), {
          ...item,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log('Successfully added item:', item.name, 'with ID:', docRef.id)
      }
      setMessage('✅ Sample menu items added successfully!')
      console.log('All sample data added successfully!')
      
      // Notify parent component of data change
      if (onDataChange) {
        console.log('Calling onDataChange callback')
        onDataChange()
      }
    } catch (error) {
      console.error('Error adding sample data:', error)
      setMessage(`❌ Error adding sample data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 max-w-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Data</h3>
      <p className="text-gray-600 mb-4 text-sm">
        Add sample menu items to showcase the menu management functionality.
      </p>
      
      <button
        onClick={addSampleData}
        disabled={loading}
        className="btn btn-primary w-full mb-3"
      >
        {loading ? 'Adding Sample Data...' : 'Add Sample Menu Items'}
      </button>
      
      {message && (
        <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'} text-sm`}>
          {message}
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-2">
        This will add {sampleMenuItems.length} sample menu items to your database.
      </div>
    </div>
  )
}
