import React, { useState, useEffect } from 'react'
import { db, auth } from '../../services/firebase/config.js'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { signOut, onAuthStateChanged } from 'firebase/auth'

function Cashier() {
  const [activeTab, setActiveTab] = useState('pos')
  const [orders, setOrders] = useState([])
  const [confirmedOrders, setConfirmedOrders] = useState([])
  const [selectedWaiter, setSelectedWaiter] = useState(null)
  const [selectedOrderForBilling, setSelectedOrderForBilling] = useState(null)
  const [userFullName, setUserFullName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchConfirmedOrders()
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // User not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login')
        window.location.replace('/login')
        return
      }

      try {
        // Check Cashiers collection
        const cashierDoc = await getDoc(doc(db, 'Cashiers', user.uid))
        if (cashierDoc.exists()) {
          const userData = cashierDoc.data()
          
          // Check if cashier is approved
          if (!userData.approval || userData.status === 'pending') {
            console.log('Cashier account not approved, redirecting to login')
            sessionStorage.setItem('justLoggedOut', 'true')
            await signOut(auth)
            window.location.href = '/login'
            return
          }
          
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          setUserFullName(fullName || 'Cashier')
        } else {
          // User doesn't exist in Cashiers collection
          console.log('User not found in Cashiers collection, redirecting to login')
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
  }

  const fetchOrders = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, 'Orders'))
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setOrders(ordersData.sort((a, b) => {
        const aTime = a.timestamp || a.createdAt
        const bTime = b.timestamp || b.createdAt
        return new Date(bTime) - new Date(aTime)
      }))
    } catch (error) {
      console.error('Error fetching orders:', error)
    }
  }

  const fetchConfirmedOrders = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, 'Orders'))
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Debug: Log all orders to see their structure
      console.log('All orders:', ordersData)
      
      // Filter orders that are NOT pending or cancelled or completed - only show orders ready for billing
      const confirmedOrdersData = ordersData.filter(order => {
        // Order must have a status and it should not be pending, cancelled, or completed
        if (!order.status) {
          return false // Orders without status are not ready for billing
        }
        
        return order.status !== 'pending' && 
               order.status !== 'cancelled' &&
               order.status !== 'completed' // Don't show already completed orders
      })
      
      // Debug: Log filtered orders
      console.log('Confirmed orders for billing:', confirmedOrdersData)
      
      setConfirmedOrders(confirmedOrdersData.sort((a, b) => {
        const aTime = a.timestamp || a.createdAt
        const bTime = b.timestamp || b.createdAt
        return new Date(bTime) - new Date(aTime)
      }))
    } catch (error) {
      console.error('Error fetching confirmed orders:', error)
    }
  }

  const processOrderBill = async (orderId) => {
    try {
      setLoading(true)
      await updateDoc(doc(db, 'Orders', orderId), {
        status: 'billing',
        billedBy: userFullName,
        billedAt: new Date().toISOString()
      })
      
      // Update local state immediately to show Mark Complete button without waiting for refresh
      setConfirmedOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: 'billing', billedBy: userFullName, billedAt: new Date().toISOString() }
            : order
        )
      )
      
      // Also update the main orders state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: 'billing', billedBy: userFullName, billedAt: new Date().toISOString() }
            : order
        )
      )
      
      alert('Order bill processed successfully!')
      setSelectedOrderForBilling(null)
    } catch (error) {
      console.error('Error processing bill:', error)
      alert('Error processing bill. Please try again.')
    }
    setLoading(false)
  }

  const markOrderCompleted = async (orderId) => {
    try {
      setLoading(true)
      await updateDoc(doc(db, 'Orders', orderId), {
        status: 'completed',
        completedBy: 'cashier',
        completedAt: new Date().toISOString()
      })
      
      // Refresh orders
      fetchConfirmedOrders()
      fetchOrders()
      
      alert('Order marked as completed successfully!')
      setSelectedOrderForBilling(null)
    } catch (error) {
      console.error('Error marking order as completed:', error)
      alert('Error completing order. Please try again.')
    }
    setLoading(false)
  }

  const completeAllUserOrders = async (userOrders) => {
    try {
      setLoading(true)
      
      // First, process bills for any orders that haven't been billed yet
      const unbilledOrders = userOrders.filter(order => 
        !order.status || order.status === 'confirmed' || order.status === 'ready'
      )
      
      // Process bills for unbilled orders
      for (const order of unbilledOrders) {
        await updateDoc(doc(db, 'Orders', order.id), {
          status: 'billing',
          billedBy: userFullName,
          billedAt: new Date().toISOString()
        })
      }
      
      // Then mark all orders as completed
      for (const order of userOrders) {
        await updateDoc(doc(db, 'Orders', order.id), {
          status: 'completed',
          completedBy: 'cashier',
          completedAt: new Date().toISOString()
        })
      }
      
      // Refresh orders
      fetchConfirmedOrders()
      fetchOrders()
      
      alert(`All ${userOrders.length} orders completed successfully! ${unbilledOrders.length > 0 ? `(${unbilledOrders.length} orders were billed first)` : ''}`)
    } catch (error) {
      console.error('Error completing all orders:', error)
      alert('Error completing orders. Please try again.')
    }
    setLoading(false)
  }

  const getWaiterOrders = (userName) => {
    return confirmedOrders.filter(order => 
      order.customerName === userName ||
      order.waiterName === userName || 
      order.placedBy === userName ||
      order.confirmedBy === userName
    )
  }

  const getOrdersByUser = () => {
    const groupedOrders = {}
    confirmedOrders.forEach(order => {
      // Prioritize customer name for grouping, fallback to waiter name if no customer
      const userName = order.customerName || 
                     order.waiterName || 
                     order.placedBy ||
                     order.confirmedBy ||
                     'Unknown User'
      
      if (!groupedOrders[userName]) {
        groupedOrders[userName] = []
      }
      groupedOrders[userName].push(order)
    })
    return groupedOrders
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-teal-100">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-xl">💰</span>
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                    SmartServe
                  </span>
                  <div className="text-sm text-gray-600 font-medium">Cashier Dashboard</div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Navigation Items */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('pos')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'pos' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:text-teal-600 hover:bg-teal-50'
                  }`}
                >
                  <span>🧾</span>
                  <span className="hidden md:inline">Billing & Orders</span>
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'orders' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:text-teal-600 hover:bg-teal-50'
                  }`}
                >
                  <span>📋</span>
                  <span className="hidden md:inline">Order History</span>
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'profile' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:text-teal-600 hover:bg-teal-50'
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
          
          {/* Billing & Orders Tab */}
          {activeTab === 'pos' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <span className="mr-3">🧾</span>
                        Two-Step Billing Process
                      </h2>
                      <p className="text-gray-600 mt-1">Step 1: Process Bill → Step 2: Mark Complete → Order History</p>
                    </div>
                    <button
                      onClick={fetchConfirmedOrders}
                      className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
                    >
                      <span>🔄</span>
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Waiter Filter and Order Summary */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900">Pending Orders</h3>
                      <p className="text-2xl font-bold text-blue-600">{confirmedOrders.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-900">Today's Revenue</h3>
                      <p className="text-2xl font-bold text-green-600">
                        ৳{orders.filter(order => 
                          order.status === 'completed' && 
                          new Date(order.createdAt).toDateString() === new Date().toDateString()
                        ).reduce((total, order) => total + (order.totalAmount || order.total || 0), 0).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-purple-900">Orders Completed</h3>
                      <p className="text-2xl font-bold text-purple-600">
                        {orders.filter(order => 
                          order.status === 'completed' && 
                          new Date(order.createdAt).toDateString() === new Date().toDateString()
                        ).length}
                      </p>
                    </div>
                  </div>

                  {/* Waiter Selection */}
                  {selectedWaiter && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-yellow-900">
                            Viewing orders from: {selectedWaiter}
                          </h3>
                          <p className="text-yellow-700">
                            {getWaiterOrders(selectedWaiter).length} orders found
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedWaiter(null)}
                          className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          Show All Orders
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedWaiter ? `Orders from ${selectedWaiter}` : 'Users with Confirmed Orders'}
                    </h3>
                    <div className="text-sm text-gray-600">
                      {selectedWaiter ? `${getWaiterOrders(selectedWaiter).length} orders` : `${Object.keys(getOrdersByUser()).length} users`}
                    </div>
                  </div>
                </div>

                {confirmedOrders.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <div className="text-4xl mb-4">📝</div>
                    <p className="text-lg">No confirmed orders to process</p>
                    <p className="text-sm mt-2">Orders confirmed by waiters will appear here</p>
                  </div>
                ) : selectedWaiter ? (
                  // Show detailed orders for selected user
                  <div>
                    {/* User Summary Header */}
                    <div className="p-6 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-2xl">
                              {selectedWaiter.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">{selectedWaiter}</h2>
                            <div className="flex items-center space-x-6 mt-2">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-teal-600">
                                  {getWaiterOrders(selectedWaiter).length}
                                </p>
                                <p className="text-sm text-gray-600">Orders</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">
                                  ৳{Math.round(getWaiterOrders(selectedWaiter).reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0))}
                                </p>
                                <p className="text-sm text-gray-600">Total Amount</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedWaiter(null)}
                          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 shadow-lg"
                        >
                          <span>⬅️</span>
                          <span>Back to Users</span>
                        </button>
                      </div>
                    </div>

                    {/* Orders List for Selected User */}
                    <div className="divide-y divide-gray-200">
                      {getWaiterOrders(selectedWaiter).map((order) => (
                        <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-3">
                                <div>
                                  <h4 className="text-lg font-semibold text-gray-900">
                                    Order #{order.id.substring(0, 8)}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 
                                     order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                                  </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  order.status === 'billing' ? 'bg-purple-100 text-purple-800' :
                                  order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'ready' ? 'bg-green-100 text-green-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {order.status === 'billing' ? '💳 Billing' :
                                   order.status === 'confirmed' ? '🔄 Confirmed' :
                                   order.status === 'ready' ? '🍳 Ready' :
                                   order.status || 'Confirmed'}
                                </span>
                                {/* Table Information */}
                                <div className="bg-blue-50 px-3 py-1 rounded-lg">
                                  <p className="text-sm font-medium text-blue-900">
                                    Table: {order.tableNumber || order.customerInfo?.tableNumber || order.table || 'Not specified'}
                                  </p>
                                </div>
                              </div>

                              {/* Order Items - Main Focus */}
                              <div className="mb-4">
                                <h5 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h5>
                                <div className="space-y-3">
                                  {order.items?.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex-1">
                                        <h6 className="text-lg font-semibold text-gray-900">{item.name}</h6>
                                        <p className="text-sm text-gray-600">৳{item.price} per item</p>
                                        <div className="flex items-center space-x-2 mt-1">
                                          <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded-full text-xs font-medium">
                                            Quantity: {item.quantity}
                                          </span>
                                          {item.category && (
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                                              {item.category}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="text-xl font-bold text-teal-600">
                                          ৳{Math.round((item.price * item.quantity))}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {item.quantity} × ৳{item.price}
                                        </p>
                                      </div>
                                    </div>
                                  )) || (
                                    <div className="text-center py-8">
                                      <p className="text-gray-500 text-lg">No items in this order</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-teal-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <span className="text-lg font-semibold text-gray-900">Order Total:</span>
                                  <span className="text-2xl font-bold text-teal-600">
                                    ৳{Math.round(order.totalAmount || order.total || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="ml-6 flex flex-col space-y-3">
                              {/* No buttons in individual order view - all processing done from main page */}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Show users summary with total cost and action buttons
                  <div className="divide-y divide-gray-200">
                    {Object.entries(getOrdersByUser()).map(([userName, userOrders]) => {
                      const totalCost = userOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
                      const orderCount = userOrders.length;
                      
                      // Check if user has orders that need billing
                      const hasPendingBills = userOrders.some(order => 
                        !order.status || order.status === 'confirmed' || order.status === 'ready'
                      );
                      const hasBilledOrders = userOrders.some(order => order.status === 'billing');
                      
                      return (
                        <div key={userName} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            {/* User Info Section */}
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-lg">
                                  {userName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-xl font-bold text-gray-900">{userName}</h4>
                                <div className="flex items-center space-x-6 mt-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Orders:</span>
                                    <span className="font-semibold text-blue-600 text-lg">{orderCount}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons Section */}
                            <div className="flex items-center space-x-3">
                              {/* View Orders Button */}
                              <button
                                onClick={() => setSelectedWaiter(userName)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-lg"
                              >
                                <span>👁️</span>
                                <span>View Orders</span>
                              </button>

                              {/* Process Bill Button - only show if there are orders that need billing */}
                              {hasPendingBills && (
                                <button
                                  onClick={() => {
                                    // Find first order that needs billing and process it directly
                                    const orderToBill = userOrders.find(order => 
                                      !order.status || order.status === 'confirmed' || order.status === 'ready'
                                    );
                                    if (orderToBill) processOrderBill(orderToBill.id);
                                  }}
                                  disabled={loading}
                                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center space-x-2 shadow-lg"
                                >
                                  <span>💳</span>
                                  <span>Process Bill</span>
                                </button>
                              )}

                              {/* Complete All Button - only show if there are billed orders */}
                              {hasBilledOrders && (
                                <button
                                  onClick={() => completeAllUserOrders(userOrders)}
                                  disabled={loading}
                                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center space-x-2 shadow-lg"
                                >
                                  <span>✅</span>
                                  <span>Mark Complete</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Preview of Recent Orders */}
                          <div className="mt-4 pl-16">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm text-gray-600">Recent Orders:</p>
                              <div className="bg-green-50 px-3 py-1 rounded-lg">
                                <p className="text-sm font-bold text-green-700">
                                  Total Amount: ৳{Math.round(totalCost)}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {userOrders.slice(0, 3).map((order) => (
                                <div key={order.id} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                                  <span className="text-gray-700">#{order.id.substring(0, 6)}</span>
                                  <span className="text-teal-600 font-medium">৳{Math.round(order.totalAmount || order.total || 0)}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    order.status === 'billing' ? 'bg-purple-100 text-purple-800' :
                                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                    order.status === 'ready' ? 'bg-green-100 text-green-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {order.status === 'billing' ? '💳' :
                                     order.status === 'confirmed' ? '🔄' :
                                     order.status === 'ready' ? '🍳' :
                                     '⏳'}
                                  </span>
                                </div>
                              ))}
                              {userOrders.length > 3 && (
                                <div className="bg-teal-100 px-3 py-1 rounded-full text-sm text-teal-700">
                                  +{userOrders.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Billing Modal */}
              {selectedOrderForBilling && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-900">
                          Order Details - Order #{selectedOrderForBilling.id.substring(0, 8)}
                        </h3>
                        <button
                          onClick={() => setSelectedOrderForBilling(null)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <span className="text-2xl">×</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Table Information */}
                      <div className="mb-6">
                        <div className="flex items-center justify-center mb-4">
                          <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-2 rounded-full text-lg font-bold">
                            🍽️ {selectedOrderForBilling.tableNumber || selectedOrderForBilling.customerInfo?.tableNumber || selectedOrderForBilling.table || 'Table Not Specified'}
                          </span>
                        </div>
                        
                        {/* Order Status */}
                        <div className="flex items-center justify-center">
                          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                            selectedOrderForBilling.status === 'completed' ? 'bg-green-100 text-green-800' :
                            selectedOrderForBilling.status === 'billed' ? 'bg-purple-100 text-purple-800' :
                            selectedOrderForBilling.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            selectedOrderForBilling.status === 'ready' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedOrderForBilling.status === 'completed' ? '✅ Completed' :
                             selectedOrderForBilling.status === 'billed' ? '💳 Billed' :
                             selectedOrderForBilling.status === 'confirmed' ? '🔄 Confirmed' :
                             selectedOrderForBilling.status === 'ready' ? '🍳 Ready' :
                             '⏳ Processing'}
                          </span>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-4 text-center">Order Items</h4>
                        <div className="space-y-3">
                          {selectedOrderForBilling.items?.map((item, index) => (
                            <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4 shadow-sm">
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <h5 className="font-bold text-gray-900 text-lg">{item.name}</h5>
                                  <p className="text-teal-600 font-medium">৳{item.price} per item</p>
                                </div>
                                <div className="text-right">
                                  <div className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium mb-2">
                                    Qty: {item.quantity}
                                  </div>
                                  <p className="text-lg font-bold text-gray-900">৳{Math.round((item.price * item.quantity))}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 pt-4 border-t-2 border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xl font-bold text-gray-900">Total Amount:</span>
                            <span className="text-2xl font-bold text-teal-600">৳{Math.round(selectedOrderForBilling.totalAmount || selectedOrderForBilling.total || 0)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-4">
                        {/* Show Process Bill if order hasn't been billed yet */}
                        {(!selectedOrderForBilling.status || selectedOrderForBilling.status === 'confirmed' || selectedOrderForBilling.status === 'ready') && (
                          <button
                            onClick={() => processOrderBill(selectedOrderForBilling.id)}
                            disabled={loading}
                            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {loading ? 'Processing...' : '💳 Process Bill'}
                          </button>
                        )}
                        
                        {/* Show Mark Complete if order has been billed */}
                        {selectedOrderForBilling.status === 'billed' && (
                          <button
                            onClick={() => markOrderCompleted(selectedOrderForBilling.id)}
                            disabled={loading}
                            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                          >
                            {loading ? 'Processing...' : '✅ Mark Complete'}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSelectedOrderForBilling(null)}
                          className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order History Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <span className="mr-3">📋</span>
                        Order History
                      </h2>
                      <p className="text-gray-600 mt-1">Recent completed transactions and order details</p>
                    </div>
                    <button
                      onClick={fetchOrders}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                    >
                      <span>🔄</span>
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-900">Total Completed</h3>
                      <p className="text-2xl font-bold text-green-600">
                        {orders.filter(order => order.status === 'completed').length}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900">Today's Orders</h3>
                      <p className="text-2xl font-bold text-blue-600">
                        {orders.filter(order => 
                          order.status === 'completed' && 
                          new Date(order.completedAt || order.createdAt || order.timestamp?.toDate()).toDateString() === new Date().toDateString()
                        ).length}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-purple-900">Total Revenue</h3>
                      <p className="text-2xl font-bold text-purple-600">
                        ৳{orders.filter(order => order.status === 'completed')
                          .reduce((total, order) => total + (order.totalAmount || order.total || 0), 0).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <h3 className="font-semibold text-orange-900">Avg Order Value</h3>
                      <p className="text-2xl font-bold text-orange-600">
                        ৳{orders.filter(order => order.status === 'completed').length > 0 ? 
                          (orders.filter(order => order.status === 'completed')
                            .reduce((total, order) => total + (order.totalAmount || order.total || 0), 0) / 
                           orders.filter(order => order.status === 'completed').length).toFixed(0) : '0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-gray-900">Recent Completed Orders</h3>
                    <div className="text-sm text-gray-600">
                      {orders.filter(order => order.status === 'completed').length} completed orders
                    </div>
                  </div>
                </div>

                {orders.filter(order => order.status === 'completed').length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-xl mb-2">No completed orders yet</p>
                    <p className="text-sm">Completed orders will appear here after processing</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {orders.filter(order => order.status === 'completed')
                      .sort((a, b) => {
                        const aTime = new Date(a.completedAt || a.createdAt || a.timestamp?.toDate())
                        const bTime = new Date(b.completedAt || b.createdAt || b.timestamp?.toDate())
                        return bTime - aTime
                      })
                      .map((order) => (
                        <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            {/* Order Info */}
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-lg">✅</span>
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">
                                  Order #{order.id.substring(0, 8)}
                                </h4>
                                <div className="flex items-center space-x-4 mt-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Customer:</span>
                                    <span className="font-medium text-gray-900">
                                      {order.customerName || order.customerInfo?.name || order.waiterName || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Table:</span>
                                    <span className="font-medium text-blue-600">
                                      {order.tableNumber || order.customerInfo?.tableNumber || order.table || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Items:</span>
                                    <span className="font-medium text-purple-600">
                                      {order.items?.length || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Order Details */}
                            <div className="text-right space-y-1">
                              <div className="text-2xl font-bold text-green-600">
                                ৳{Math.round((order.totalAmount || order.total || 0))}
                              </div>
                              <div className="text-sm text-gray-500">
                                Completed: {order.completedAt ? 
                                  new Date(order.completedAt).toLocaleString() : 
                                  order.createdAt ? new Date(order.createdAt).toLocaleString() :
                                  order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'N/A'}
                              </div>
                              <div className="text-xs text-gray-400">
                                Processed by: {order.completedBy || order.billedBy || 'System'}
                              </div>
                            </div>
                          </div>

                          {/* Order Items Preview */}
                          <div className="mt-4 pl-16">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gray-600">Order Items:</p>
                              <div className="flex space-x-2">
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                  ✅ Completed
                                </span>
                                {order.billedAt && (
                                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                    💳 Billed
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {order.items?.slice(0, 4).map((item, index) => (
                                <div key={index} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                                  <span className="text-gray-700">{item.name}</span>
                                  <span className="text-xs text-gray-500">×{item.quantity}</span>
                                  <span className="text-teal-600 font-medium">৳{Math.round((item.price * item.quantity))}</span>
                                </div>
                              )) || (
                                <span className="text-gray-400 text-sm">No items listed</span>
                              )}
                              {order.items?.length > 4 && (
                                <div className="bg-gray-200 px-3 py-1 rounded-full text-sm text-gray-600">
                                  +{order.items.length - 4} more items
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Payment & Timing Info */}
                          <div className="mt-3 pl-16">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
                              <div>
                                <span className="font-medium">Payment:</span> {order.paymentMethod || 'Cash'}
                              </div>
                              <div>
                                <span className="font-medium">Order Time:</span> {
                                  order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() :
                                  order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'
                                }
                              </div>
                              <div>
                                <span className="font-medium">Processing Time:</span> {
                                  order.completedAt && (order.timestamp || order.createdAt) ? 
                                  Math.round((new Date(order.completedAt) - new Date(order.timestamp?.toDate() || order.createdAt)) / (1000 * 60)) + ' mins' :
                                  'N/A'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl shadow-lg overflow-hidden">
                <div className="px-8 py-6 text-white relative">
                  <div className="absolute inset-0 bg-black bg-opacity-10"></div>
                  <div className="relative z-10 flex items-center space-x-6">
                    <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-4xl">💰</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">{userFullName}</h2>
                      <p className="text-teal-100 text-lg">Cashier - SmartServe POS</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          ✅ Active
                        </span>
                        <span className="text-teal-100 text-sm">
                          Today: {new Date().toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Personal Information */}
                <div className="lg:col-span-2">
                  <div className="bg-white shadow-lg rounded-xl border border-gray-200">
                    <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <span className="mr-3">👤</span>
                        Personal Information
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            {userFullName}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            CSH-001
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            Point of Sale
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            Morning (9:00 AM - 5:00 PM)
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            +880 1712-345678
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Join Date</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900">
                            January 15, 2024
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions & Settings */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="bg-white shadow-lg rounded-xl border border-gray-200">
                    <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <span className="mr-3">⚡</span>
                        Quick Actions
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-3">
                      <button
                        onClick={() => setActiveTab('pos')}
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">🧾</span>
                        <span>Back to Billing</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">📋</span>
                        <span>View Orders</span>
                      </button>
                      
                      <button
                        onClick={async () => {
                          try {
                            // Set logout flag to prevent auto-redirect
                            sessionStorage.setItem('justLoggedOut', 'true')
                            await signOut(auth)
                            window.location.href = '/'
                          } catch (error) {
                            console.error('Error signing out:', error)
                          }
                        }}
                        className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">🚪</span>
                        <span>Sign Out</span>
                      </button>
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

export default Cashier
