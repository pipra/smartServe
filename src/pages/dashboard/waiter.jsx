import React, { useState, useEffect } from 'react'
import { auth, db } from '../../services/firebase/config.js'
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
  const [orderStatusFilter, setOrderStatusFilter] = useState('all') // New state for order status filtering

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
        
        // Only include revenue from non-cancelled and non-pending orders
        if (order.status !== 'cancelled' && order.status !== 'pending') {
          userData.totalAmount += (order.totalAmount || 0)
        }
        
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
    setOrderStatusFilter('all') // Reset status filter as well
  }

  const handleLogout = async () => {
    try {
      // Set logout flag to prevent auto-redirect
      sessionStorage.setItem('justLoggedOut', 'true')
      await signOut(auth)
      window.location.href = '/'
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

  // Get unique menu categories from visible items
  const getMenuCategories = () => {
    const visibleItems = menuItems.filter(item => item.isVisible !== false)
    const categories = [...new Set(visibleItems.map(item => item.category || 'Other'))]
    return ['all', ...categories.sort()]
  }

  // Filter menu items based on category and search term
  const getFilteredMenuItems = () => {
    // First filter to show only visible items (keep unavailable items visible but disable cart actions)
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
                  onClick={openNewOrderModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>➕</span>
                  <span className="hidden md:inline">Place Order</span>
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
                        ৳{Math.round(orders
                          .filter(order => order.status === 'confirmed' || order.status === 'ready' || order.status === 'served' || order.status === 'completed')
                          .reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
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

              {/* Prepared Orders - Modern Card Design */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-50 via-yellow-50 to-red-50 px-8 py-6 border-b border-orange-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🍽️</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">Ready to Serve</h3>
                        <p className="text-gray-600">Orders prepared by the kitchen - deliver to customers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-lg shadow-lg">
                        {orders.filter(order => order.status === 'ready' || order.status === 'prepared').length}
                      </div>
                      <p className="text-orange-600 text-sm font-medium mt-1">Ready Orders</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  {(() => {
                    const preparedOrders = orders.filter(order => order.status === 'ready' || order.status === 'prepared')
                    
                    if (preparedOrders.length === 0) {
                      return (
                        <div className="text-center py-16">
                          <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">🍽️</span>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-900 mb-3">All Caught Up!</h4>
                          <p className="text-gray-600 text-lg mb-6">No orders ready for serving right now.</p>
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 max-w-md mx-auto">
                            <p className="text-green-800 text-sm font-medium">
                              ✨ Ready orders will appear here when the kitchen finishes preparation
                            </p>
                          </div>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="space-y-4">
                        {preparedOrders.map((order, index) => (
                          <div key={`${order.id}-${order.lastUpdated?.seconds || order.timestamp?.seconds || 'initial'}`} 
                               className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fade-in-up"
                               style={{animationDelay: `${index * 50}ms`}}>
                            
                            {/* Order Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-red-50 rounded-t-2xl">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                                  <span className="text-white font-bold text-sm">#{order.id.slice(-4)}</span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-gray-900">Order #{order.id.slice(-6)}</h3>
                                  <p className="text-sm text-gray-600">
                                    Table {order.tableNumber} • {order.customerName || 'Guest'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                {/* Order Status */}
                                <div className="text-right">
                                  <span className="inline-flex px-4 py-2 rounded-full text-sm font-bold shadow-sm bg-yellow-100 text-yellow-800">
                                    🔥 Ready to Serve
                                  </span>
                                  <p className="text-xs text-gray-500 mt-2">
                                    {order.lastUpdated && `Ready: ${new Date(order.lastUpdated.toDate()).toLocaleTimeString()}`}
                                  </p>
                                </div>
                                
                                {/* Order Total */}
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-green-600">৳{Math.round(order.totalAmount || 0)}</p>
                                  <p className="text-xs text-gray-500">Total Amount</p>
                                </div>
                              </div>
                            </div>

                            {/* Order Details */}
                            <div className="p-6">
                              {/* Order Items */}
                              <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                  <span className="mr-2">📋</span>
                                  Order Items ({order.items?.length || 0})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {order.items?.map((item, itemIndex) => (
                                    <div key={itemIndex} className="flex justify-between items-center bg-gray-50 rounded-lg p-3 border border-gray-100">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                          <span className="text-orange-600 font-bold text-sm">×{item.quantity}</span>
                                        </div>
                                        <span className="font-medium text-gray-900">{item.name}</span>
                                      </div>
                                      <span className="text-gray-600 font-semibold">৳{Math.round(item.price * item.quantity)}</span>
                                    </div>
                                  )) || (
                                    <div className="text-gray-500 text-sm italic col-span-2">No items listed</div>
                                  )}
                                </div>
                              </div>

                              {/* Order Timeline */}
                              {(order.timestamp || order.lastUpdated) && (
                                <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-200">
                                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                    <span className="mr-2">⏰</span>
                                    Order Timeline
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    {order.timestamp && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-600">
                                          Placed: {new Date(order.timestamp.toDate()).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                    {order.lastUpdated && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                        <span className="text-gray-600">
                                          Ready: {new Date(order.lastUpdated.toDate()).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Action Button */}
                              <div className="flex justify-end">
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'served')}
                                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-3"
                                >
                                  <span className="text-xl">🍽️</span>
                                  <span>Mark as Served</span>
                                  <span className="transform transition-transform hover:translate-x-1">→</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {tables.map((table, index) => {
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
                      const pendingOrders = activeOrders.filter(order => order.status === 'pending')
                      const readyOrders = activeOrders.filter(order => order.status === 'ready' || order.status === 'prepared')
                      
                      // Calculate total revenue for this table (excluding cancelled orders)
                      const totalRevenue = tableOrders
                        .filter(order => order.status !== 'cancelled' && order.status !== 'pending')
                        .reduce((sum, order) => sum + (order.totalAmount || 0), 0)
                      
                      return (
                        <div
                          key={table.tableNumber || table.id}
                          className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fade-in-up overflow-hidden"
                          style={{animationDelay: `${index * 100}ms`}}
                        >
                          {/* Table Header */}
                          <div className={`relative p-6 ${
                            table.status === 'available' 
                              ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100' 
                              : table.status === 'occupied' 
                              ? 'bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-100'
                              : table.status === 'reserved'
                              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100'
                              : 'bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100'
                          }`}>
                            <div className="flex items-center justify-between">
                              {/* Left side - Table info */}
                              <div className="flex items-center space-x-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                                  table.status === 'available' 
                                    ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                                    : table.status === 'occupied' 
                                    ? 'bg-gradient-to-br from-red-500 to-pink-600'
                                    : table.status === 'reserved'
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                    : 'bg-gradient-to-br from-gray-500 to-slate-600'
                                }`}>
                                  <span className="text-white text-2xl font-bold">
                                    {table.tableNumber}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-gray-900">
                                    Table {table.tableNumber}
                                  </h3>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <span className="flex items-center space-x-1">
                                      <span>👥</span>
                                      <span>{table.capacity || 4} seats</span>
                                    </span>
                                    {totalRevenue > 0 && (
                                      <span className="flex items-center space-x-1">
                                        <span>💰</span>
                                        <span>৳{totalRevenue}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Right side - Status */}
                              <div className="text-right">
                                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                                  table.status === 'available' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : table.status === 'occupied' 
                                    ? 'bg-red-100 text-red-800'
                                    : table.status === 'reserved'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {table.status === 'available' && (
                                    <>
                                      <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                                      Available
                                    </>
                                  )}
                                  {table.status === 'occupied' && (
                                    <>
                                      <div className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></div>
                                      Occupied
                                    </>
                                  )}
                                  {table.status === 'reserved' && (
                                    <>
                                      <div className="w-2 h-2 bg-amber-400 rounded-full mr-2"></div>
                                      Reserved
                                    </>
                                  )}
                                </div>
                                
                                {/* Order counts */}
                                <div className="flex space-x-2 mt-2 justify-end">
                                  {activeOrders.length > 0 && (
                                    <span className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                                      {activeOrders.length} active
                                    </span>
                                  )}
                                  {tableOrders.length > 0 && (
                                    <span className="bg-gray-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                                      {tableOrders.length} total
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Table Body - Orders Info */}
                          <div className="p-6">
                            {activeOrders.length > 0 ? (
                              <div className="space-y-4">
                                <h4 className="text-lg font-bold text-gray-900 flex items-center">
                                  <span className="mr-2">🍽️</span>
                                  Active Orders ({activeOrders.length})
                                </h4>
                                
                                {/* Order status breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {pendingOrders.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                                      <div className="text-yellow-600 font-bold text-lg">{pendingOrders.length}</div>
                                      <div className="text-yellow-700 text-sm font-medium">Pending</div>
                                    </div>
                                  )}
                                  {(activeOrders.length - pendingOrders.length - readyOrders.length) > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                      <div className="text-blue-600 font-bold text-lg">
                                        {activeOrders.length - pendingOrders.length - readyOrders.length}
                                      </div>
                                      <div className="text-blue-700 text-sm font-medium">In Kitchen</div>
                                    </div>
                                  )}
                                  {readyOrders.length > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                      <div className="text-green-600 font-bold text-lg animate-pulse">{readyOrders.length}</div>
                                      <div className="text-green-700 text-sm font-medium">Ready to Serve</div>
                                    </div>
                                  )}
                                </div>

                                {/* Recent customer info */}
                                {activeOrders[0]?.customerName && (
                                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-600">👤</span>
                                      <span className="text-gray-700 font-medium">
                                        Current Customer: {activeOrders[0].customerName}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                  <span className="text-gray-400 text-2xl">🍽️</span>
                                </div>
                                <h4 className="text-lg font-medium text-gray-700 mb-2">No Active Orders</h4>
                                <p className="text-gray-500 text-sm">
                                  {table.status === 'available' ? 'Table is ready for new customers' : 'Table has no pending orders'}
                                </p>
                                {tableOrders.length > 0 && (
                                  <p className="text-gray-400 text-xs mt-2">
                                    {tableOrders.length} completed orders (৳{totalRevenue})
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Table Footer - Action Buttons */}
                          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <div className="flex space-x-3">
                              {table.status === 'available' && (
                                <button
                                  onClick={() => updateTableStatus(table.id, 'occupied')}
                                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                                >
                                  <span>🔴</span>
                                  <span>Mark Occupied</span>
                                </button>
                              )}
                              {table.status === 'occupied' && (
                                <button
                                  onClick={() => updateTableStatus(table.id, 'available')}
                                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                                >
                                  <span>✅</span>
                                  <span>Mark Free</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleTableOrdersView(table.tableNumber)}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                              >
                                <span>📋</span>
                                <span>View All Orders</span>
                              </button>
                            </div>
                          </div>
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
              {/* Control Panel */}
              <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                      <span className="mr-3 text-3xl">🎛️</span>
                      Active Customer Management
                    </h2>
                    <p className="text-gray-600">Manage customers with active orders - search and track ongoing service</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    {/* Enhanced Search */}
                    <div className="relative flex-1 lg:w-80">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-lg">🔍</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Search active customers by name..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                      />
                      {customerSearchQuery && (
                        <button
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <span className="text-lg">✕</span>
                        </button>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                    >
                      <span className="text-lg">🔄</span>
                      <span>Refresh Data</span>
                    </button>
                  </div>
                </div>
                
                {/* Search Results Info */}
                {customerSearchQuery && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-blue-600 text-xl">🎯</span>
                      <p className="text-blue-800 font-medium">
                        Search Results: "<strong className="text-blue-900">{customerSearchQuery}</strong>"
                        <button 
                          onClick={() => setCustomerSearchQuery('')}
                          className="ml-3 text-blue-600 hover:text-blue-800 underline font-normal"
                        >
                          Clear & Show All
                        </button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Customer Cards */}
              <div className="mb-8">
                {(() => {
                  // Filter customers based on search query AND active orders > 0
                  const filteredCustomers = userOrderSummaries.filter(user =>
                    user.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase().trim()) &&
                    user.activeOrders > 0
                  )
                  
                  if (filteredCustomers.length === 0) {
                    return customerSearchQuery ? (
                      <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
                        <div className="w-24 h-24 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <span className="text-4xl">🔍</span>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 mb-4">No Active Customers Found</h3>
                        <p className="text-gray-600 text-lg mb-6">No customers with active orders match "{customerSearchQuery}". Try a different search term.</p>
                        <button
                          onClick={() => setCustomerSearchQuery('')}
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                        >
                          Show All Active Customers
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
                        <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <span className="text-4xl">🍽️</span>
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 mb-4">No Active Customers</h3>
                        <p className="text-gray-600 text-lg">No customers currently have active orders. Customer profiles will appear here when orders are being processed.</p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredCustomers.map((user, index) => (
                      <div
                        key={user.customerName + index}
                        className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 overflow-hidden"
                      >
                        {/* Customer Header */}
                        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-100">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-white text-2xl">👤</span>
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 mb-1">{user.customerName}</h3>
                              <p className="text-sm text-gray-600 flex items-center">
                                <span className="mr-2">📅</span>
                                {user.lastOrderTime ? 
                                  `Last order: ${user.lastOrderTime.toLocaleDateString()}` : 
                                  'No recent orders'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Customer Stats */}
                        <div className="p-6">
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Total Orders */}
                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                  <span className="text-white text-lg">📋</span>
                                </div>
                                <span className="text-2xl font-bold text-blue-600">{user.totalOrders}</span>
                              </div>
                              <p className="text-blue-700 font-medium text-sm">Total Orders</p>
                            </div>
                            
                            {/* Active Orders */}
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                                  <span className="text-white text-lg">🔥</span>
                                </div>
                                <span className="text-2xl font-bold text-orange-600">{user.activeOrders}</span>
                              </div>
                              <p className="text-orange-700 font-medium text-sm">Active Orders</p>
                            </div>
                          </div>
                          
                          {/* Total Spent */}
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 mb-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                                  <span className="text-white text-xl">💰</span>
                                </div>
                                <div>
                                  <p className="text-green-700 font-medium">Total Spent</p>
                                  <p className="text-sm text-green-600">All-time revenue</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold text-green-600">৳{Math.round(user.totalAmount)}</p>
                                <p className="text-xs text-green-500">
                                  Avg: ৳{user.totalOrders > 0 ? Math.round(user.totalAmount / user.totalOrders) : 0}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => handleCustomerOrdersView(user.customerName)}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl group-hover:shadow-2xl flex items-center justify-center space-x-3"
                          >
                            <span className="text-xl">�</span>
                            <span>View Order History</span>
                            <span className="transform transition-transform group-hover:translate-x-1">→</span>
                          </button>
                        </div>
                      </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Orders Section */}
          {activeSection === 'orders' && (
            <div>
              {(() => {
                // Determine which orders to display based on selection
                let displayOrders = (selectedTableNumber || selectedCustomer) ? filteredOrders : orders
                
                // Apply status filter
                if (orderStatusFilter !== 'all') {
                  if (orderStatusFilter === 'pending') {
                    displayOrders = displayOrders.filter(order => order.status === 'pending')
                  } else if (orderStatusFilter === 'in-progress') {
                    displayOrders = displayOrders.filter(order => 
                      order.status === 'confirmed' || 
                      order.status === 'preparing' || 
                      order.status === 'ready'
                    )
                  } else if (orderStatusFilter === 'completed') {
                    displayOrders = displayOrders.filter(order => 
                      order.status === 'completed' || 
                      order.status === 'served'
                    )
                  } else if (orderStatusFilter === 'cancelled') {
                    displayOrders = displayOrders.filter(order => order.status === 'cancelled')
                  }
                }
                
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

                    {/* Status Filter Buttons */}
                    <div className="mb-6">
                      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                        <div className="flex flex-col space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                              <span className="mr-2">🔍</span>
                              Filter by Status
                            </h3>
                            <span className="text-sm text-gray-500">
                              {displayOrders.length} orders {orderStatusFilter !== 'all' ? `(${orderStatusFilter})` : 'total'}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => setOrderStatusFilter('all')}
                              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                                orderStatusFilter === 'all'
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
                              }`}
                            >
                              <span>📊</span>
                              <span>All Orders</span>
                              <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                                {(selectedTableNumber || selectedCustomer) ? filteredOrders.length : orders.length}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => setOrderStatusFilter('pending')}
                              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                                orderStatusFilter === 'pending'
                                  ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
                              }`}
                            >
                              <span>⏳</span>
                              <span>Pending</span>
                              <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                                {((selectedTableNumber || selectedCustomer) ? filteredOrders : orders).filter(order => order.status === 'pending').length}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => setOrderStatusFilter('in-progress')}
                              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                                orderStatusFilter === 'in-progress'
                                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
                              }`}
                            >
                              <span>👨‍🍳</span>
                              <span>In Progress</span>
                              <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                                {((selectedTableNumber || selectedCustomer) ? filteredOrders : orders).filter(order => 
                                  order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready'
                                ).length}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => setOrderStatusFilter('completed')}
                              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                                orderStatusFilter === 'completed'
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
                              }`}
                            >
                              <span>✅</span>
                              <span>Completed</span>
                              <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                                {((selectedTableNumber || selectedCustomer) ? filteredOrders : orders).filter(order => 
                                  order.status === 'completed' || order.status === 'served'
                                ).length}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => setOrderStatusFilter('cancelled')}
                              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                                orderStatusFilter === 'cancelled'
                                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
                              }`}
                            >
                              <span>❌</span>
                              <span>Cancelled</span>
                              <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                                {((selectedTableNumber || selectedCustomer) ? filteredOrders : orders).filter(order => order.status === 'cancelled').length}
                              </span>
                            </button>
                          </div>
                        </div>
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
                          ৳{Math.round(displayOrders.filter(order => order.status === 'pending').reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
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
                          ৳{Math.round(displayOrders.filter(order => 
                            order.status === 'confirmed' || 
                            order.status === 'preparing'
                          ).reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
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
                          ৳{Math.round(displayOrders.filter(order => order.status === 'ready').reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
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
                          ৳{Math.round(displayOrders.filter(order => order.status === 'served').reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
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
                            {orderStatusFilter !== 'all' ? `No ${orderStatusFilter.charAt(0).toUpperCase() + orderStatusFilter.slice(1).replace('-', ' ')} Orders` :
                             selectedTableNumber ? `No Orders for Table ${selectedTableNumber}` : 
                             selectedCustomer ? `No Orders for ${selectedCustomer}` : 'No Orders Yet'}
                          </h3>
                          <p className="text-gray-600">
                            {orderStatusFilter !== 'all' ? `No orders found with status: ${orderStatusFilter.replace('-', ' ')}.` :
                             selectedTableNumber ? `This table hasn't placed any orders yet.` : 
                             selectedCustomer ? `This customer hasn't placed any orders yet.` : 'Orders will appear here when customers place them.'}
                          </p>
                          {orderStatusFilter !== 'all' && (
                            <button
                              onClick={() => setOrderStatusFilter('all')}
                              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                              Show All Orders
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {displayOrders.map((order, index) => (
                            <div key={`${order.id}-${order.lastUpdated?.seconds || order.timestamp?.seconds || 'initial'}`} 
                                 className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fade-in-up"
                                 style={{animationDelay: `${index * 50}ms`}}>
                              
                              {/* Order Header */}
                              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-2xl">
                                <div className="flex items-center space-x-4">
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-sm">#{order.id.slice(-4)}</span>
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-gray-900">Order #{order.id.slice(-6)}</h3>
                                    <p className="text-sm text-gray-600">
                                      Table {order.tableNumber} • {order.customerName || 'Guest'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-4">
                                  {/* Order Status */}
                                  <div className="text-right">
                                    <span className={`inline-flex px-4 py-2 rounded-full text-sm font-bold shadow-sm ${getOrderStatusColor(order.status)}`}>
                                      {order.status === 'pending' && '⏳ Pending'}
                                      {order.status === 'confirmed' && '👨‍🍳 With Chef'}
                                      {order.status === 'preparing' && '🔥 Preparing'}
                                      {order.status === 'ready' && '✅ Ready'}
                                      {order.status === 'served' && '🍽️ Served'}
                                      {order.status === 'completed' && '✅ Completed'}
                                      {order.status === 'cancelled' && '❌ Cancelled'}
                                    </span>
                                  </div>
                                  
                                  {/* Order Total */}
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-green-600">৳{order.totalAmount || 0}</p>
                                    <p className="text-xs text-gray-500">
                                      {order.timestamp ? new Date(order.timestamp.toDate()).toLocaleDateString() : 'No date'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Order Content */}
                              <div className="p-4">
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                  
                                  {/* Order Items */}
                                  <div className="lg:col-span-3">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                                      <span className="mr-2">🍽️</span>
                                      Order Items ({order.items?.length || 0})
                                    </h4>
                                    <div className="bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
                                      {order.items && order.items.length > 0 ? (
                                        <div className="space-y-1">
                                          {order.items.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between bg-white rounded-md p-2 text-xs">
                                              <div className="flex-1">
                                                <span className="font-medium text-gray-900">{item.name}</span>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-semibold">
                                                  ×{item.quantity}
                                                </span>
                                                <span className="font-bold text-green-600">
                                                  ৳{item.price * item.quantity}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center py-2 text-gray-500">
                                          <p className="text-xs">No items in this order</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions Only */}
                                  <div className="space-y-2">
                                    {/* Primary Actions */}
                                    <div className="space-y-1">
                                      {/* Pending → Confirmed */}
                                      {order.status === 'pending' && (
                                        <button
                                          onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-1"
                                        >
                                          <span>✅</span>
                                          <span>Confirm</span>
                                        </button>
                                      )}
                                      
                                      {/* Confirmed/Preparing - With Chef */}
                                      {(order.status === 'confirmed' || order.status === 'preparing') && (
                                        <div className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1">
                                          <span>👨‍🍳</span>
                                          <span>With Chef</span>
                                        </div>
                                      )}
                                      
                                      {/* Ready → Served */}
                                      {order.status === 'ready' && (
                                        <button
                                          onClick={() => updateOrderStatus(order.id, 'served')}
                                          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-1"
                                        >
                                          <span>🍽️</span>
                                          <span>Serve</span>
                                        </button>
                                      )}
                                      
                                      {/* Served → Completed */}
                                      {order.status === 'served' && (
                                        <button
                                          onClick={() => updateOrderStatus(order.id, 'completed')}
                                          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-1"
                                        >
                                          <span>✅</span>
                                          <span>Complete</span>
                                        </button>
                                      )}
                                      
                                      {/* Status Indicators */}
                                      {order.status === 'completed' && (
                                        <div className="w-full bg-gradient-to-r from-purple-400 to-purple-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1">
                                          <span>✅</span>
                                          <span>Complete</span>
                                        </div>
                                      )}
                                      
                                      {order.status === 'cancelled' && (
                                        <div className="w-full bg-gradient-to-r from-red-400 to-red-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1">
                                          <span>❌</span>
                                          <span>Cancelled</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Secondary Actions */}
                                    <div className="space-y-1 pt-2 border-t border-gray-200">
                                      {/* Customer Orders */}
                                      <button 
                                        onClick={() => handleCustomerOrdersView(order.customerName || 'Guest')}
                                        className="w-full bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center justify-center space-x-1"
                                      >
                                        <span>👤</span>
                                        <span>Customer</span>
                                      </button>
                                      
                                      <div className="grid grid-cols-2 gap-1">
                                        {/* Edit - Only for pending orders */}
                                        {order.status === 'pending' && !selectedTableNumber && (
                                          <button 
                                            onClick={() => openOrderEditModal(order)}
                                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center justify-center space-x-1"
                                          >
                                            <span>✏️</span>
                                            <span>Edit</span>
                                          </button>
                                        )}
                                        
                                        {/* Cancel Order */}
                                        {order.status === 'pending' && !selectedTableNumber && (
                                          <button 
                                            onClick={() => cancelOrder(order.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-md flex items-center justify-center space-x-1 hover:scale-105"
                                          >
                                            <span>❌</span>
                                            <span>Cancel</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
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
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Profile Header Card */}
              <div className="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl shadow-2xl overflow-hidden">
                <div className="relative px-8 py-12 text-white">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10"></div>
                  
                  <div className="relative z-10 text-center">
                    {/* Profile Avatar */}
                    <div className="relative inline-block mb-6">
                      <div className="w-32 h-32 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white border-opacity-30 shadow-xl">
                        <span className="text-6xl leading-none flex items-center justify-center w-full h-full">🧑‍💼</span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                        <span className="text-white text-sm font-bold leading-none">✓</span>
                      </div>
                    </div>
                    
                    {/* Profile Info */}
                    <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">{userFullName}</h1>
                    <p className="text-xl text-white text-opacity-90 mb-4 font-medium">Professional Waiter - {userProfile?.shift || 'Day'} Shift</p>
                    <div className="flex items-center justify-center space-x-4 text-white text-opacity-80">
                      <div className="flex items-center space-x-2">
                        <span>🏆</span>
                        <span className="font-medium">Expert Service</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>✨</span>
                        <span className="font-medium">{userProfile?.status === 'active' ? 'Active' : 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today's Performance */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <span className="mr-3 text-2xl">📊</span>
                      Today's Performance
                    </h3>
                    <p className="text-gray-600 mt-1">Your service statistics for today</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Performance Cards */}
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">📋</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-blue-600">
                              {orders.filter(order => {
                                const today = new Date().toDateString();
                                const orderDate = order.timestamp ? new Date(order.timestamp.toDate()).toDateString() : '';
                                return orderDate === today && (order.placedBy?.includes(userProfile?.firstName) || order.waiterName === userFullName);
                              }).length}
                            </p>
                            <p className="text-sm text-blue-700 font-medium">Orders Placed</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Orders placed today</p>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">✅</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-green-600">
                              {orders.filter(order => 
                                (order.placedBy?.includes(userProfile?.firstName) || order.waiterName === userFullName) && 
                                ['pending', 'confirmed', 'ready'].includes(order.status)
                              ).length}
                            </p>
                            <p className="text-sm text-green-700 font-medium">Active Orders</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Currently processing</p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">🍽️</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-purple-600">
                              {tables.filter(table => table.status === 'occupied').length}
                            </p>
                            <p className="text-sm text-purple-700 font-medium">Active Tables</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Tables being served</p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-xl">💰</span>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-orange-600">
                              ৳{orders.filter(order => {
                                const today = new Date().toDateString();
                                const orderDate = order.timestamp ? new Date(order.timestamp.toDate()).toDateString() : '';
                                return orderDate === today && 
                                  (order.placedBy?.includes(userProfile?.firstName) || order.waiterName === userFullName) &&
                                  ['confirmed', 'ready', 'served', 'completed'].includes(order.status);
                              }).reduce((sum, order) => sum + (order.totalAmount || 0), 0)}
                            </p>
                            <p className="text-sm text-orange-700 font-medium">Today's Sales</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">Revenue generated</p>
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
                          <span className="text-white text-sm">�</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="font-medium text-gray-900 truncate">{userProfile?.email || 'Not provided'}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">✅</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Status</p>
                          <p className={`font-medium ${userProfile?.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {userProfile?.status === 'active' ? 'Active & Approved' : 'Pending Approval'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">🎯</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Department</p>
                          <p className="font-medium text-gray-900">Customer Service</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">⏰</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Shift</p>
                          <p className="font-medium text-gray-900 capitalize">{userProfile?.shift || 'Not assigned'} Shift</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">🆔</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Employee ID</p>
                          <p className="font-medium text-gray-900">{userProfile?.employeeId || 'Not assigned'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <span className="mr-3">⚡</span>
                        Quick Actions
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-3">
                      <button
                        onClick={() => setActiveSection('dashboard')}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">📊</span>
                        <span>Dashboard</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveSection('orders')}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">📋</span>
                        <span>My Orders</span>
                      </button>

                      <button
                        onClick={() => setActiveSection('tables')}
                        className="w-full bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <span className="text-xl">🍽️</span>
                        <span>Table Management</span>
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
              <div className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-2xl shadow-lg overflow-hidden">
                <div className="px-8 py-6 text-white relative">
                  <div className="absolute inset-0 bg-black bg-opacity-10"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-3xl">🏆</span>
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold mb-1">Outstanding Service!</h4>
                        <p className="text-white text-opacity-90">Excellent customer service and table management performance</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {orders.filter(order => 
                          (order.placedBy?.includes(userProfile?.firstName) || order.waiterName === userFullName) && 
                          order.status !== 'cancelled'
                        ).length}
                      </div>
                      <div className="text-sm text-white text-opacity-80">Total Orders</div>
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
                                <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                                  item.available === false 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {item.available === false ? '❌ Unavailable' : '✅ Available'}
                                </span>
                              </div>

                              {/* Add to Cart / Quantity Controls */}
                              {item.available === false ? (
                                <button
                                  disabled
                                  className="w-full bg-gray-400 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                  <span>❌</span>
                                  <span>Unavailable</span>
                                </button>
                              ) : !inCart ? (
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