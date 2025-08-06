import React, { useState, useEffect } from 'react'
import { auth, db } from '../authentication/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, collection, onSnapshot, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'

function Waiter() {
  const [userProfile, setUserProfile] = useState(null)
  const [userFullName, setUserFullName] = useState('Waiter')
  const [activeSection, setActiveSection] = useState('dashboard')
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTableNumber, setSelectedTableNumber] = useState(null)
  const [filteredOrders, setFilteredOrders] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userOrderSummaries, setUserOrderSummaries] = useState([])
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null)
  const [showOrderEditModal, setShowOrderEditModal] = useState(false)
  
  // New order placement states
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [selectedTable, setSelectedTable] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [cart, setCart] = useState([])
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        // User not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login')
        window.location.replace('/login')
        return
      }

      try {
        // Fetch user profile from Waiters collection
        const waiterDoc = await getDoc(doc(db, 'Waiters', currentUser.uid))
        if (waiterDoc.exists()) {
          const userData = waiterDoc.data()
          
          // Check if waiter is approved
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
          // User doesn't exist in Waiters collection
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

    // Real-time tables listener
    const tablesUnsubscribe = onSnapshot(collection(db, 'Tables'), (snapshot) => {
      const tablesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Sort tables by tableNumber and show all tables
      const allTables = tablesData
        .sort((a, b) => a.tableNumber - b.tableNumber)
      setTables(allTables)
    })

    // Real-time orders listener
    const ordersUnsubscribe = onSnapshot(collection(db, 'Orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Filter and sort orders by timestamp
      const allOrders = ordersData
        .filter(order => order.tableNumber) // Only orders with table numbers
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return b.timestamp.toDate() - a.timestamp.toDate()
          }
          return 0
        })
      setOrders(allOrders)
    })

    // Real-time menu items listener
    const menuUnsubscribe = onSnapshot(collection(db, 'MenuItems'), (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      console.log('📋 Fetched menu items from MenuItems collection:', menuData.length, 'items')
      console.log('🔍 Available menu items:', menuData.filter(item => item.isVisible !== false).length, 'available')
      setMenuItems(menuData)
    }, (error) => {
      console.error('❌ Error fetching menu items:', error)
    })

    return () => {
      unsubscribe()
      tablesUnsubscribe()
      ordersUnsubscribe()
      menuUnsubscribe()
    }
  }, [])

  // Calculate user order summaries whenever orders change
  useEffect(() => {
    const calculateUserSummaries = () => {
      const userMap = new Map()
      
      orders.forEach(order => {
        const customerName = order.customerName || 'Guest'
        if (!userMap.has(customerName)) {
          userMap.set(customerName, {
            customerName,
            totalOrders: 0,
            totalAmount: 0,
            activeOrders: 0,
            lastOrderTime: null
          })
        }
        
        const userData = userMap.get(customerName)
        userData.totalOrders += 1
        userData.totalAmount += (order.totalAmount || 0)
        
        if (order.status !== 'completed' && order.status !== 'cancelled') {
          userData.activeOrders += 1
        }
        
        if (order.timestamp) {
          const orderTime = order.timestamp.toDate()
          if (!userData.lastOrderTime || orderTime > userData.lastOrderTime) {
            userData.lastOrderTime = orderTime
          }
        }
      })
      
      const summaries = Array.from(userMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
      
      setUserOrderSummaries(summaries)
    }
    
    if (orders.length > 0) {
      calculateUserSummaries()
    }
  }, [orders])

  const updateTableStatus = async (tableId, newStatus) => {
    try {
      const tableRef = doc(db, 'Tables', tableId)
      await updateDoc(tableRef, {
        status: newStatus,
        lastUpdated: new Date(),
        updatedBy: userProfile?.firstName + ' ' + userProfile?.lastName || 'Waiter'
      })
      console.log(`Table ${tableId} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating table status:', error)
      alert('Failed to update table status. Please try again.')
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'Orders', orderId)
      await updateDoc(orderRef, {
        status: newStatus,
        lastUpdated: new Date(),
        updatedBy: userProfile?.firstName + ' ' + userProfile?.lastName || 'Waiter'
      })
      console.log(`Order ${orderId} status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status. Please try again.')
    }
  }

  const cancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return
    }
    
    try {
      const orderRef = doc(db, 'Orders', orderId)
      await updateDoc(orderRef, {
        status: 'cancelled',
        lastUpdated: new Date(),
        cancelledBy: userProfile?.firstName + ' ' + userProfile?.lastName || 'Waiter'
      })
      console.log(`Order ${orderId} cancelled instantly`)
      
      // Close the modal if it's open for this order
      if (selectedOrderForEdit && selectedOrderForEdit.id === orderId) {
        setShowOrderEditModal(false)
        setSelectedOrderForEdit(null)
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Failed to cancel order. Please try again.')
    }
  }

  const updateOrderQuantity = async (orderId, itemIndex, newQuantity) => {
    try {
      const orderDoc = await getDoc(doc(db, 'Orders', orderId))
      if (orderDoc.exists()) {
        const orderData = orderDoc.data()
        const updatedItems = [...orderData.items]
        
        if (newQuantity <= 0) {
          // Remove the item
          updatedItems.splice(itemIndex, 1)
        } else {
          // Update the quantity
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            quantity: newQuantity
          }
        }
        
        // If no items left, close modal and cancel the order
        if (updatedItems.length === 0) {
          setShowOrderEditModal(false)
          setSelectedOrderForEdit(null)
          await cancelOrder(orderId)
          return
        }
        
        // Recalculate total amount
        const newTotalAmount = updatedItems.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0)
        
        const orderRef = doc(db, 'Orders', orderId)
        await updateDoc(orderRef, {
          items: updatedItems,
          totalAmount: newTotalAmount,
          lastUpdated: new Date(),
          updatedBy: userProfile?.firstName + ' ' + userProfile?.lastName || 'Waiter'
        })
        
        console.log(`Order ${orderId} updated permanently in Firebase`)
      }
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order. Please try again.')
    }
  }

  const openOrderEditModal = (order) => {
    setSelectedOrderForEdit(order)
    setShowOrderEditModal(true)
  }

  const handleTableOrdersView = (tableNumber) => {
    // Filter orders for the selected table with comprehensive comparison
    const tableOrders = orders.filter(order => {
      // Try multiple comparison approaches to handle data type inconsistencies
      const orderTableNum = order.tableNumber
      const selectedTableNum = tableNumber
      
      // Direct comparison
      if (orderTableNum === selectedTableNum) return true
      
      // String comparison
      if (String(orderTableNum) === String(selectedTableNum)) return true
      
      // Number comparison
      if (Number(orderTableNum) === Number(selectedTableNum)) return true
      
      return false
    })
    
    console.log(`Table ${tableNumber} orders:`, tableOrders.length, 'found')
    
    setSelectedTableNumber(tableNumber)
    setSelectedCustomer(null)  // Clear customer filter when selecting table
    setFilteredOrders(tableOrders)
    setActiveSection('orders')
  }

  const handleCustomerOrdersView = (customerName) => {
    // Filter orders for the selected customer
    const customerOrders = orders.filter(order => 
      order.customerName && order.customerName.toLowerCase() === customerName.toLowerCase()
    )
    
    console.log(`Customer ${customerName} orders:`, customerOrders.length, 'found')
    
    setSelectedCustomer(customerName)
    setSelectedTableNumber(null)  // Clear table filter when selecting customer
    setFilteredOrders(customerOrders)
    setActiveSection('orders')
  }

  const clearAllFilters = () => {
    setSelectedTableNumber(null)
    setSelectedCustomer(null)
    setFilteredOrders([])
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

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'confirmed': return 'bg-orange-100 text-orange-800'
      case 'preparing': return 'bg-yellow-100 text-yellow-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'served': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-purple-100 text-purple-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // New order placement functions
  const openNewOrderModal = () => {
    setShowNewOrderModal(true)
    setSelectedTable('')
    setCustomerName('')
    setCart([])
  }

  const closeNewOrderModal = () => {
    setShowNewOrderModal(false)
    setSelectedTable('')
    setCustomerName('')
    setCart([])
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
    setCart(prevCart => prevCart.filter(item => item.id !== itemId))
  }

  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId)
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      )
    }
  }

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  // Get unique menu categories from available items only
  const getMenuCategories = () => {
    const availableItems = menuItems.filter(item => item.isVisible !== false)
    const categories = [...new Set(availableItems.map(item => item.category || 'Other'))]
    return ['all', ...categories.sort()]
  }

  // Filter menu items based on category and search term
  const getFilteredMenuItems = () => {
    // First filter to show only available/visible items
    let filtered = menuItems.filter(item => item.isVisible !== false)

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => 
        (item.category || 'Other').toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const placeOrder = async () => {
    if (!selectedTable || !customerName.trim() || cart.length === 0) {
      alert('Please select a table, enter customer name, and add items to cart.')
      return
    }

    setIsPlacingOrder(true)
    try {
      const orderData = {
        tableNumber: parseInt(selectedTable),
        customerName: customerName.trim(),
        items: cart,
        totalAmount: calculateTotal(),
        status: 'confirmed', // Auto-confirm orders placed by waiters
        timestamp: serverTimestamp(),
        placedBy: userProfile?.firstName + ' ' + userProfile?.lastName || 'Waiter',
        waiterName: userFullName,
        confirmedAt: serverTimestamp(), // Add confirmation timestamp
        confirmedBy: userFullName // Track who confirmed the order
      }

      await addDoc(collection(db, 'Orders'), orderData)
      
      alert('Order placed and automatically confirmed!')
      closeNewOrderModal()
    } catch (error) {
      console.error('Error placing order:', error)
      alert('Failed to place order. Please try again.')
    } finally {
      setIsPlacingOrder(false)
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
              {/* Navigation Items */}
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
                  onClick={() => setActiveSection('tables')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeSection === 'tables' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <span>🍽️</span>
                  <span className="hidden md:inline">Tables</span>
                </button>
                <button
                  onClick={() => setActiveSection('users')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeSection === 'users' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <span>👥</span>
                  <span className="hidden md:inline">Users</span>
                </button>
                <button
                  onClick={() => setActiveSection('orders')}
                  className={`px-4 py-2 rounded-lg transition-colors relative flex items-center space-x-2 ${
                    activeSection === 'orders' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <span>📋</span>
                  <span className="hidden md:inline">Orders</span>
                  {orders.filter(o => o.status === 'pending').length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {orders.filter(o => o.status === 'pending').length}
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
                <button
                  onClick={openNewOrderModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>➕</span>
                  <span className="hidden md:inline">Place Order</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
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
                      <p className="text-sm font-medium text-gray-600">Need Action</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {orders.filter(o => o.status === 'confirmed' || o.status === 'ready').length}
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
                        ৳{orders
                          .filter(order => order.status === 'confirmed' || order.status === 'ready' || order.status === 'served' || order.status === 'completed')
                          .reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                      </p>
                      <p className="text-xs text-gray-500">
                        From confirmed orders only
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

                {/* New Menu Status Card */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">🍽️</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Menu Items</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {menuItems.filter(item => item.isVisible !== false).length}
                      </p>
                      <p className="text-xs text-gray-500">
                        {menuItems.length} total
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prepared Orders */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Prepared Orders - Ready to Serve</h3>
                    <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {orders.filter(order => order.status === 'ready' || order.status === 'prepared').length} orders
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {(() => {
                      const preparedOrders = orders.filter(order => order.status === 'ready' || order.status === 'prepared')
                      
                      if (preparedOrders.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <div className="text-4xl mb-4">🍽️</div>
                            <h4 className="text-lg font-medium text-gray-900 mb-2">No Orders Ready to Serve</h4>
                            <p className="text-gray-600">Prepared orders will appear here when they're ready for serving.</p>
                          </div>
                        )
                      }
                      
                      return preparedOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="font-medium text-gray-900">Table {order.tableNumber}</p>
                              <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">
                                Ready to Serve
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{order.items?.map(item => `${item.name} (×${item.quantity})`).join(', ') || 'No items'}</p>
                            <p className="text-xs text-gray-500">
                              Customer: <span className="font-medium text-gray-700">{order.customerName || 'Not specified'}</span>
                              {order.lastUpdated && (
                                <span className="ml-2 text-orange-600">
                                  • Ready: {new Date(order.lastUpdated.toDate()).toLocaleTimeString()}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                            <p className="text-sm font-semibold text-gray-900 mt-1">৳{order.totalAmount || 0}</p>
                            <button
                              onClick={() => {
                                // You can add logic here to mark as served if needed
                                console.log('Serve order:', order.id)
                              }}
                              className="mt-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            >
                              🍽️ Serve
                            </button>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
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
                
                {/* Table Status Legend */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 mb-8 border border-gray-200">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white text-lg">ℹ️</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Table Status Guide</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="relative">
                          <div className="w-5 h-5 bg-emerald-400 rounded-full shadow-lg"></div>
                          <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                        </div>
                        <span className="font-bold text-emerald-700 text-lg">Available</span>
                      </div>
                      <p className="text-gray-600 text-sm">Tables ready for new customers. Can be selected for orders.</p>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="relative">
                          <div className="w-5 h-5 bg-red-400 rounded-full shadow-lg"></div>
                          <div className="absolute inset-0 bg-red-400 rounded-full animate-pulse opacity-75"></div>
                        </div>
                        <span className="font-bold text-red-700 text-lg">Occupied</span>
                      </div>
                      <p className="text-gray-600 text-sm">Tables currently serving customers. Cannot be selected.</p>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-5 h-5 bg-amber-400 rounded-full shadow-lg"></div>
                        <span className="font-bold text-amber-700 text-lg">Reserved</span>
                      </div>
                      <p className="text-gray-600 text-sm">Pre-booked tables with advance reservations.</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 text-lg mt-0.5">💡</span>
                      <div>
                        <p className="text-blue-800 font-semibold text-sm mb-1">Quick Actions:</p>
                        <p className="text-blue-700 text-sm">
                          Click <span className="font-bold text-red-600">"Occupy"</span> to mark available tables as busy, 
                          or <span className="font-bold text-emerald-600">"Free"</span> to make occupied tables available again.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {tables.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No tables available at the moment</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Refresh Tables
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 max-w-7xl mx-auto">
                    {tables.map((table) => {
                      // Comprehensive filtering to handle data type inconsistencies
                      const tableOrders = orders.filter(order => {
                        const orderTableNum = order.tableNumber
                        const tableNum = table.tableNumber
                        
                        // Try multiple comparison approaches
                        return orderTableNum === tableNum || 
                               String(orderTableNum) === String(tableNum) ||
                               Number(orderTableNum) === Number(tableNum)
                      })
                      const activeOrders = tableOrders.filter(order => order.status !== 'served' && order.status !== 'completed' && order.status !== 'cancelled')
                      
                      return (
                        <div
                          key={table.tableNumber || table.id}
                          className="table-card group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden border border-gray-100 bounce-in"
                          style={{ minHeight: '200px' }}
                        >
                          {/* Animated background gradient based on status */}
                          <div className={`absolute inset-0 transition-all duration-500 opacity-80 ${
                            table.status === 'available' ? 'bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100' :
                            table.status === 'occupied' ? 'bg-gradient-to-br from-red-100 via-pink-50 to-rose-100' :
                            table.status === 'reserved' ? 'bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100' :
                            'bg-gradient-to-br from-gray-100 via-slate-50 to-gray-100'
                          }`}></div>
                          
                          {/* Order count at the top */}
                          <div className="absolute top-2 left-2 right-2 z-20 flex justify-between">
                            {/* Total orders count */}
                            {tableOrders.length > 0 && (
                              <div className="bg-blue-500 text-white rounded-lg px-3 py-1 text-sm font-bold shadow-lg">
                                {tableOrders.length} orders
                              </div>
                            )}
                            
                            {/* Active orders count */}
                            {activeOrders.length > 0 && (
                              <div className="bg-red-500 text-white rounded-lg px-3 py-1 text-sm font-bold shadow-lg animate-pulse">
                                {activeOrders.length} active
                              </div>
                            )}
                          </div>

                          {/* Status indicator with pulse animation */}
                          <div className="absolute top-4 right-4 z-20">
                            <div className={`relative w-5 h-5 rounded-full border-3 border-white shadow-lg status-indicator ${
                              table.status === 'available' ? 'bg-emerald-400 glow-green' :
                              table.status === 'occupied' ? 'bg-red-400 glow-red' :
                              table.status === 'reserved' ? 'bg-amber-400 glow-amber' :
                              'bg-gray-400'
                            }`}>
                              {table.status === 'available' && (
                                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                              )}
                              {table.status === 'occupied' && (
                                <div className="absolute inset-0 bg-red-400 rounded-full animate-pulse opacity-75"></div>
                              )}
                            </div>
                          </div>
                          
                          {/* Main content area */}
                          <div className="relative z-10 p-6 flex flex-col items-center justify-center h-full">
                            {/* Table icon with hover animation */}
                            <div className="text-5xl mb-4 transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                              🍽️
                            </div>
                            
                            {/* Table number with elegant typography */}
                            <div className="text-center mb-4">
                              <h3 className="text-2xl font-bold text-gray-800 mb-1">
                                Table {table.tableNumber}
                              </h3>
                              
                              {/* Capacity info */}
                              {table.capacity && (
                                <p className="text-sm text-gray-600 flex items-center justify-center space-x-1">
                                  <span>👥</span>
                                  <span>{table.capacity} seats</span>
                                </p>
                              )}
                            </div>
                            
                            {/* Status badge with modern design */}
                            <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md mb-4 ${
                              table.status === 'available' ? 'bg-emerald-500 text-white' :
                              table.status === 'occupied' ? 'bg-red-500 text-white' :
                              table.status === 'reserved' ? 'bg-amber-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {table.status === 'available' && '✅ Available'}
                              {table.status === 'occupied' && '🔴 Occupied'}
                              {table.status === 'reserved' && '📋 Reserved'}
                              {!['available', 'occupied', 'reserved'].includes(table.status) && table.status}
                            </div>
                            
                            {/* Action buttons with improved design */}
                            <div className="flex gap-2 w-full">
                              {table.status === 'available' && (
                                <button
                                  onClick={() => updateTableStatus(table.id, 'occupied')}
                                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                                  title="Mark as Occupied"
                                >
                                  🔴 Occupy
                                </button>
                              )}
                              {table.status === 'occupied' && (
                                <button
                                  onClick={() => updateTableStatus(table.id, 'available')}
                                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                                  title="Mark as Available"
                                >
                                  ✅ Free
                                </button>
                              )}
                              {table.status !== 'reserved' && (
                                <button
                                  onClick={() => handleTableOrdersView(table.tableNumber)}
                                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                                  title="View Orders"
                                >
                                  📋 Orders
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Decorative border effect */}
                          <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                            table.status === 'available' ? 'ring-2 ring-emerald-400' :
                            table.status === 'occupied' ? 'ring-2 ring-red-400' :
                            table.status === 'reserved' ? 'ring-2 ring-amber-400' :
                            'ring-2 ring-gray-400'
                          }`}></div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Table Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">🍽️</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Total Tables</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    {tables.length}
                  </p>
                  <p className="text-gray-600 text-sm">All restaurant tables</p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Available</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent mb-2">
                    {tables.filter(table => table.status === 'available').length}
                  </p>
                  <p className="text-gray-600 text-sm">Ready for customers</p>
                  <div className="mt-3 bg-emerald-50 rounded-lg p-2">
                    <p className="text-xs text-emerald-700 font-medium">
                      {tables.length > 0 ? Math.round((tables.filter(table => table.status === 'available').length / tables.length) * 100) : 0}% availability
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">👥</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Occupied</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    {tables.filter(table => table.status === 'occupied').length}
                  </p>
                  <p className="text-gray-600 text-sm">Currently serving</p>
                  <div className="mt-3 bg-red-50 rounded-lg p-2">
                    <p className="text-xs text-red-700 font-medium">
                      {tables.length > 0 ? Math.round((tables.filter(table => table.status === 'occupied').length / tables.length) * 100) : 0}% occupied
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">📋</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Reserved</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">
                    {tables.filter(table => table.status === 'reserved').length}
                  </p>
                  <p className="text-gray-600 text-sm">Advance bookings</p>
                  <div className="mt-3 bg-amber-50 rounded-lg p-2">
                    <p className="text-xs text-amber-700 font-medium">
                      {tables.length > 0 ? Math.round((tables.filter(table => table.status === 'reserved').length / tables.length) * 100) : 0}% reserved
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Section */}
          {activeSection === 'users' && (
            <div>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                  Customer Management
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  View all customers and their order summaries
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Customer Order Summaries</h2>
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Customer Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full md:w-64 px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">🔍</span>
                      </div>
                      {customerSearchQuery && (
                        <button
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
                
                {(() => {
                  // Filter customers based on search query
                  const filteredCustomers = userOrderSummaries.filter(user =>
                    user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim())
                  )
                  
                  if (filteredCustomers.length === 0) {
                    return customerSearchQuery ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔍</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">No customers found</h3>
                        <p className="text-gray-600">No customers match "{customerSearchQuery}". Try a different search term.</p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">👥</div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Customers Yet</h3>
                        <p className="text-gray-600">Customer summaries will appear here when orders are placed.</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCustomers.map((user, index) => (
                      <div
                        key={user.customerName + index}
                        className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 p-6 border border-gray-100"
                      >
                        {/* Customer Header */}
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4">
                            <span className="text-white text-xl">👤</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{user.customerName}</h3>
                            <p className="text-sm text-gray-600">
                              {user.lastOrderTime ? 
                                `Last order: ${user.lastOrderTime.toLocaleDateString()}` : 
                                'No recent orders'
                              }
                            </p>
                          </div>
                        </div>

                        {/* Order Statistics */}
                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                            <span className="text-blue-700 font-medium">Total Orders</span>
                            <span className="text-blue-900 font-bold text-lg">{user.totalOrders}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl">
                            <span className="text-green-700 font-medium">Total Spent</span>
                            <span className="text-green-900 font-bold text-lg">৳{user.totalAmount}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl">
                            <span className="text-orange-700 font-medium">Active Orders</span>
                            <span className="text-orange-900 font-bold text-lg">{user.activeOrders}</span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => handleCustomerOrdersView(user.customerName)}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                          📋 View All Orders
                        </button>
                      </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Customer Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                {customerSearchQuery && (
                  <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-blue-800 text-center">
                      📊 Statistics showing results for: "<strong>{customerSearchQuery}</strong>" 
                      <button 
                        onClick={() => setCustomerSearchQuery('')}
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        Show all customers
                      </button>
                    </p>
                  </div>
                )}
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">👥</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {customerSearchQuery ? 'Filtered Customers' : 'Total Customers'}
                  </h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                    {(() => {
                      const filteredCustomers = userOrderSummaries.filter(user =>
                        user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim())
                      )
                      return filteredCustomers.length
                    })()}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {customerSearchQuery ? 'Matching search' : 'Unique customers'}
                  </p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">💰</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {customerSearchQuery ? 'Filtered Revenue' : 'Total Revenue'}
                  </h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                    ৳{(() => {
                      const filteredCustomers = userOrderSummaries.filter(user =>
                        user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim())
                      )
                      return filteredCustomers.reduce((sum, user) => sum + user.totalAmount, 0)
                    })()}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {customerSearchQuery ? 'From filtered customers' : 'All time revenue'}
                  </p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Avg Order Value</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    ৳{(() => {
                      const filteredCustomers = userOrderSummaries.filter(user =>
                        user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim())
                      )
                      const totalAmount = filteredCustomers.reduce((sum, user) => sum + user.totalAmount, 0)
                      const totalOrders = filteredCustomers.reduce((sum, user) => sum + user.totalOrders, 0)
                      return totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0
                    })()}
                  </p>
                  <p className="text-gray-600 text-sm">Per order average</p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border border-gray-100 transform hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="text-3xl">🔥</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Active Orders</h3>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
                    {(() => {
                      const filteredCustomers = userOrderSummaries.filter(user =>
                        user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim())
                      )
                      return filteredCustomers.reduce((sum, user) => sum + user.activeOrders, 0)
                    })()}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {customerSearchQuery ? 'From filtered customers' : 'Currently processing'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Orders Section */}
          {activeSection === 'orders' && (
            <div>
              {(() => {
                // Determine which orders to display based on selection
                const displayOrders = (selectedTableNumber || selectedCustomer) ? filteredOrders : orders
                
                return (
                  <>
                    <div className="mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {selectedTableNumber ? `Table ${selectedTableNumber} Orders` : 
                             selectedCustomer ? `${selectedCustomer}'s Orders` : 'Order Management'}
                          </h2>
                          <p className="text-gray-600">
                            {selectedTableNumber ? `All orders for Table ${selectedTableNumber}` : 
                             selectedCustomer ? `All orders placed by ${selectedCustomer}` : 'View and manage all restaurant orders'}
                          </p>
                        </div>
                        {(selectedTableNumber || selectedCustomer) && (
                          <button
                            onClick={clearAllFilters}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                          >
                            <span>👁️</span>
                            <span>View All Orders</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Orders Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">⏳</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Pending</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-gray-600 to-gray-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => order.status === 'pending').length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => order.status === 'pending').reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">👨‍🍳</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">With Chef</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => 
                            order.status === 'confirmed' || 
                            order.status === 'preparing'
                          ).length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => 
                            order.status === 'confirmed' || 
                            order.status === 'preparing'
                          ).reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">✅</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Ready</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => order.status === 'ready').length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => order.status === 'ready').reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">🍽️</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Served</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => order.status === 'served').length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => order.status === 'served').reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">✅</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Completed</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => order.status === 'completed').length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => order.status === 'completed').reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-white text-xl">❌</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Cancelled</h3>
                        <p className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-600 bg-clip-text text-transparent">
                          {displayOrders.filter(order => order.status === 'cancelled').length}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ৳{displayOrders.filter(order => order.status === 'cancelled').reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                        </p>
                      </div>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                        <h3 className="text-xl font-bold text-gray-900">
                          {selectedTableNumber ? `Table ${selectedTableNumber} Orders` : 
                           selectedCustomer ? `${selectedCustomer}'s Orders` : 'All Orders'}
                        </h3>
                        <p className="text-gray-600 text-sm">Real-time order tracking and management</p>
                      </div>
                      
                      {displayOrders.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">📋</div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {selectedTableNumber ? `No Orders for Table ${selectedTableNumber}` : 
                             selectedCustomer ? `No Orders for ${selectedCustomer}` : 'No Orders Yet'}
                          </h3>
                          <p className="text-gray-600">
                            {selectedTableNumber ? `This table hasn't placed any orders yet.` : 
                             selectedCustomer ? `This customer hasn't placed any orders yet.` : 'Orders will appear here when customers place them.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto shadow-lg rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 table-fixed">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                  Order ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                  Table
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                  Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                  Items
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                  Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                  Total
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                  Time
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-72">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {displayOrders.map((order) => (
                                <tr key={`${order.id}-${order.lastUpdated?.seconds || order.timestamp?.seconds || 'initial'}`} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    #{order.id.slice(-6)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <span className="text-sm font-medium text-gray-900">Table {order.tableNumber}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <span className="text-sm font-medium text-gray-900">
                                        {order.customerName || 'Guest'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                    <div className="truncate">
                                      {order.items?.map(item => `${item.name} (×${item.quantity})`).join(', ') || 'No items'}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                                      {order.status || 'pending'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <div className="flex items-center">
                                      <span className="text-lg font-bold text-green-600">৳{order.totalAmount || 0}</span>
                                      {order.lastUpdated && order.updatedBy && (
                                        <div className="ml-2 flex flex-col">
                                          <span className="text-xs text-blue-500 font-medium">
                                            Updated
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {new Date(order.lastUpdated.toDate()).toLocaleTimeString()}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'No time'}
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium">
                                    <div className="flex flex-col space-y-2 min-w-max">
                                      {/* Primary Actions Row */}
                                      <div className="flex flex-wrap gap-2">
                                        {/* Pending → Confirmed (Waiter confirms order) */}
                                        {order.status === 'pending' && (
                                          <button
                                            onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                          >
                                            <span>✅</span>
                                            <span>Confirm</span>
                                          </button>
                                        )}
                                        
                                        {/* Confirmed/Preparing orders - Only chef can mark as ready */}
                                        {(order.status === 'confirmed' || order.status === 'preparing') && (
                                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
                                            <span>👨‍🍳</span>
                                            <span>With Chef</span>
                                          </span>
                                        )}
                                        
                                        {/* Ready → Served (Waiter serves the order) */}
                                        {order.status === 'ready' && (
                                          <button
                                            onClick={() => updateOrderStatus(order.id, 'served')}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                          >
                                            <span>🍽️</span>
                                            <span>Serve</span>
                                          </button>
                                        )}
                                        
                                        {/* Served → Completed */}
                                        {order.status === 'served' && (
                                          <button
                                            onClick={() => updateOrderStatus(order.id, 'completed')}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                          >
                                            <span>✅</span>
                                            <span>Complete</span>
                                          </button>
                                        )}
                                        
                                        {/* Completed orders - no actions needed */}
                                        {order.status === 'completed' && (
                                          <span className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
                                            <span>✅</span>
                                            <span>Finished</span>
                                          </span>
                                        )}
                                        
                                        {/* Cancelled orders - no actions needed */}
                                        {order.status === 'cancelled' && (
                                          <span className="bg-red-100 text-red-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
                                            <span>❌</span>
                                            <span>Cancelled</span>
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Secondary Actions Row */}
                                      <div className="flex flex-wrap gap-2">
                                        {/* Customer Orders button - always visible */}
                                        <button 
                                          onClick={() => handleCustomerOrdersView(order.customerName || 'Guest')}
                                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                        >
                                          <span>👤</span>
                                          <span>Customer</span>
                                        </button>
                                        
                                        {/* Edit Order button - only for pending orders, hidden when viewing table orders */}
                                        {order.status === 'pending' && !selectedTableNumber && (
                                          <button 
                                            onClick={() => openOrderEditModal(order)}
                                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                          >
                                            <span>✏️</span>
                                            <span>Edit</span>
                                          </button>
                                        )}
                                        
                                        {/* Cancel Order button - only for pending orders, hidden when viewing table orders */}
                                        {order.status === 'pending' && !selectedTableNumber && (
                                          <button 
                                            onClick={() => cancelOrder(order.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1 hover:scale-105"
                                          >
                                            <span>❌</span>
                                            <span>Cancel</span>
                                          </button>
                                        )}
                                        
                                        {/* View Details button - for confirmed orders, hidden when viewing table orders */}
                                        {order.status === 'confirmed' && !selectedTableNumber && (
                                          <button 
                                            onClick={() => openOrderEditModal(order)}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center gap-1"
                                          >
                                            <span>👁️</span>
                                            <span>View Details</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
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
        </div>
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-gray-900">Place New Order</h3>
                <button
                  onClick={closeNewOrderModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Table Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Table *
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Choose a table...</option>
                    {tables
                      .filter(table => table.status === 'available')
                      .map(table => (
                        <option key={table.id} value={table.tableNumber}>
                          Table {table.tableNumber} ({table.capacity} seats)
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Menu Items - Expanded */}
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">Available Menu Items</h4>
                    <div className="text-sm text-gray-600">
                      {getFilteredMenuItems().length} of {menuItems.filter(item => item.isVisible !== false).length} available
                    </div>
                  </div>

                  {/* Search and Category Filter */}
                  <div className="space-y-4 mb-4">
                    {/* Search */}
                    <div>
                      <input
                        type="text"
                        placeholder="Search available menu items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        ✅ Only showing currently available items
                      </p>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex flex-wrap gap-2">
                      {getMenuCategories().map(category => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedCategory === category
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {category === 'all' ? 'All Items' : category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Menu Items Grid */}
                  <div className="max-h-96 overflow-y-auto">
                    {menuItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">📡</div>
                        <p className="font-medium mb-2">Loading menu items...</p>
                        <p className="text-xs">Connecting to MenuItems collection in Firestore</p>
                        <div className="mt-4 text-xs text-gray-400">
                          <p>If this persists, check:</p>
                          <p>• MenuItems collection exists in Firestore</p>
                          <p>• Firebase connection is working</p>
                          <p>• Items have isVisible field set to true</p>
                        </div>
                      </div>
                    ) : getFilteredMenuItems().length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">🔍</div>
                        <p>No available menu items found</p>
                        {searchTerm ? (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="text-blue-600 hover:text-blue-800 text-sm mt-2"
                          >
                            Clear search
                          </button>
                        ) : (
                          <div className="mt-2 text-xs text-gray-400">
                            <p>Total menu items: {menuItems.length}</p>
                            <p>Available items: {menuItems.filter(item => item.isVisible !== false).length}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {getFilteredMenuItems().map(item => {
                          const cartItem = cart.find(cartItem => cartItem.id === item.id)
                          const inCart = !!cartItem
                          const cartQuantity = cartItem?.quantity || 0

                          return (
                            <div key={item.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                              {/* Item Header */}
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-medium text-gray-900 text-sm">{item.name}</h5>
                                <span className="text-lg font-bold text-green-600">৳{item.price}</span>
                              </div>

                              {/* Item Description */}
                              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>

                              {/* Category and Availability Badges */}
                              <div className="mb-3 flex items-center space-x-2">
                                {item.category && (
                                  <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                                    {item.category}
                                  </span>
                                )}
                                {/* Availability indicator */}
                                <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                  ✅ Available
                                </span>
                              </div>

                              {/* Add to Cart / Quantity Controls */}
                              {!inCart ? (
                                <button
                                  onClick={() => addToCart(item)}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                  <span>🛒</span>
                                  <span>Add to Cart</span>
                                </button>
                              ) : (
                                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-2">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => updateCartQuantity(item.id, cartQuantity - 1)}
                                      className="bg-blue-600 hover:bg-blue-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm"
                                    >
                                      -
                                    </button>
                                    <span className="font-medium text-blue-900 min-w-[20px] text-center">
                                      {cartQuantity}
                                    </span>
                                    <button
                                      onClick={() => updateCartQuantity(item.id, cartQuantity + 1)}
                                      className="bg-blue-600 hover:bg-blue-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span className="text-sm font-bold text-blue-900">
                                    ৳{item.price * cartQuantity}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart - Compact */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">Cart</h4>
                    {cart.length > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                      </span>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🛒</div>
                      <p className="text-sm">No items in cart</p>
                      <p className="text-xs text-gray-400 mt-1">Add items from the menu</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {cart.map(item => (
                          <div key={item.id} className="bg-gray-50 border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <h6 className="font-medium text-gray-900 text-sm">{item.name}</h6>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  className="bg-gray-300 hover:bg-gray-400 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                                >
                                  -
                                </button>
                                <span className="font-medium text-sm min-w-[20px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                  className="bg-gray-300 hover:bg-gray-400 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                                >
                                  +
                                </button>
                              </div>
                              <span className="font-bold text-green-600 text-sm">
                                ৳{item.price * item.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Cart Summary */}
                      <div className="space-y-2 pt-3 border-t border-gray-200">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Items ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
                          <span>৳{calculateTotal()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-green-600">
                          <span>Total:</span>
                          <span>৳{calculateTotal()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {/* Auto-confirmation notice */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✅</span>
                    <p className="text-sm text-green-800 font-medium">
                      Orders placed by waiters are automatically confirmed and sent to the kitchen.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={closeNewOrderModal}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={placeOrder}
                    disabled={!selectedTable || !customerName.trim() || cart.length === 0 || isPlacingOrder}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {isPlacingOrder ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <>
                        <span>✅</span>
                        <span>Place & Confirm Order</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Edit Modal */}
      {showOrderEditModal && selectedOrderForEdit && (() => {
        // Get the most current order data from the real-time orders array
        const currentOrder = orders.find(order => order.id === selectedOrderForEdit.id)
        const orderToEdit = currentOrder || selectedOrderForEdit
        const isConfirmedOrder = orderToEdit.status === 'confirmed'
        
        // If order no longer exists or is cancelled, close the modal
        if (!currentOrder || currentOrder.status === 'cancelled') {
          setShowOrderEditModal(false)
          setSelectedOrderForEdit(null)
          return null
        }
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {isConfirmedOrder ? 'Order Details' : 'Edit Order'} #{orderToEdit.id.slice(-6)}
                    </h3>
                    {isConfirmedOrder && (
                      <p className="text-sm text-green-600 font-medium mt-1">
                        ✅ This order is confirmed and cannot be modified
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowOrderEditModal(false)
                      setSelectedOrderForEdit(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-600 mt-2">
                  Table {orderToEdit.tableNumber} • {orderToEdit.customerName || 'Guest'}
                </p>
              </div>
              
              <div className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h4>
                <div className="space-y-4">
                  {orderToEdit.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{item.name}</h5>
                        <p className="text-sm text-gray-600">৳{item.price} each</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            const newQuantity = Math.max(0, item.quantity - 1)
                            updateOrderQuantity(orderToEdit.id, index, newQuantity)
                          }}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-semibold text-lg">{item.quantity}</span>
                        <button
                          onClick={() => {
                            const newQuantity = item.quantity + 1
                            updateOrderQuantity(orderToEdit.id, index, newQuantity)
                          }}
                          className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                        >
                          +
                        </button>
                        <div className="text-right min-w-[80px]">
                          <p className="font-semibold">৳{item.price * item.quantity}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Amount:</span>
                    <span>৳{orderToEdit.totalAmount}</span>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-4">
                  <button
                    onClick={() => {
                      setShowOrderEditModal(false)
                      setSelectedOrderForEdit(null)
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => cancelOrder(orderToEdit.id)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default Waiter