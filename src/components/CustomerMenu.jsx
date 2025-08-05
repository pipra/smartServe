import React, { useState, useEffect } from 'react'
import { db } from '../authentication/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export default function CustomerMenu() {
  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState(['All'])
  const [activeCategory, setActiveCategory] = useState('All')
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchMenuItems()
  }, [])

  const fetchMenuItems = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, 'MenuItems'), where('isVisible', '==', true))
      const querySnapshot = await getDocs(q)
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setMenuItems(items)
      
      // Extract unique categories
      const uniqueCategories = ['All', ...new Set(items.map(item => item.category))]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching menu items:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (item) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id)
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      } else {
        return [...prevCart, { ...item, quantity: 1 }]
      }
    })
  }

  const removeFromCart = (itemId) => {
    setCart(prevCart => {
      return prevCart.reduce((acc, cartItem) => {
        if (cartItem.id === itemId) {
          if (cartItem.quantity > 1) {
            acc.push({ ...cartItem, quantity: cartItem.quantity - 1 })
          }
        } else {
          acc.push(cartItem)
        }
        return acc
      }, [])
    })
  }

  const getCartQuantity = (itemId) => {
    const cartItem = cart.find(item => item.id === itemId)
    return cartItem ? cartItem.quantity : 0
  }

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-yellow-400">★</span>)
    }

    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-400">☆</span>)
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-300">★</span>)
    }

    return stars
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">Loading delicious menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <div className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-800">🍽️ SmartServe Menu</h1>
            </div>
            
            {/* Cart */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={fetchMenuItems}
                className="btn btn-ghost btn-circle"
                title="Refresh Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="relative">
                <button className="btn btn-primary relative">
                  🛒 Cart
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                      {getTotalItems()}
                    </span>
                  )}
                </button>
              </div>
              {cart.length > 0 && (
                <div className="text-lg font-semibold text-primary">
                  Total: ${getTotalPrice()}
                </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search for delicious food..."
                className="input input-bordered w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filters */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Categories</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`btn ${
                  activeCategory === category 
                    ? 'btn-primary' 
                    : 'btn-outline btn-primary'
                } transition-all duration-200 hover:scale-105`}
              >
                {category === 'All' ? '🍽️' : getCategoryIcon(category)} {category}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="relative h-48 overflow-hidden">
                <img
                  src={item.image || getDefaultImage(item.category)}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                />
                <div className="absolute top-3 right-3 flex flex-col gap-1">
                  {item.isVegetarian && (
                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
                      🌱 Veg
                    </span>
                  )}
                  {item.isSpicy && (
                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
                      🌶️ Spicy
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                  <div className="text-white">
                    <div className="flex items-center space-x-1">
                      {renderStars(item.rating || 4.5)}
                      <span className="text-sm ml-2">({item.rating || 4.5})</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-800 line-clamp-1">{item.name}</h3>
                  <span className="text-2xl font-bold text-primary">${item.price}</span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{item.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="badge badge-outline badge-lg">{item.category}</span>
                  
                  {getCartQuantity(item.id) > 0 ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="btn btn-sm btn-circle btn-outline"
                      >
                        −
                      </button>
                      <span className="font-semibold text-lg min-w-[2rem] text-center">
                        {getCartQuantity(item.id)}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="btn btn-sm btn-circle btn-primary"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="btn btn-primary btn-sm shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      Add to Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <div className="text-8xl mb-4">😔</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-2">No items found</h3>
            <p className="text-gray-500">Try adjusting your search or category filter.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Summary */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-primary text-white rounded-2xl shadow-2xl p-4 z-50 max-w-sm">
          <h3 className="font-bold text-lg mb-3">Order Summary</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="flex-1 truncate">{item.name}</span>
                <span className="mx-2">x{item.quantity}</span>
                <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/20 mt-3 pt-3">
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total:</span>
              <span>${getTotalPrice()}</span>
            </div>
            <button className="btn btn-accent w-full mt-3 shadow-lg">
              🛒 Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions
function getCategoryIcon(category) {
  const icons = {
    'Starters': '🥗',
    'Main Course': '🍽️',
    'Desserts': '🍰',
    'Beverages': '🥤'
  }
  return icons[category] || '🍴'
}

function getDefaultImage(category) {
  const defaultImages = {
    'Starters': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    'Main Course': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    'Desserts': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    'Beverages': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'
  }
  return defaultImages[category] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'
}
