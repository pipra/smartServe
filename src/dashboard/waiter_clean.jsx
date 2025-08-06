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
      console.log('Menu items fetched from Firestore:', menuData)
      const availableItems = menuData.filter(item => item.isAvailable)
      console.log('Available menu items:', availableItems)
      setMenuItems(availableItems)
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
    console.log('Adding to cart:', item)
    const existingItem = cart.find(cartItem => cartItem.id === item.id)
    if (existingItem) {
      console.log('Item exists in cart, updating quantity')
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ))
    } else {
      console.log('New item, adding to cart')
      setCart([...cart, { ...item, quantity: 1 }])
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
    console.log('Place order called')
    console.log('Customer name:', orderCustomerName)
    console.log('Table number:', orderTableNumber)
    console.log('Cart:', cart)
    
    // Validation checks
    if (!orderCustomerName.trim()) {
      alert('Please enter customer name')
      return
    }
    
    if (!orderTableNumber) {
      alert('Please select a table')
      return
    }
    
    if (cart.length === 0) {
      alert('Please add items to cart')
      return
    }

    // Check if selected table is still available
    const selectedTable = tables.find(table => table.tableNumber.toString() === orderTableNumber.toString())
    if (!selectedTable || selectedTable.status !== 'available') {
      alert('Selected table is no longer available. Please choose another table.')
      setOrderTableNumber('')
      return
    }

    console.log('Starting order placement...')
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

      console.log('Order data:', orderData)
      await addDoc(collection(db, 'orders'), orderData)
      console.log('Order added to Firestore successfully')
      
      // Clear form and cart
      setOrderCustomerName('')
      setOrderTableNumber('')
      clearCart()
      
      alert(`Order placed successfully for ${orderCustomerName.trim()} at Table ${orderTableNumber}!`)
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

                {/* Debug Information */}
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Debug Info:</h4>
                  <p className="text-sm text-blue-800">Menu Items Count: {menuItems.length}</p>
                  <p className="text-sm text-blue-800">Filtered Menu Items: {filteredMenuItems.length}</p>
                  <p className="text-sm text-blue-800">Cart Items: {cart.length}</p>
                  <p className="text-sm text-blue-800">Total Tables: {tables.length}</p>
                  <p className="text-sm text-blue-800">Available Tables: {tables.filter(table => table.status === 'available').length}</p>
                  <p className="text-sm text-blue-800">Customer Name: "{orderCustomerName}"</p>
                  <p className="text-sm text-blue-800">Selected Table: "{orderTableNumber}"</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Order Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={orderCustomerName}
                            onChange={(e) => setOrderCustomerName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            placeholder="Enter customer name"
                            required
                          />
                          {!orderCustomerName.trim() && (
                            <p className="text-red-500 text-xs mt-1">Customer name is required</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Table Number <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={orderTableNumber}
                            onChange={(e) => setOrderTableNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            required
                          >
                            <option value="">Select available table</option>
                            {tables
                              .filter(table => table.status === 'available')
                              .map((table) => (
                                <option key={table.id} value={table.tableNumber}>
                                  Table {table.tableNumber} ({table.capacity} seats)
                                </option>
                              ))}
                          </select>
                          {!orderTableNumber && (
                            <p className="text-red-500 text-xs mt-1">Table selection is required</p>
                          )}
                          {tables.filter(table => table.status === 'available').length === 0 && (
                            <p className="text-yellow-600 text-xs mt-1">No available tables at the moment</p>
                          )}
