import React, { useState, useEffect } from 'react'
import { auth, db } from '../authentication/firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore'

export default function ChefDashboard() {
  const [activeSection, setActiveSection] = useState('orders')
  const [userFullName, setUserFullName] = useState('Chef')
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest') // 'newest', 'oldest', 'status', 'table'
  const [selectedMenuItem, setSelectedMenuItem] = useState(null) // For menu item details modal

  // Calculate dynamic stats based on real orders
  const stats = {
    totalOrders: orders.length,
    completedToday: orders.filter(order => order.status === 'served' || order.status === 'completed' || order.status === 'ready').length,
    inProgress: orders.filter(order => order.status === 'preparing' || order.status === 'confirmed').length
  }

  // Helper function to calculate time elapsed since order
  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return 'N/A'
    
    const now = new Date()
    const orderTime = timestamp.toDate()
    const diffInMs = now - orderTime
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    const remainingMinutes = diffInMinutes % 60
    
    if (diffInHours < 24) {
      return remainingMinutes > 0 ? `${diffInHours}h ${remainingMinutes}m ago` : `${diffInHours}h ago`
    }
    
    return orderTime.toLocaleDateString()
  }

  // Sort orders based on selected criteria
  const getSortedOrders = () => {
    let sorted = [...orders]
    
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp.toDate() - b.timestamp.toDate()
          }
          return 0
        })
        break
      case 'status': {
        const statusOrder = { 'confirmed': 1, 'preparing': 2, 'ready': 3, 'served': 4, 'cancelled': 5 }
        sorted.sort((a, b) => {
          const aOrder = statusOrder[a.status] || 6
          const bOrder = statusOrder[b.status] || 6
          return aOrder - bOrder
        })
        break
      }
      case 'table':
        sorted.sort((a, b) => {
          const aTable = parseInt(a.tableNumber) || 0
          const bTable = parseInt(b.tableNumber) || 0
          return aTable - bTable
        })
        break
      case 'newest':
      default:
        sorted.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return b.timestamp.toDate() - a.timestamp.toDate()
          }
          return 0
        })
        break
    }
    
    return sorted
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // User not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login')
        window.location.replace('/login')
        return
      }

      try {
        // Check Chefs collection
        const chefDoc = await getDoc(doc(db, 'Chefs', user.uid))
        if (chefDoc.exists()) {
          const userData = chefDoc.data()
          
          // Check if chef is approved
          if (!userData.approval || userData.status === 'pending') {
            console.log('Chef account not approved, redirecting to login')
            sessionStorage.setItem('justLoggedOut', 'true')
            await signOut(auth)
            window.location.href = '/login'
            return
          }
          
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          setUserFullName(fullName || 'Chef')
        } else {
          // User doesn't exist in Chefs collection
          console.log('User not found in Chefs collection, redirecting to login')
          sessionStorage.setItem('justLoggedOut', 'true')
          await signOut(auth)
          window.location.href = '/login'
          return
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        window.location.href = '/login'
        return
      }
      
      setIsLoading(false)
    })

    // Real-time orders listener - fetch orders that are confirmed by waiters
    const ordersUnsubscribe = onSnapshot(collection(db, 'Orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Filter orders that are confirmed by waiters (excluding pending and cancelled orders)
      // and sort by timestamp (newest first)
      const confirmedOrders = ordersData
        .filter(order => order.status !== 'pending' && order.status !== 'cancelled' && order.tableNumber)
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return b.timestamp.toDate() - a.timestamp.toDate()
          }
          return 0
        })
      
      console.log('📋 Fetched orders for chef:', confirmedOrders.length, 'confirmed orders')
      setOrders(confirmedOrders)
    }, (error) => {
      console.error('❌ Error fetching orders:', error)
    })

    // Real-time menu items listener
    const menuUnsubscribe = onSnapshot(collection(db, 'MenuItems'), (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      console.log('📋 Fetched menu items:', menuData.length, 'items')
      setMenuItems(menuData)
    }, (error) => {
      console.error('❌ Error fetching menu items:', error)
    })

    return () => {
      unsubscribe()
      ordersUnsubscribe()
      menuUnsubscribe()
    }
  }, [])

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'Orders', orderId)
      await updateDoc(orderRef, {
        status: newStatus,
        lastUpdated: new Date(),
        updatedBy: userFullName || 'Chef'
      })
      console.log(`Order ${orderId} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status. Please try again.')
    }
  }

  const updateMenuItemStatus = async (itemId, newAvailability) => {
    try {
      const itemRef = doc(db, 'MenuItems', itemId)
      await updateDoc(itemRef, {
        available: newAvailability,
        lastUpdated: new Date(),
        updatedBy: userFullName || 'Chef'
      })
      console.log(`Menu item ${itemId} availability updated to ${newAvailability}`)
    } catch (error) {
      console.error('Error updating menu item status:', error)
      alert('Failed to update menu item status. Please try again.')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-yellow-100 text-yellow-800'
      case 'preparing': return 'bg-blue-100 text-blue-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'served': return 'bg-gray-100 text-gray-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-red-500'
      case 'high': return 'border-l-4 border-orange-500'
      case 'normal': return 'border-l-4 border-blue-500'
      default: return 'border-l-4 border-gray-500'
    }
  }

  const handleLogout = async () => {
    try {
      // Set logout flag to prevent auto-redirect
      sessionStorage.setItem('justLoggedOut', 'true')
      await signOut(auth)
      window.location.href = '/login'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-xl">🍳</span>
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    SmartServe
                  </span>
                  <div className="text-sm text-gray-600 font-medium">Chef Dashboard</div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Navigation Items */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveSection('orders')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeSection === 'orders' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  <span>🍳</span>
                  <span className="hidden md:inline">Kitchen Orders</span>
                </button>
                <button
                  onClick={() => setActiveSection('menu')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeSection === 'menu' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  <span>📋</span>
                  <span className="hidden md:inline">Menu Management</span>
                </button>
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeSection === 'profile' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  <span>👤</span>
                  <span className="hidden md:inline">Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* Kitchen Orders Section */}
          {activeSection === 'orders' && (
            <div className="bg-white shadow-lg rounded-xl border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <span className="mr-3">🍳</span>
                      Kitchen Orders
                    </h2>
                    <p className="text-gray-600 mt-1">Manage incoming and current orders confirmed by waiters</p>
                  </div>
                  
                  {/* Sort Controls */}
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="status">By Status</option>
                      <option value="table">By Table</option>
                    </select>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {orders.filter(o => o.status === 'confirmed').length}
                    </div>
                    <div className="text-xs text-gray-600">Confirmed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {orders.filter(o => o.status === 'preparing').length}
                    </div>
                    <div className="text-xs text-gray-600">Preparing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {orders.filter(o => o.status === 'ready').length}
                    </div>
                    <div className="text-xs text-gray-600">Ready</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {orders.filter(o => o.status === 'served').length}
                    </div>
                    <div className="text-xs text-gray-600">Served</div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-300 text-8xl mb-6">🍳</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">No Orders Yet</h3>
                    <p className="text-gray-600 text-lg">Waiting for confirmed orders from waiters...</p>
                    <div className="mt-6 p-4 bg-orange-50 rounded-lg inline-block">
                      <p className="text-sm text-orange-700">
                        <span className="font-medium">💡 Tip:</span> Orders will appear here once waiters confirm them
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getSortedOrders().map((order) => (
                      <div 
                        key={order.id} 
                        className={`group relative bg-gradient-to-r from-gray-50 to-gray-100 hover:from-orange-50 hover:to-red-50 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${getPriorityColor(order.priority || 'normal')}`}
                      >
                        {/* Priority Indicator */}
                        {(order.priority === 'urgent' || order.priority === 'high') && (
                          <div className="absolute top-2 right-2">
                            <div className={`w-3 h-3 rounded-full ${
                              order.priority === 'urgent' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                            }`}></div>
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                <span className="mr-2">🍽️</span>
                                Table {order.tableNumber}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center">
                                <span className="mr-1">👤</span>
                                {order.customerName || 'Guest'}
                              </span>
                              <span className="flex items-center">
                                <span className="mr-1">🆔</span>
                                #{order.id.slice(-6)}
                              </span>
                              {order.timestamp && (
                                <span className="flex items-center">
                                  <span className="mr-1">⏰</span>
                                  {getTimeElapsed(order.timestamp)}
                                </span>
                              )}
                              {order.timestamp && (
                                <span className="flex items-center">
                                  <span className="mr-1">🕐</span>
                                  {order.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border-2 ${
                              order.priority === 'urgent' ? 'bg-red-100 text-red-800 border-red-300' :
                              order.priority === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                              'bg-blue-100 text-blue-800 border-blue-300'
                            }`}>
                              {(order.priority || 'normal').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Order Items */}
                        <div className="mb-6">
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                            <span className="mr-2">📋</span>
                            Order Items:
                          </h4>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="space-y-2">
                              {order.items && order.items.map((item, index) => (
                                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                                  <div className="flex items-center">
                                    <span className="w-3 h-3 bg-orange-400 rounded-full mr-3"></span>
                                    <span className="font-medium text-gray-900">{item.name}</span>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <span className="text-sm bg-gray-100 px-2 py-1 rounded-full font-medium">
                                      x{item.quantity}
                                    </span>
                                    {item.price && (
                                      <span className="text-sm text-gray-600">
                                        ৳{(item.price * item.quantity).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {order.totalAmount && (
                              <div className="mt-4 pt-3 border-t-2 border-orange-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                                  <span className="text-xl font-bold text-orange-600">
                                    ৳{order.totalAmount.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex space-x-3">
                          {order.status === 'confirmed' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'preparing')}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
                            >
                              <span>🔥</span>
                              <span>Start Preparing</span>
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'ready')}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
                            >
                              <span>✅</span>
                              <span>Mark Ready</span>
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <div className="flex-1 bg-green-100 text-green-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 border-2 border-green-300">
                              <span>🍽️</span>
                              <span>Ready for Pickup - Waiting for Waiter</span>
                            </div>
                          )}
                          {(order.status === 'served' || order.status === 'completed') && (
                            <div className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center space-x-2">
                              <span>✅</span>
                              <span>Order Completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Menu Management Section */}
          {activeSection === 'menu' && (
            <div className="bg-white shadow-lg rounded-xl border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                      <span className="mr-3">📋</span>
                      Menu Management
                    </h2>
                    <p className="text-gray-600 mt-1">Manage dish availability and status</p>
                  </div>
                  
                  {/* Menu Stats */}
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {menuItems.filter(item => item.available).length}
                      </div>
                      <div className="text-xs text-gray-600">Available</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {menuItems.filter(item => !item.available).length}
                      </div>
                      <div className="text-xs text-gray-600">Out of Stock</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {menuItems.length}
                      </div>
                      <div className="text-xs text-gray-600">Total Items</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {menuItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-300 text-8xl mb-6">📋</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">No Menu Items Found</h3>
                    <p className="text-gray-600 text-lg">No menu items available in the database</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuItems.map((item) => (
                      <div key={item.id} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">{item.category}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                          </div>
                          <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border-2 ${
                            item.available 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {item.available ? 'Available' : 'Out of Stock'}
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-orange-600">
                              ৳{item.price}
                            </span>
                            {item.preparationTime && (
                              <span className="text-sm text-gray-600 flex items-center">
                                <span className="mr-1">⏱️</span>
                                {item.preparationTime} min
                              </span>
                            )}
                          </div>
                        </div>

                        {item.allergens && item.allergens.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-gray-600 mb-1">Allergens:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.allergens.map((allergen, index) => (
                                <span key={index} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  {allergen}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedMenuItem(item)}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                          >
                            <span>👁️</span>
                            <span>View Details</span>
                          </button>
                          
                          <button 
                            onClick={() => updateMenuItemStatus(item.id, !item.available)}
                            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                              item.available 
                                ? 'bg-red-500 hover:bg-red-600 text-white' 
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            <span>{item.available ? '❌' : '✅'}</span>
                            <span>{item.available ? 'Mark Unavailable' : 'Mark Available'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Profile Header Card */}
              <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 rounded-2xl shadow-2xl overflow-hidden">
                <div className="relative px-8 py-12 text-white">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10"></div>
                  
                  <div className="relative z-10 text-center">
                    {/* Profile Avatar */}
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white border-opacity-30 shadow-xl">
                        <span className="text-6xl">🧑‍🍳</span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    </div>
                    
                    {/* Profile Info */}
                    <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">{userFullName}</h1>
                    <p className="text-xl text-white text-opacity-90 mb-4 font-medium">Head Chef</p>
                    <div className="flex items-center justify-center space-x-4 text-white text-opacity-80">
                      <div className="flex items-center space-x-2">
                        <span>🏆</span>
                        <span className="font-medium">5 Years Experience</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today's Performance */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <span className="mr-3 text-2xl">📊</span>
                      Today's Performance
                    </h3>
                    <p className="text-gray-600 mt-1">Your kitchen statistics for today</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Performance Cards */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">✅</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-green-600">{stats.completedToday}</p>
                            <p className="text-sm text-green-700 font-medium">Completed</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Orders completed today</p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">🔥</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
                            <p className="text-sm text-blue-700 font-medium">In Progress</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Currently cooking</p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">🍽️</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-orange-600">{stats.totalOrders}</p>
                            <p className="text-sm text-orange-700 font-medium">Total Orders</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">All orders today</p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">�</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-purple-600">{Math.round((stats.completedToday / Math.max(stats.totalOrders, 1)) * 100)}%</p>
                            <p className="text-sm text-purple-700 font-medium">Success Rate</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Orders completion rate</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions & Account */}
                <div className="space-y-6">
                  {/* Account Information */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <span className="mr-3">👤</span>
                        Account Info
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">📧</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="font-medium text-gray-900 truncate">chef@smartserve.com</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">✅</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Status</p>
                          <p className="font-medium text-green-600">Active & Approved</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">🎯</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Department</p>
                          <p className="font-medium text-gray-900">Kitchen Operations</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <span className="mr-3">⚡</span>
                        Quick Actions
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-3">
                      <button
                        onClick={() => setActiveSection('orders')}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">🍳</span>
                        <span>Back to Kitchen</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveSection('menu')}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">📋</span>
                        <span>Manage Menu</span>
                      </button>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">🚪</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievement Banner */}
              <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl shadow-lg overflow-hidden">
                <div className="px-8 py-6 text-white relative">
                  <div className="absolute inset-0 bg-black bg-opacity-10"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-3xl">🏆</span>
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold mb-1">Chef of the Month!</h4>
                        <p className="text-white text-opacity-90">Outstanding performance with excellent kitchen management</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{Math.round((stats.completedToday / Math.max(stats.totalOrders, 1)) * 100)}%</div>
                      <div className="text-sm text-white text-opacity-80">Success Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Menu Item Details Modal */}
      {selectedMenuItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{selectedMenuItem.name}</h2>
                  <p className="text-blue-100">{selectedMenuItem.category}</p>
                </div>
                <button
                  onClick={() => setSelectedMenuItem(null)}
                  className="text-white hover:text-red-200 transition-colors text-2xl font-bold ml-4"
                >
                  ×
                </button>
              </div>
              
              {/* Price and Status */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-3xl font-bold">৳{selectedMenuItem.price}</div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedMenuItem.available 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedMenuItem.available ? '✅ Available' : '❌ Out of Stock'}
                </span>
              </div>
            </div>

            {/* Menu Item Image */}
            {selectedMenuItem.image && (
              <div className="p-6 pb-0">
                <div className="relative">
                  <img
                    src={selectedMenuItem.image}
                    alt={selectedMenuItem.name}
                    className="w-full h-64 object-cover rounded-xl shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  {/* Fallback if image fails to load */}
                  <div className="hidden w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-lg items-center justify-center">
                    <div className="text-center">
                      <span className="text-6xl text-gray-400 mb-4 block">🍽️</span>
                      <p className="text-gray-500 font-medium">Image not available</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">📝</span>
                  Description
                </h3>
                <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                  {selectedMenuItem.description || 'No description available'}
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Preparation Time */}
                {selectedMenuItem.preparationTime && (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center mb-2">
                      <span className="text-xl mr-2">⏱️</span>
                      <h4 className="font-semibold text-gray-900">Preparation Time</h4>
                    </div>
                    <p className="text-orange-700 font-medium text-lg">
                      {selectedMenuItem.preparationTime} minutes
                    </p>
                  </div>
                )}

                {/* Spice Level */}
                {selectedMenuItem.spiceLevel && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center mb-2">
                      <span className="text-xl mr-2">🌶️</span>
                      <h4 className="font-semibold text-gray-900">Spice Level</h4>
                    </div>
                    <p className="text-red-700 font-medium text-lg capitalize">
                      {selectedMenuItem.spiceLevel}
                    </p>
                  </div>
                )}

                {/* Calories */}
                {selectedMenuItem.calories && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center mb-2">
                      <span className="text-xl mr-2">🔥</span>
                      <h4 className="font-semibold text-gray-900">Calories</h4>
                    </div>
                    <p className="text-green-700 font-medium text-lg">
                      {selectedMenuItem.calories} kcal
                    </p>
                  </div>
                )}

                {/* Serving Size */}
                {selectedMenuItem.servingSize && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center mb-2">
                      <span className="text-xl mr-2">🍽️</span>
                      <h4 className="font-semibold text-gray-900">Serving Size</h4>
                    </div>
                    <p className="text-blue-700 font-medium text-lg">
                      {selectedMenuItem.servingSize}
                    </p>
                  </div>
                )}
              </div>

              {/* Ingredients */}
              {selectedMenuItem.ingredients && selectedMenuItem.ingredients.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🥘</span>
                    Ingredients
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex flex-wrap gap-2">
                      {selectedMenuItem.ingredients.map((ingredient, index) => (
                        <span 
                          key={index}
                          className="bg-white px-3 py-2 rounded-full text-sm font-medium text-gray-700 border border-gray-200 shadow-sm"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Allergens */}
              {selectedMenuItem.allergens && selectedMenuItem.allergens.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚠️</span>
                    Allergen Information
                  </h3>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex flex-wrap gap-2">
                      {selectedMenuItem.allergens.map((allergen, index) => (
                        <span 
                          key={index}
                          className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-full text-sm font-medium border border-yellow-300"
                        >
                          {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dietary Info */}
              {(selectedMenuItem.isVegetarian || selectedMenuItem.isVegan || selectedMenuItem.isGlutenFree) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🌱</span>
                    Dietary Information
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedMenuItem.isVegetarian && (
                      <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium flex items-center">
                        <span className="mr-1">🥬</span>
                        Vegetarian
                      </span>
                    )}
                    {selectedMenuItem.isVegan && (
                      <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium flex items-center">
                        <span className="mr-1">🌿</span>
                        Vegan
                      </span>
                    )}
                    {selectedMenuItem.isGlutenFree && (
                      <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium flex items-center">
                        <span className="mr-1">🌾</span>
                        Gluten-Free
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Popularity */}
              {selectedMenuItem.popularity && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⭐</span>
                    Popularity
                  </h3>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-700 font-medium">Customer Rating</span>
                      <div className="flex items-center space-x-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span 
                              key={i}
                              className={`text-lg ${
                                i < Math.floor(selectedMenuItem.popularity) ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                            >
                              ⭐
                            </span>
                          ))}
                        </div>
                        <span className="text-purple-700 font-bold">
                          {selectedMenuItem.popularity}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedMenuItem(null)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    updateMenuItemStatus(selectedMenuItem.id, !selectedMenuItem.available)
                    setSelectedMenuItem(null)
                  }}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                    selectedMenuItem.available 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <span>{selectedMenuItem.available ? '❌' : '✅'}</span>
                  <span>{selectedMenuItem.available ? 'Mark Unavailable' : 'Mark Available'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}