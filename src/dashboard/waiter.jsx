import React, { useState, useEffect } from 'react'
import { auth, db } from '../authentication/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

function Waiter() {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          setUserProfile(userDoc.data())
        }
        loadDashboardData()
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const loadDashboardData = () => {
    // Mock data - in a real app, this would come from Firestore
    setTables([
      { id: 1, number: 'T1', status: 'occupied', customers: 4, waiter: 'current' },
      { id: 2, number: 'T2', status: 'available', customers: 0, waiter: null },
      { id: 3, number: 'T3', status: 'reserved', customers: 2, waiter: 'current' },
      { id: 4, number: 'T4', status: 'occupied', customers: 6, waiter: 'other' },
      { id: 5, number: 'T5', status: 'cleaning', customers: 0, waiter: null },
      { id: 6, number: 'T6', status: 'available', customers: 0, waiter: null },
    ])

    setOrders([
      { id: 1, table: 'T1', items: ['Chicken Tikka', 'Naan', 'Rice'], status: 'preparing', total: 450, time: '10 min ago' },
      { id: 2, table: 'T3', items: ['Fish Curry', 'Chapati'], status: 'ready', total: 320, time: '5 min ago' },
      { id: 3, table: 'T1', items: ['Lassi', 'Papad'], status: 'served', total: 80, time: '15 min ago' },
    ])
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      window.location.href = '/login'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ))
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'occupied': return 'bg-blue-100 text-blue-800'
      case 'reserved': return 'bg-yellow-100 text-yellow-800'
      case 'cleaning': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'preparing': return 'bg-yellow-100 text-yellow-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'served': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Waiter Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {userProfile?.name || user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Navigation Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveSection('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'dashboard'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveSection('tables')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'tables'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Table Management
              </button>
              <button
                onClick={() => setActiveSection('orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === 'orders'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Orders
              </button>
            </nav>
          </div>

          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">My Tables</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {tables.filter(t => t.waiter === 'current').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Active Orders</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {orders.filter(o => o.status !== 'served').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        ₹{orders.reduce((sum, order) => sum + order.total, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Shift</p>
                      <p className="text-2xl font-semibold text-gray-900 capitalize">
                        {userProfile?.shift || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {orders.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">Table {order.table}</p>
                          <p className="text-sm text-gray-600">{order.items.join(', ')}</p>
                          <p className="text-xs text-gray-500">{order.time}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">₹{order.total}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tables Section */}
          {activeSection === 'tables' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900">Table Management</h2>
                <p className="text-sm text-gray-600">Manage your assigned tables and view their status</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tables.map((table) => (
                  <div key={table.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Table {table.number}</h3>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(table.status)}`}>
                        {table.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Customers: <span className="font-medium">{table.customers}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Assigned to: <span className="font-medium">
                          {table.waiter === 'current' ? 'You' : table.waiter === 'other' ? 'Other waiter' : 'Unassigned'}
                        </span>
                      </p>
                    </div>

                    {table.waiter === 'current' && (
                      <div className="mt-4 space-y-2">
                        <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          Take Order
                        </button>
                        <button className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders Section */}
          {activeSection === 'orders' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900">Order Management</h2>
                <p className="text-sm text-gray-600">Track and manage all your orders</p>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Table
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Items
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{order.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {order.table}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {order.items.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ₹{order.total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {order.status === 'ready' && (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'served')}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                >
                                  Mark Served
                                </button>
                              )}
                              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Waiter