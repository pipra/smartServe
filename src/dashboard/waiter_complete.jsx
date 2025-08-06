import React, { useState, useEffect } from 'react'
import { auth, db } from '../authentication/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, collection, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore'

function Waiter() {
  const [userProfile, setUserProfile] = useState(null)
  const [userFullName, setUserFullName] = useState('Waiter')
  const [activeSection, setActiveSection] = useState('dashboard')
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTableForOrders, setSelectedTableForOrders] = useState(null)
  const [showTableSelection, setShowTableSelection] = useState(false)
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [menuSearchTerm, setMenuSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [orderCustomerName, setOrderCustomerName] = useState('')
  const [orderTableNumber, setOrderTableNumber] = useState('')
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)
  const [operationInProgress, setOperationInProgress] = useState(false)

  // Error Boundary Component
  const ErrorBoundary = ({ children, onError }) => {
    const [hasError, setHasError] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
      const handleError = (error) => {
        console.error('Error caught by boundary:', error)
        setHasError(true)
        setError(error)
        if (onError) onError(error)
      }

      window.addEventListener('error', handleError)
      window.addEventListener('unhandledrejection', (event) => {
        handleError(event.reason)
      })

      return () => {
        window.removeEventListener('error', handleError)
        window.removeEventListener('unhandledrejection', handleError)
      }
    }, [onError])

    if (hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">The page encountered an error. Please try refreshing.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return children
  }

  // Utility function to safely execute operations
  const safeOperation = async (operation, errorMessage = 'Operation failed') => {
    if (operationInProgress) {
      console.log('Operation already in progress, skipping...')
      return null
    }
    
    setOperationInProgress(true)
    try {
      const result = await operation()
      return result
    } catch (error) {
      console.error(errorMessage, error)
      alert(`${errorMessage}: ${error.message}`)
      return null
    } finally {
      setOperationInProgress(false)
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        console.log('User not authenticated, redirecting to login')
        window.location.replace('/login')
        return
      }

      try {
        const waiterDoc = await getDoc(doc(db, 'Waiters', currentUser.uid))
        if (waiterDoc.exists()) {
          const userData = waiterDoc.data()
          
          if (!userData.approval || userData.status === 'pending') {
            console.log('Waiter account not approved, redirecting to login')
            sessionStorage.setItem('justLoggedOut', 'true')
            await signOut(auth)
            window.location.href = '/login'
            return
          }
          
          setUserProfile(userData)
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          setUserFullName(fullName || 'Waiter')
        } else {
          console.log('User not found in Waiters collection, redirecting to login')
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

    // Real-time listeners for all collections
    const tablesUnsubscribe = onSnapshot(collection(db, 'Tables'), (snapshot) => {
      const tablesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setTables(tablesData.sort((a, b) => a.tableNumber - b.tableNumber))
    })

    const ordersUnsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setOrders(ordersData.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt)))
    })

    const customersUnsubscribe = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCustomers(customersData)
    })

    const menuUnsubscribe = onSnapshot(collection(db, 'MenuItems'), (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setMenuItems(menuData.filter(item => item.isAvailable))
    })

    return () => {
      unsubscribe()
      tablesUnsubscribe()
      ordersUnsubscribe()
      customersUnsubscribe()
      menuUnsubscribe()
    }
  }, [])

  // Utility functions
  const handleLogout = async () => {
    await safeOperation(async () => {
      sessionStorage.setItem('justLoggedOut', 'true')
      await signOut(auth)
      window.location.href = '/login'
    }, 'Error signing out')
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    await safeOperation(async () => {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, { status: newStatus })
    }, 'Error updating order status')
  }

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'preparing': return 'bg-orange-100 text-orange-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'served': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Cart functions
  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id)
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ))
    } else {
      setCart([...cart, { ...item, quantity: 1 }])
    }
  }

  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId)
    } else {
      setCart(cart.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ))
    }
  }

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  const clearCart = () => {
    setCart([])
  }

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  // Place order function
  const placeOrder = async () => {
    if (!orderCustomerName.trim() || !orderTableNumber || cart.length === 0) {
      alert('Please fill in all required fields and add items to cart')
      return
    }

    await safeOperation(async () => {
      const orderData = {
        customerName: orderCustomerName.trim(),
        tableNumber: parseInt(orderTableNumber),
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        })),
        total: getCartTotal(),
        status: 'confirmed', // Auto-confirmed for waiter orders
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
        waiterName: userFullName
      }

      await addDoc(collection(db, 'orders'), orderData)
      
      // Clear form and cart
      setOrderCustomerName('')
      setOrderTableNumber('')
      clearCart()
      setShowPlaceOrderModal(false)
      
      alert('Order placed successfully!')
    }, 'Error placing order')
  }

  // Filter functions
  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm)
  )

  const getMenuCategories = () => {
    const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))]
    return ['all', ...categories]
  }

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(menuSearchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory && item.isAvailable
  })

  // Get pending orders count for navigation badge
  const pendingOrdersCount = orders.filter(order => 
    order.status === 'pending' || order.status === 'confirmed'
  ).length

  // Get prepared orders (ready to serve)
  const preparedOrders = orders.filter(order => order.status === 'ready')

  // Calculate total sales from confirmed orders only
  const totalSales = orders
    .filter(order => order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready' || order.status === 'served')
    .reduce((sum, order) => sum + (order.total || 0), 0)

  // Show order details function
  const showOrderDetails = (order) => {
    if (order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready' || order.status === 'served') {
      setSelectedOrderDetails(order)
      setShowOrderDetailsModal(true)
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
    <ErrorBoundary onError={(error) => console.error('Dashboard error:', error)}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-xl">🍽️</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      SmartServe
                    </span>
                    <div className="text-sm text-gray-600 font-medium">Waiter Dashboard</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveSection('dashboard')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                      activeSection === 'dashboard' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <span>📊</span>
                    <span className="hidden md:inline">Dashboard</span>
                  </button>
                  <button
                    onClick={() => setActiveSection('place-order')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                      activeSection === 'place-order' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <span>🛒</span>
                    <span className="hidden md:inline">Place Order</span>
                  </button>
                  <button
                    onClick={() => setActiveSection('customers')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                      activeSection === 'customers' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <span>👥</span>
                    <span className="hidden md:inline">Customers</span>
                  </button>
                  <button
                    onClick={() => setActiveSection('tables')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                      activeSection === 'tables' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <span>🍽️</span>
                    <span className="hidden md:inline">Tables</span>
                  </button>
                  <button
                    onClick={() => setActiveSection('orders')}
                    className={`px-4 py-2 rounded-lg transition-colors relative flex items-center space-x-2 ${
                      activeSection === 'orders' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    <span>📋</span>
                    <span className="hidden md:inline">Orders</span>
                    {pendingOrdersCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        {pendingOrdersCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveSection('profile')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                      activeSection === 'profile' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
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

        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">

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
                        <p className="text-sm font-medium text-gray-600">Total Tables</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {tables.length}
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
                        <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {pendingOrdersCount}
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
                          ₹{totalSales}
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

                {/* Prepared Orders Section */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Prepared Orders - Ready to Serve</h3>
                    <p className="text-sm text-gray-600">Orders that are ready and need to be served to customers</p>
                  </div>
                  <div className="p-6">
                    {preparedOrders.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-gray-500">No orders ready to serve at the moment</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {preparedOrders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                            <div>
                              <p className="font-medium text-gray-900">Table {order.tableNumber}</p>
                              <p className="text-sm text-gray-600">Customer: {order.customerName}</p>
                              <p className="text-sm text-gray-600">
                                Items: {order.items?.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {order.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ready to Serve
                              </span>
                              <p className="text-sm font-semibold text-gray-900 mt-1">₹{order.total}</p>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'served')}
                                className="mt-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Mark as Served
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Place Order Section */}
            {activeSection === 'place-order' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Place New Order</h2>
                  <p className="text-sm text-gray-600">Take customer orders and manage your cart</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Order Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name
                          </label>
                          <input
                            type="text"
                            value={orderCustomerName}
                            onChange={(e) => setOrderCustomerName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Enter customer name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Table Number
                          </label>
                          <select
                            value={orderTableNumber}
                            onChange={(e) => setOrderTableNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="">Select table</option>
                            {tables.map((table) => (
                              <option key={table.id} value={table.tableNumber}>
                                Table {table.tableNumber}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cart Summary */}
                        <div className="border-t pt-4">
                          <h4 className="font-medium text-gray-900 mb-2">Order Summary</h4>
                          {cart.length === 0 ? (
                            <p className="text-gray-500 text-sm">No items in cart</p>
                          ) : (
                            <div className="space-y-2">
                              {cart.map((item) => (
                                <div key={item.id} className="flex justify-between items-center text-sm">
                                  <span>{item.name} x{item.quantity}</span>
                                  <div className="flex items-center space-x-2">
                                    <span>₹{item.price * item.quantity}</span>
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <div className="border-t pt-2 font-semibold">
                                Total: ₹{getCartTotal()}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={placeOrder}
                          disabled={cart.length === 0 || !orderCustomerName.trim() || !orderTableNumber}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Place Order
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Menu Items</h3>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Search menu..."
                            value={menuSearchTerm}
                            onChange={(e) => setMenuSearchTerm(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                          <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            {getMenuCategories().map((category) => (
                              <option key={category} value={category}>
                                {category === 'all' ? 'All Categories' : category}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {filteredMenuItems.map((item) => (
                          <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-900">{item.name}</h4>
                              <span className="text-green-600 font-semibold">₹{item.price}</span>
                            </div>
                            <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                {item.category}
                              </span>
                              <button
                                onClick={() => addToCart(item)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                              >
                                Add to Cart
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {filteredMenuItems.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No menu items found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customers Section */}
            {activeSection === 'customers' && (
              <div>
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Customer Management</h2>
                    <p className="text-sm text-gray-600">View and search customer information</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">👥</div>
                      <p className="text-gray-500">No customers found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Contact
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Orders
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Spent
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredCustomers.map((customer) => {
                            const customerOrders = orders.filter(order => 
                              order.customerName?.toLowerCase() === customer.name?.toLowerCase()
                            )
                            const totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0)
                            
                            return (
                              <tr key={customer.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                  <div className="text-sm text-gray-500">{customer.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {customer.phone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {customerOrders.length} orders
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  ₹{totalSpent}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tables Section */}
            {activeSection === 'tables' && (
              <div>
                <div className="text-center mb-12">
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                    Table Management
                  </h1>
                  <p className="text-xl text-gray-600 mb-8">
                    Monitor and manage all restaurant tables
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">All Tables</h2>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  
                  {tables.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-lg">No tables available at the moment</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 max-w-6xl mx-auto">
                      {tables.map((table) => {
                        const tableOrders = orders.filter(order => order.tableNumber === table.tableNumber)
                        const activeOrders = tableOrders.filter(order => order.status !== 'served')
                        
                        return (
                          <div
                            key={table.tableNumber || table.id}
                            className="group relative aspect-square bg-white border-2 border-gray-200 rounded-2xl hover:border-indigo-400 transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col items-center justify-center text-gray-700 hover:text-indigo-600 min-h-[80px] overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                            
                            <div className="relative z-10 text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">
                              🍽️
                            </div>
                            
                            <div className="relative z-10 text-lg font-bold group-hover:text-indigo-700 transition-colors duration-300">
                              {table.tableNumber}
                            </div>
                            
                            <div className="absolute top-2 right-2 z-10">
                              <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                                table.status === 'available' ? 'bg-green-400' :
                                table.status === 'occupied' ? 'bg-red-400' :
                                table.status === 'reserved' ? 'bg-yellow-400' :
                                'bg-gray-400'
                              }`}></div>
                            </div>
                            
                            {activeOrders.length > 0 && (
                              <div className="absolute top-2 left-2 z-10">
                                <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  {activeOrders.length}
                                </span>
                              </div>
                            )}
                            
                            <div className="relative z-10 text-xs text-gray-500 mt-1 capitalize">
                              {table.status}
                            </div>
                            
                            {table.capacity && (
                              <div className="relative z-10 text-xs text-gray-400">
                                {table.capacity} seats
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Table Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                  <div className="bg-white rounded-lg shadow p-6 text-center">
                    <div className="text-3xl mb-2">🍽️</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Total Tables</h3>
                    <p className="text-2xl font-bold text-indigo-600">{tables.length}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6 text-center">
                    <div className="text-3xl mb-2">✅</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Available</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {tables.filter(table => table.status === 'available').length}
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6 text-center">
                    <div className="text-3xl mb-2">👥</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Occupied</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {tables.filter(table => table.status === 'occupied').length}
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6 text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Reserved</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                      {tables.filter(table => table.status === 'reserved').length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Section */}
            {activeSection === 'orders' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Order Management</h2>
                  <p className="text-sm text-gray-600">View and manage all restaurant orders</p>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {orders.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-6xl mb-4">📋</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No Orders Yet</h3>
                      <p className="text-gray-600">Orders will appear here once they are placed.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Order
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Customer & Table
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">#{order.id.slice(-6)}</div>
                                <div className="text-sm text-gray-500">
                                  {order.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                                <div className="text-sm text-gray-500">Table {order.tableNumber}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {order.items?.map(item => `${item.name} (x${item.quantity})`).join(', ') || 'No items'}
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
                                  <button
                                    onClick={() => showOrderDetails(order)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900">User Profile</h2>
                  <p className="text-sm text-gray-600">View and manage your account information</p>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-2xl">👤</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{userFullName}</h3>
                        <p className="text-green-600 font-medium">{userProfile?.shift || 'Waiter'} Shift</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Personal Information */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Personal Information</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-600">First Name</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              {userProfile?.firstName || 'Not provided'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Last Name</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              {userProfile?.lastName || 'Not provided'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Email</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              {userProfile?.email || 'Not provided'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Phone</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              {userProfile?.phone || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Work Information */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Work Information</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-600">Position</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              Waiter
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Shift</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1 capitalize">
                              {userProfile?.shift || 'Not assigned'}
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Status</label>
                            <div className="mt-1">
                              <span className={`inline-flex px-3 py-2 rounded-full text-sm font-medium ${
                                userProfile?.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {userProfile?.status === 'active' ? '✅ Approved' : '⏳ Pending'}
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600">Employee ID</label>
                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg mt-1">
                              {userProfile?.employeeId || 'Not assigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button
                          onClick={() => setActiveSection('dashboard')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <span>📊</span>
                          <span>Back to Dashboard</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <span>🚪</span>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Details Modal */}
            {showOrderDetailsModal && selectedOrderDetails && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
                    <button
                      onClick={() => setShowOrderDetailsModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Order ID</label>
                        <p className="text-gray-900">#{selectedOrderDetails.id.slice(-6)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(selectedOrderDetails.status)}`}>
                          {selectedOrderDetails.status}
                        </span>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Customer</label>
                        <p className="text-gray-900">{selectedOrderDetails.customerName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Table</label>
                        <p className="text-gray-900">Table {selectedOrderDetails.tableNumber}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Waiter</label>
                        <p className="text-gray-900">{selectedOrderDetails.waiterName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Order Time</label>
                        <p className="text-gray-900">
                          {selectedOrderDetails.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">Items Ordered</label>
                      <div className="mt-2 space-y-2">
                        {selectedOrderDetails.items?.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>{item.name} x {item.quantity}</span>
                            <span className="font-medium">₹{item.total || (item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-semibold">
                        <span>Total Amount:</span>
                        <span>₹{selectedOrderDetails.total}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg">
                      ⚠️ This order is confirmed and cannot be edited or cancelled.
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default Waiter
