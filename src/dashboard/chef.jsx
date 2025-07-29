import React, { useState, useEffect } from 'react'
import { auth, db } from '../authentication/firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export default function ChefDashboard() {
  const [activeSection, setActiveSection] = useState('orders')
  const [userFullName, setUserFullName] = useState('Chef')
  const [orders, setOrders] = useState([
    { id: 1, table: 'Table 5', items: ['Pasta Carbonara', 'Caesar Salad'], status: 'preparing', time: '15 mins', priority: 'normal' },
    { id: 2, table: 'Table 2', items: ['Grilled Salmon', 'Steamed Vegetables'], status: 'ready', time: '5 mins', priority: 'high' },
    { id: 3, table: 'Table 8', items: ['Pizza Margherita', 'Garlic Bread'], status: 'pending', time: '20 mins', priority: 'normal' },
    { id: 4, table: 'Table 1', items: ['Beef Steak', 'Mashed Potatoes'], status: 'preparing', time: '12 mins', priority: 'urgent' }
  ])

  const stats = {
    totalOrders: 12,
    completedToday: 8,
    inProgress: 4,
    averageTime: '18 mins'
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
    })

    return () => unsubscribe()
  }, [])

  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ))
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'preparing': return 'bg-blue-100 text-blue-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'served': return 'bg-gray-100 text-gray-800'
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

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-orange-900">Chef Dashboard</h1>
              <p className="text-orange-600">Kitchen Management System</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-orange-600">Welcome, {userFullName}</span>
              <button 
                onClick={async () => {
                  try {
                    // Set logout flag to prevent auto-redirect
                    sessionStorage.setItem('justLoggedOut', 'true')
                    await signOut(auth)
                    window.location.href = '/login'
                  } catch (error) {
                    console.error('Error signing out:', error)
                  }
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'orders', label: 'Kitchen Orders', icon: '🍳' },
              { id: 'menu', label: 'Menu Management', icon: '📋' },
              { id: 'inventory', label: 'Inventory', icon: '📦' },
              { id: 'stats', label: 'Statistics', icon: '📊' }
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeSection === section.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">Total Orders</h3>
              <p className="text-3xl font-bold text-orange-600">{stats.totalOrders}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Completed Today</h3>
              <p className="text-3xl font-bold text-green-600">{stats.completedToday}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">In Progress</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Avg. Prep Time</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.averageTime}</p>
            </div>
          </div>

          {/* Kitchen Orders Section */}
          {activeSection === 'orders' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Kitchen Orders</h2>
                <p className="text-gray-600">Manage incoming and current orders</p>
              </div>
              
              <div className="p-6">
                <div className="grid gap-4">
                  {orders.map((order) => (
                    <div 
                      key={order.id} 
                      className={`bg-gray-50 p-4 rounded-lg ${getPriorityColor(order.priority)}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{order.table}</h3>
                          <p className="text-sm text-gray-600">Order #{order.id} • {order.time}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            order.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.priority}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Items:</h4>
                        <ul className="space-y-1">
                          {order.items.map((item, index) => (
                            <li key={index} className="text-gray-700 flex items-center">
                              <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="flex space-x-2">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            Start Preparing
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'served')}
                            className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                          >
                            Mark Served
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Menu Management Section */}
          {activeSection === 'menu' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Menu Management</h2>
                <p className="text-gray-600">Manage dishes and availability</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { name: 'Pasta Carbonara', category: 'Main Course', available: true, price: '$18' },
                    { name: 'Grilled Salmon', category: 'Main Course', available: true, price: '$24' },
                    { name: 'Caesar Salad', category: 'Appetizer', available: false, price: '$12' },
                    { name: 'Chocolate Cake', category: 'Dessert', available: true, price: '$8' }
                  ].map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.available ? 'Available' : 'Out of Stock'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.category}</p>
                      <p className="text-lg font-bold text-orange-600 mb-3">{item.price}</p>
                      <button className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700 transition-colors">
                        {item.available ? 'Mark Unavailable' : 'Mark Available'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Inventory Section */}
          {activeSection === 'inventory' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Kitchen Inventory</h2>
                <p className="text-gray-600">Track ingredient levels</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { name: 'Tomatoes', level: 85, unit: 'kg', status: 'good' },
                    { name: 'Chicken Breast', level: 45, unit: 'kg', status: 'medium' },
                    { name: 'Pasta', level: 15, unit: 'kg', status: 'low' },
                    { name: 'Olive Oil', level: 92, unit: 'L', status: 'good' },
                    { name: 'Cheese', level: 25, unit: 'kg', status: 'low' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.level}% remaining</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              item.status === 'good' ? 'bg-green-500' :
                              item.status === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${item.level}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{item.level}{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Statistics Section */}
          {activeSection === 'stats' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Kitchen Statistics</h2>
                <p className="text-gray-600">Performance metrics and insights</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Today's Performance</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Orders Completed</span>
                        <span className="font-medium">8/12</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Prep Time</span>
                        <span className="font-medium">18 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fastest Order</span>
                        <span className="font-medium">8 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer Rating</span>
                        <span className="font-medium">4.8/5.0</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Popular Dishes</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pasta Carbonara</span>
                        <span className="font-medium">12 orders</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Grilled Salmon</span>
                        <span className="font-medium">8 orders</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Caesar Salad</span>
                        <span className="font-medium">6 orders</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pizza Margherita</span>
                        <span className="font-medium">5 orders</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}