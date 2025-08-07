import React, { useState, useEffect } from 'react'
import { db, auth } from '../authentication/firebase'
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, getDoc, onSnapshot, addDoc, orderBy, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import MenuManagement from '../components/MenuManagement'
import SampleDataLoader from '../components/SampleDataLoader'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [pendingWaiters, setPendingWaiters] = useState([])
  const [allWaiters, setAllWaiters] = useState([])
  const [pendingChefs, setPendingChefs] = useState([])
  const [allChefs, setAllChefs] = useState([])
  const [pendingCashiers, setPendingCashiers] = useState([])
  const [allCashiers, setAllCashiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [userFullName, setUserFullName] = useState('Admin')
  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState([])
  
  // New state for comprehensive admin functionality
  const [orders, setOrders] = useState([])
  const [tables, setTables] = useState([])
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    popularItems: []
  })
  const [newTable, setNewTable] = useState({ number: '', capacity: '', status: 'available' })
  const [showAddTable, setShowAddTable] = useState(false)
  const [staffView, setStaffView] = useState('all') // 'all', 'waiters', 'chefs', 'cashiers'
  const [approvalView, setApprovalView] = useState('all') // 'all', 'waiters', 'chefs', 'cashiers'

  useEffect(() => {
    fetchUserData()
    
    // Setup real-time listeners for instant updates
    const setupRealTimeListeners = () => {
      const unsubscribers = []

      // Listen to Waiters collection
      const waitersUnsubscribe = onSnapshot(collection(db, 'Waiters'), (snapshot) => {
        const waitersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setAllWaiters(waitersData)
        setPendingWaiters(waitersData.filter(waiter => waiter.status === 'pending'))
      })
      unsubscribers.push(waitersUnsubscribe)

      // Listen to Chefs collection
      const chefsUnsubscribe = onSnapshot(collection(db, 'Chefs'), (snapshot) => {
        const chefsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setAllChefs(chefsData)
        setPendingChefs(chefsData.filter(chef => chef.status === 'pending'))
      })
      unsubscribers.push(chefsUnsubscribe)

      // Listen to Cashiers collection
      const cashiersUnsubscribe = onSnapshot(collection(db, 'Cashiers'), (snapshot) => {
        const cashiersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setAllCashiers(cashiersData)
        setPendingCashiers(cashiersData.filter(cashier => cashier.status === 'pending'))
      })
      unsubscribers.push(cashiersUnsubscribe)

      // Listen to MenuItems collection
      const menuUnsubscribe = onSnapshot(collection(db, 'MenuItems'), (snapshot) => {
        const menuData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setMenuItems(menuData)
      })
      unsubscribers.push(menuUnsubscribe)

      // Listen to Categories collection
      const categoriesUnsubscribe = onSnapshot(collection(db, 'Categories'), (snapshot) => {
        const categoriesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        // Get only main categories (no parent)
        const mainCategories = categoriesData
          .filter(category => !category.parentId)
          .sort((a, b) => a.name.localeCompare(b.name))
        setCategories(mainCategories)
      })
      unsubscribers.push(categoriesUnsubscribe)

      // Listen to Orders collection
      const ordersUnsubscribe = onSnapshot(
        query(collection(db, 'Orders'), orderBy('timestamp', 'desc')), 
        (snapshot) => {
          const ordersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setOrders(ordersData)
          calculateAnalytics(ordersData)
        }
      )
      unsubscribers.push(ordersUnsubscribe)

      // Listen to Tables collection
      const tablesUnsubscribe = onSnapshot(collection(db, 'Tables'), (snapshot) => {
        const tablesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setTables(tablesData)
      })
      unsubscribers.push(tablesUnsubscribe)

      setLoading(false)

      return unsubscribers
    }

    const unsubscribers = setupRealTimeListeners()

    // Cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [])

  // Calculate analytics from orders data
  const calculateAnalytics = (ordersData) => {
    const completedOrders = ordersData.filter(order => order.status === 'completed')
    const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    const totalOrders = completedOrders.length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Calculate popular items
    const itemCounts = {}
    completedOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity
        })
      }
    })

    const popularItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    setAnalytics({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      popularItems
    })
  }

  const fetchUserData = async () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // User not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login')
        window.location.replace('/login')
        return
      }

      try {
        // Check Admin collection
        const adminDoc = await getDoc(doc(db, 'Admin', user.uid))
        if (adminDoc.exists()) {
          const userData = adminDoc.data()
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
          setUserFullName(fullName || 'Admin')
        } else {
          // User doesn't exist in Admin collection
          console.log('User not found in Admin collection, redirecting to login')
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

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch pending waiters
      const pendingWaitersQuery = query(
        collection(db, 'Waiters'),
        where('status', '==', 'pending')
      )
      const pendingWaitersSnapshot = await getDocs(pendingWaitersQuery)
      const pendingWaitersData = pendingWaitersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPendingWaiters(pendingWaitersData)

      // Fetch all waiters for management
      const waitersQuery = query(
        collection(db, 'Waiters')
      )
      const waitersSnapshot = await getDocs(waitersQuery)
      const waitersData = waitersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAllWaiters(waitersData)

      // Fetch pending chefs
      const pendingChefsQuery = query(
        collection(db, 'Chefs'),
        where('status', '==', 'pending')
      )
      const pendingChefsSnapshot = await getDocs(pendingChefsQuery)
      const pendingChefsData = pendingChefsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPendingChefs(pendingChefsData)

      // Fetch all chefs for management
      const chefsQuery = query(
        collection(db, 'Chefs')
      )
      const chefsSnapshot = await getDocs(chefsQuery)
      const chefsData = chefsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAllChefs(chefsData)

      // Fetch pending cashiers
      const pendingCashiersQuery = query(
        collection(db, 'Cashiers'),
        where('status', '==', 'pending')
      )
      const pendingCashiersSnapshot = await getDocs(pendingCashiersQuery)
      const pendingCashiersData = pendingCashiersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPendingCashiers(pendingCashiersData)

      // Fetch all cashiers for management
      const cashiersQuery = query(
        collection(db, 'Cashiers')
      )
      const cashiersSnapshot = await getDocs(cashiersQuery)
      const cashiersData = cashiersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAllCashiers(cashiersData)

      // Fetch menu items
      const menuItemsQuery = query(
        collection(db, 'MenuItems')
      )
      const menuItemsSnapshot = await getDocs(menuItemsQuery)
      const menuItemsData = menuItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setMenuItems(menuItemsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const approveWaiter = async (waiterId) => {
    try {
      await updateDoc(doc(db, 'Waiters', waiterId), {
        status: 'active',
        approval: true,
        approvedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Waiter approved successfully!')
    } catch (error) {
      console.error('Error approving waiter:', error)
      alert('Failed to approve waiter')
    }
  }

  const rejectWaiter = async (waiterId) => {
    try {
      await updateDoc(doc(db, 'Waiters', waiterId), {
        status: 'rejected',
        approval: false,
        rejectedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Waiter rejected successfully!')
    } catch (error) {
      console.error('Error rejecting waiter:', error)
      alert('Failed to reject waiter')
    }
  }

  const deleteWaiter = async (waiterId) => {
    if (window.confirm('Are you sure you want to permanently delete this waiter?')) {
      try {
        await deleteDoc(doc(db, 'Waiters', waiterId))
        fetchData()
        alert('Waiter deleted successfully!')
      } catch (error) {
        console.error('Error deleting waiter:', error)
        alert('Failed to delete waiter')
      }
    }
  }

  // Chef management functions
  const approveChef = async (chefId) => {
    try {
      await updateDoc(doc(db, 'Chefs', chefId), {
        status: 'active',
        approval: true,
        approvedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Chef approved successfully!')
    } catch (error) {
      console.error('Error approving chef:', error)
      alert('Failed to approve chef')
    }
  }

  const rejectChef = async (chefId) => {
    try {
      await updateDoc(doc(db, 'Chefs', chefId), {
        status: 'rejected',
        approval: false,
        rejectedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Chef rejected successfully!')
    } catch (error) {
      console.error('Error rejecting chef:', error)
      alert('Failed to reject chef')
    }
  }

  const deleteChef = async (chefId) => {
    if (window.confirm('Are you sure you want to permanently delete this chef?')) {
      try {
        await deleteDoc(doc(db, 'Chefs', chefId))
        fetchData()
        alert('Chef deleted successfully!')
      } catch (error) {
        console.error('Error deleting chef:', error)
        alert('Failed to delete chef')
      }
    }
  }

  // Cashier management functions
  const approveCashier = async (cashierId) => {
    try {
      await updateDoc(doc(db, 'Cashiers', cashierId), {
        status: 'active',
        approval: true,
        approvedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Cashier approved successfully!')
    } catch (error) {
      console.error('Error approving cashier:', error)
      alert('Failed to approve cashier')
    }
  }

  const rejectCashier = async (cashierId) => {
    try {
      await updateDoc(doc(db, 'Cashiers', cashierId), {
        status: 'rejected',
        approval: false,
        rejectedAt: new Date().toISOString()
      })
      
      // Refresh the data
      fetchData()
      alert('Cashier rejected successfully!')
    } catch (error) {
      console.error('Error rejecting cashier:', error)
      alert('Failed to reject cashier')
    }
  }

  const deleteCashier = async (cashierId) => {
    if (window.confirm('Are you sure you want to permanently delete this cashier?')) {
      try {
        await deleteDoc(doc(db, 'Cashiers', cashierId))
        fetchData()
        alert('Cashier deleted successfully!')
      } catch (error) {
        console.error('Error deleting cashier:', error)
        alert('Failed to delete cashier')
      }
    }
  }

  // Table Management Functions
  const updateTableStatus = async (tableNumber, status) => {
    try {
      const tableRef = doc(db, 'Tables', `table_${tableNumber}`);
      await setDoc(tableRef, {
        tableNumber,
        status,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating table status:', error);
      alert('Error updating table status');
    }
  };

  const initializeTables = async () => {
    try {
      const batch = writeBatch(db);
      for (let i = 1; i <= 30; i++) {
        const tableRef = doc(db, 'Tables', `table_${i}`);
        batch.set(tableRef, {
          tableNumber: i,
          status: 'available',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      alert('Tables initialized successfully');
    } catch (error) {
      console.error('Error initializing tables:', error);
      alert('Error initializing tables');
    }
  };

  const cleanUpTables = async () => {
    try {
      const batch = writeBatch(db);
      tables.forEach(table => {
        if (table.status === 'occupied' || table.status === 'reserved') {
          const tableRef = doc(db, 'Tables', `table_${table.tableNumber}`);
          batch.update(tableRef, {
            status: 'available',
            updatedAt: serverTimestamp()
          });
        }
      });
      await batch.commit();
      alert('All tables cleaned up and set to available');
    } catch (error) {
      console.error('Error cleaning up tables:', error);
      alert('Error cleaning up tables');
    }
  };

  const addNewTable = async () => {
    try {
      // Find the next available table number
      const tableNumbers = tables.map(t => t.tableNumber).sort((a, b) => a - b);
      let nextTableNumber = 1;
      
      for (let i = 0; i < tableNumbers.length; i++) {
        if (tableNumbers[i] !== nextTableNumber) {
          break;
        }
        nextTableNumber++;
      }

      const tableRef = doc(db, 'Tables', `table_${nextTableNumber}`);
      await setDoc(tableRef, {
        tableNumber: nextTableNumber,
        status: 'available',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      alert(`Table ${nextTableNumber} added successfully`);
    } catch (error) {
      console.error('Error adding new table:', error);
      alert('Error adding new table');
    }
  };

  const deleteTable = async (tableNumber) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableNumber}? This action cannot be undone.`)) {
      try {
        const tableRef = doc(db, 'Tables', `table_${tableNumber}`);
        await deleteDoc(tableRef);
        alert(`Table ${tableNumber} deleted successfully`);
      } catch (error) {
        console.error('Error deleting table:', error);
        alert('Error deleting table');
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status || 'unknown'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SmartServe
                  </span>
                  <div className="text-sm text-gray-600 font-medium">Admin Dashboard</div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Navigation Items */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>📊</span>
                  <span className="hidden md:inline">Overview</span>
                </button>
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'menu' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>🍽️</span>
                  <span className="hidden md:inline">Menu</span>
                </button>
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'tables' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>🪑</span>
                  <span className="hidden md:inline">Tables</span>
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 rounded-lg transition-colors relative flex items-center space-x-2 ${
                    activeTab === 'pending' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>⏳</span>
                  <span className="hidden md:inline">Approvals</span>
                  {(pendingWaiters.length + pendingChefs.length + pendingCashiers.length) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {pendingWaiters.length + pendingChefs.length + pendingCashiers.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('waiters')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'waiters' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>👥</span>
                  <span className="hidden md:inline">Staff</span>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                    activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <span>⚙️</span>
                  <span className="hidden md:inline">Settings</span>
                </button>
              </div>

              {/* User Profile & Logout */}
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                
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
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span>🚪</span>
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Analytics Summary */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-500 rounded-lg">
                        <span className="text-white text-xl">💰</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-sm font-medium text-green-800">Total Revenue</h3>
                        <p className="text-2xl font-bold text-green-600">৳{analytics.totalRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <span className="text-white text-xl">📋</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-sm font-medium text-blue-800">Total Orders</h3>
                        <p className="text-2xl font-bold text-blue-600">{analytics.totalOrders}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <span className="text-white text-xl">💳</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-sm font-medium text-purple-800">Avg. Order Value</h3>
                        <p className="text-2xl font-bold text-purple-600">৳{analytics.averageOrderValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-500 rounded-lg">
                        <span className="text-white text-xl">🍽️</span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-sm font-medium text-orange-800">Popular Item</h3>
                        <p className="text-lg font-bold text-orange-600">{analytics.popularItem}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Total Waiters</h3>
                  <p className="text-3xl font-bold text-blue-600">{allWaiters.length}</p>
                  <p className="text-sm text-blue-600 mt-1">
                    {allWaiters.filter(w => w.status === 'active').length} active
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">Total Chefs</h3>
                  <p className="text-3xl font-bold text-orange-600">{allChefs.length}</p>
                  <p className="text-sm text-orange-600 mt-1">
                    {allChefs.filter(c => c.status === 'active').length} active
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow border border-teal-200">
                  <h3 className="text-lg font-semibold text-teal-900 mb-2">Total Cashiers</h3>
                  <p className="text-3xl font-bold text-teal-600">{allCashiers.length}</p>
                  <p className="text-sm text-teal-600 mt-1">
                    {allCashiers.filter(c => c.status === 'active').length} active
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow border border-yellow-200">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">Pending Approvals</h3>
                  <p className="text-3xl font-bold text-yellow-600">{pendingWaiters.length + pendingChefs.length + pendingCashiers.length}</p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Total Tables</h3>
                  <p className="text-3xl font-bold text-green-600">{tables.length}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {tables.filter(t => t.status === 'available').length} available
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">Menu Items</h3>
                  <p className="text-3xl font-bold text-purple-600">{menuItems.length}</p>
                  <p className="text-sm text-purple-600 mt-1">
                    {menuItems.filter(item => item.isVisible).length} visible
                  </p>
                </div>
              </div>

              {/* Menu Category Overview */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Menu Categories</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {categories.map((category, index) => {
                    // Dynamic color schemes
                    const colorSchemes = [
                      { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', count: 'text-red-600' },
                      { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', count: 'text-yellow-600' },
                      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', count: 'text-green-600' },
                      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', count: 'text-blue-600' },
                      { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', count: 'text-indigo-600' },
                      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', count: 'text-purple-600' },
                      { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', count: 'text-pink-600' },
                      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', count: 'text-cyan-600' },
                      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', count: 'text-orange-600' },
                      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', count: 'text-teal-600' }
                    ];
                    
                    // Dynamic emojis for categories
                    const getEmoji = (categoryName) => {
                      const name = categoryName.toLowerCase();
                      if (name.includes('main') || name.includes('course')) return '🍛';
                      if (name.includes('appetizer') || name.includes('starter')) return '🥗';
                      if (name.includes('fast') || name.includes('pizza')) return '🍕';
                      if (name.includes('soup')) return '🍲';
                      if (name.includes('dessert') || name.includes('sweet')) return '🍰';
                      if (name.includes('beverage') || name.includes('drink')) return '🥤';
                      if (name.includes('salad')) return '🥬';
                      if (name.includes('meat') || name.includes('chicken')) return '🍗';
                      if (name.includes('fish') || name.includes('seafood')) return '🐟';
                      if (name.includes('rice') || name.includes('biryani')) return '🍚';
                      return '🍽️'; // Default emoji
                    };
                    
                    const colors = colorSchemes[index % colorSchemes.length];
                    const itemCount = menuItems.filter(item => item.category === category.name).length;
                    
                    return (
                      <div key={category.id} className={`${colors.bg} p-4 rounded-lg border ${colors.border}`}>
                        <h4 className={`text-sm font-medium ${colors.text}`}>
                          {getEmoji(category.name)} {category.name}
                        </h4>
                        <p className={`text-2xl font-bold ${colors.count}`}>
                          {itemCount}
                        </p>
                      </div>
                    );
                  })}
                  
                  {categories.length === 0 && (
                    <div className="col-span-full text-center py-8">
                      <p className="text-gray-500">No categories found. Create categories in Menu Management.</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Recent Activity & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Simple Beautiful Recent Orders */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {/* Clean Header */}
                  <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-lg">📋</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Recent Orders</h3>
                      </div>
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        {orders.length}
                      </span>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="p-6">
                    {orders.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {orders.slice(0, 20).map((order, index) => (
                          <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-all duration-200">
                            
                            {/* Left Side - Order Info */}
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                                {order.tableNumber || index + 1}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">Table {order.tableNumber || index + 1}</p>
                                <p className="text-sm text-gray-500">
                                  {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'Just now'}
                                </p>
                              </div>
                            </div>

                            {/* Right Side - Amount & Status */}
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="font-bold text-gray-900 text-lg">
                                  ৳{(order.totalAmount || Math.random() * 500 + 100).toFixed(2)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {order.items?.length || Math.floor(Math.random() * 5) + 1} items
                                </p>
                              </div>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                (order.status || 'pending') === 'completed' 
                                  ? 'bg-green-100 text-green-800' :
                                (order.status || 'pending') === 'preparing' 
                                  ? 'bg-yellow-100 text-yellow-800' :
                                (order.status || 'pending') === 'served' 
                                  ? 'bg-blue-100 text-blue-800' :
                                (order.status || 'pending') === 'confirmed'
                                  ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                                {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl text-gray-400">📝</span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-600 mb-1">No Recent Orders</h4>
                        <p className="text-gray-500">Orders will appear here once customers start placing them</p>
                      </div>
                    )}
                  </div>

                  {/* Simple Footer */}
                  {orders.length > 0 && (
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                      <div className="text-center">
                        <span className="text-sm text-gray-600">
                          Showing {Math.min(orders.length, 20)} of {orders.length} orders
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Quick Actions */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center">
                        <span className="text-lg">⚡</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Quick Actions</h3>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Manage Menu */}
                      <button
                        onClick={() => setActiveTab('menu')}
                        className="group bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-500 hover:to-indigo-600 border border-blue-200 hover:border-transparent text-blue-700 hover:text-white px-5 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors duration-300">
                              <span className="text-xl">🍽️</span>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-base">Manage Menu</p>
                              <p className="text-sm opacity-75">Add items, categories & pricing</p>
                            </div>
                          </div>
                          <div className="text-blue-400 group-hover:text-white/70 transition-colors duration-300">
                            <span>→</span>
                          </div>
                        </div>
                      </button>

                      {/* Manage Tables */}
                      <button
                        onClick={() => setActiveTab('tables')}
                        className="group bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-500 hover:to-emerald-600 border border-green-200 hover:border-transparent text-green-700 hover:text-white px-5 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors duration-300">
                              <span className="text-xl">🪑</span>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-base">Manage Tables</p>
                              <p className="text-sm opacity-75">Configure seating arrangements</p>
                            </div>
                          </div>
                          <div className="text-green-400 group-hover:text-white/70 transition-colors duration-300">
                            <span>→</span>
                          </div>
                        </div>
                      </button>

                      {/* Review Pending Staff */}
                      <button
                        onClick={() => setActiveTab('pending')}
                        className="group bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-500 hover:to-orange-600 border border-amber-200 hover:border-transparent text-amber-700 hover:text-white px-5 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-amber-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors duration-300">
                              <span className="text-xl">👥</span>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-base">Review Pending Staff</p>
                              <p className="text-sm opacity-75">
                                {pendingWaiters.length + pendingChefs.length + pendingCashiers.length} pending approvals
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {(pendingWaiters.length + pendingChefs.length + pendingCashiers.length) > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                {pendingWaiters.length + pendingChefs.length + pendingCashiers.length}
                              </span>
                            )}
                            <div className="text-amber-400 group-hover:text-white/70 transition-colors duration-300">
                              <span>→</span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Sample Data Loader */}
                      {/* <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-sm">🔧</span>
                          </div>
                          <h4 className="font-semibold text-gray-700">Development Tools</h4>
                        </div>
                        <SampleDataLoader onDataChange={fetchData} />
                      </div> */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Menu Management Tab */}
          {activeTab === 'menu' && (
            <MenuManagement onDataChange={fetchData} />
          )}

          {/* Table Management Tab */}
          {activeTab === 'tables' && (
            <div className="space-y-8">
              {/* Table Management Header with Beautiful Design */}
              <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 rounded-2xl shadow-xl p-8 border border-teal-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-700 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                      🏪 Table Management Center
                    </h2>
                    <p className="text-teal-600 text-lg font-medium">
                      Manage restaurant seating and table arrangements
                    </p>
                  </div>
                  
                  {/* Management Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={addNewTable}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                    >
                      ✨ Add New Table
                    </button>
                    <button
                      onClick={initializeTables}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                    >
                      🚀 Initialize Tables
                    </button>
                  </div>
                </div>
              </div>

              {/* Enhanced Table Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl shadow-lg border border-green-100 hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-green-800 mb-1">Available Tables</h3>
                      <p className="text-3xl font-bold text-green-600">
                        {tables.filter(t => t.status === 'available').length}
                      </p>
                    </div>
                    <div className="text-4xl">✅</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-2xl shadow-lg border border-red-100 hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-red-800 mb-1">Occupied Tables</h3>
                      <p className="text-3xl font-bold text-red-600">
                        {tables.filter(t => t.status === 'occupied').length}
                      </p>
                    </div>
                    <div className="text-4xl">🍽️</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-2xl shadow-lg border border-yellow-100 hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-yellow-800 mb-1">Reserved Tables</h3>
                      <p className="text-3xl font-bold text-yellow-600">
                        {tables.filter(t => t.status === 'reserved').length}
                      </p>
                    </div>
                    <div className="text-4xl">📅</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">Total Tables</h3>
                      <p className="text-3xl font-bold text-gray-600">{tables.length}</p>
                    </div>
                    <div className="text-4xl">🏪</div>
                  </div>
                </div>
              </div>

              {/* Enhanced Table Grid Section */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Restaurant Floor Plan</h3>
                  <p className="text-gray-600">Click on any table to manage its status and settings</p>
                </div>

                {/* Enhanced Table Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Display all existing tables */}
                  {tables
                    .sort((a, b) => a.tableNumber - b.tableNumber)
                    .map((table) => {
                      const tableNumber = table.tableNumber;
                      const status = table.status || 'available';
                      
                      return (
                        <div
                          key={tableNumber}
                          className={`p-5 rounded-2xl border-2 text-center cursor-pointer transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                            status === 'available' 
                              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100' 
                              : status === 'occupied'
                              ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 hover:from-red-100 hover:to-rose-100'
                              : status === 'reserved'
                              ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 hover:from-yellow-100 hover:to-amber-100'
                              : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200 hover:from-gray-100 hover:to-slate-100'
                          }`}
                        >
                          <div className="text-xl font-bold text-gray-800 mb-1">
                            🪑 Table {tableNumber}
                          </div>
                          <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block mb-3 ${
                            status === 'available' ? 'bg-green-100 text-green-700 border border-green-200' :
                            status === 'occupied' ? 'bg-red-100 text-red-700 border border-red-200' :
                            status === 'reserved' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {status.toUpperCase()}
                          </div>
                          
                          {/* Enhanced Status Change Buttons */}
                          <div className="space-y-2">
                            {status !== 'available' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'available')}
                                className="w-full text-xs bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 font-medium shadow-md"
                              >
                                ✅ Set Available
                              </button>
                            )}
                            {status !== 'occupied' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'occupied')}
                                className="w-full text-xs bg-gradient-to-r from-red-600 to-rose-600 text-white px-3 py-2 rounded-lg hover:from-red-700 hover:to-rose-700 transition-all duration-200 transform hover:scale-105 font-medium shadow-md"
                              >
                                🍽️ Set Occupied
                              </button>
                            )}
                            {status !== 'reserved' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'reserved')}
                                className="w-full text-xs bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-3 py-2 rounded-lg hover:from-yellow-700 hover:to-amber-700 transition-all duration-200 transform hover:scale-105 font-medium shadow-md"
                              >
                                📅 Set Reserved
                              </button>
                            )}
                            
                            {/* Enhanced Delete Table Button */}
                            <button
                              onClick={() => deleteTable(tableNumber)}
                              className="w-full text-xs bg-gradient-to-r from-red-800 to-red-900 text-white px-3 py-2 rounded-lg hover:from-red-900 hover:to-black transition-all duration-200 transform hover:scale-105 font-medium shadow-md border-t border-red-700"
                            >
                              🗑️ Delete Table
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                  {/* Enhanced Add Table Placeholder */}
                  {tables.length < 50 && (
                    <div
                      onClick={addNewTable}
                      className="p-5 rounded-2xl border-2 border-dashed border-gray-300 text-center cursor-pointer hover:border-teal-500 hover:bg-gradient-to-br hover:from-teal-50 hover:to-cyan-50 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <div className="text-5xl text-gray-400 mb-3 hover:text-teal-500 transition-colors duration-200">+</div>
                      <div className="text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors duration-200">Add New Table</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-8">
              {/* Approvals Header with Beautiful Design */}
              <div className="bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50 rounded-2xl shadow-xl p-8 border border-orange-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-700 to-amber-700 bg-clip-text text-transparent mb-3">
                      ⏳ Pending Approvals
                    </h1>
                    <p className="text-gray-600 text-lg">Review and approve staff applications across different roles</p>
                    <div className="flex items-center space-x-6 mt-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{pendingWaiters.length} Waiters</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{pendingChefs.length} Chefs</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{pendingCashiers.length} Cashiers</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/50">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-800">
                        {pendingWaiters.length + pendingChefs.length + pendingCashiers.length}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Total Pending</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Filter Buttons */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Filter Approvals by Role</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* All Approvals Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setApprovalView('all')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        approvalView === 'all' 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${approvalView === 'all' ? 'text-white' : 'text-amber-500'}`}>
                          ⏳
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${approvalView === 'all' ? 'text-white' : 'text-gray-800'}`}>
                          All Pending
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${approvalView === 'all' ? 'text-white' : 'text-gray-700'}`}>
                          {pendingWaiters.length + pendingChefs.length + pendingCashiers.length}
                        </div>
                        <p className={`text-xs ${approvalView === 'all' ? 'text-amber-100' : 'text-gray-500'}`}>
                          View all pending applications
                        </p>
                      </div>
                      {approvalView === 'all' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Pending Waiters Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setApprovalView('waiters')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        approvalView === 'waiters' 
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-blue-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${approvalView === 'waiters' ? 'text-white' : 'text-blue-500'}`}>
                          🍽️
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${approvalView === 'waiters' ? 'text-white' : 'text-gray-800'}`}>
                          Waiters
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${approvalView === 'waiters' ? 'text-white' : 'text-gray-700'}`}>
                          {pendingWaiters.length}
                        </div>
                        <p className={`text-xs ${approvalView === 'waiters' ? 'text-blue-100' : 'text-gray-500'}`}>
                          Pending waiter applications
                        </p>
                      </div>
                      {approvalView === 'waiters' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Pending Chefs Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setApprovalView('chefs')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        approvalView === 'chefs' 
                          ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white border-orange-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 hover:border-orange-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${approvalView === 'chefs' ? 'text-white' : 'text-orange-500'}`}>
                          👨‍🍳
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${approvalView === 'chefs' ? 'text-white' : 'text-gray-800'}`}>
                          Chefs
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${approvalView === 'chefs' ? 'text-white' : 'text-gray-700'}`}>
                          {pendingChefs.length}
                        </div>
                        <p className={`text-xs ${approvalView === 'chefs' ? 'text-orange-100' : 'text-gray-500'}`}>
                          Pending chef applications
                        </p>
                      </div>
                      {approvalView === 'chefs' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Pending Cashiers Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setApprovalView('cashiers')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        approvalView === 'cashiers' 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:border-green-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${approvalView === 'cashiers' ? 'text-white' : 'text-green-500'}`}>
                          💰
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${approvalView === 'cashiers' ? 'text-white' : 'text-gray-800'}`}>
                          Cashiers
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${approvalView === 'cashiers' ? 'text-white' : 'text-gray-700'}`}>
                          {pendingCashiers.length}
                        </div>
                        <p className={`text-xs ${approvalView === 'cashiers' ? 'text-green-100' : 'text-gray-500'}`}>
                          Pending cashier applications
                        </p>
                      </div>
                      {approvalView === 'cashiers' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Approvals Display Section */}
              <div className="bg-white shadow-xl rounded-2xl border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {approvalView === 'all' && '⏳ All Pending Approvals'}
                        {approvalView === 'waiters' && '🍽️ Pending Waiters'}
                        {approvalView === 'chefs' && '👨‍🍳 Pending Chefs'}
                        {approvalView === 'cashiers' && '💰 Pending Cashiers'}
                      </h2>
                      <p className="text-gray-600">
                        {approvalView === 'all' && `Review ${pendingWaiters.length + pendingChefs.length + pendingCashiers.length} pending applications`}
                        {approvalView === 'waiters' && `Review ${pendingWaiters.length} pending waiter applications`}
                        {approvalView === 'chefs' && `Review ${pendingChefs.length} pending chef applications`}
                        {approvalView === 'cashiers' && `Review ${pendingCashiers.length} pending cashier applications`}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      approvalView === 'all' ? 'bg-amber-100 text-amber-800' :
                      approvalView === 'waiters' ? 'bg-blue-100 text-blue-800' :
                      approvalView === 'chefs' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {(approvalView === 'all' ? pendingWaiters.length + pendingChefs.length + pendingCashiers.length :
                        approvalView === 'waiters' ? pendingWaiters.length :
                        approvalView === 'chefs' ? pendingChefs.length :
                        pendingCashiers.length)} Pending
                    </div>
                  </div>
                </div>
                
                {/* All Pending Applications View */}
                {approvalView === 'all' && (
                  <>
                    {(pendingWaiters.length + pendingChefs.length + pendingCashiers.length) === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">✅</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No pending approvals</h3>
                        <p className="text-gray-500">All applications have been processed</p>
                      </div>
                    ) : (
                      <div className="p-8">
                        {/* Pending Waiters Section */}
                        {pendingWaiters.length > 0 && (
                          <div className="mb-8">
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">🍽️</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Pending Waiters ({pendingWaiters.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Shift</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Applied</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {pendingWaiters.map((waiter) => (
                                    <tr key={waiter.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {waiter.firstName} {waiter.lastName}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.phone}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.experience}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.preferredShift}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.createdAt ? new Date(waiter.createdAt).toLocaleDateString() : 'N/A'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => approveWaiter(waiter.id)}
                                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => rejectWaiter(waiter.id)}
                                            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Pending Chefs Section */}
                        {pendingChefs.length > 0 && (
                          <div className="mb-8">
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">👨‍🍳</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Pending Chefs ({pendingChefs.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Specialization</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Shift</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Applied</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {pendingChefs.map((chef) => (
                                    <tr key={chef.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {chef.firstName} {chef.lastName}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.phone}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.experience}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.specialization}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.preferredShift}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.createdAt ? new Date(chef.createdAt).toLocaleDateString() : 'N/A'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => approveChef(chef.id)}
                                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => rejectChef(chef.id)}
                                            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Pending Cashiers Section */}
                        {pendingCashiers.length > 0 && (
                          <div>
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">💰</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Pending Cashiers ({pendingCashiers.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-green-50 to-green-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Skills</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Shift</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Applied</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {pendingCashiers.map((cashier) => (
                                    <tr key={cashier.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {cashier.name}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.phone}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.experience} years
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.skills?.join(', ') || 'N/A'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.preferredShift}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.createdAt ? new Date(cashier.createdAt).toLocaleDateString() : 'N/A'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => approveCashier(cashier.id)}
                                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => rejectCashier(cashier.id)}
                                            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Pending Waiters Only View */}
                {approvalView === 'waiters' && (
                  <>
                    {pendingWaiters.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">🍽️</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No pending waiter applications</h3>
                        <p className="text-gray-500">All waiter applications have been processed</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Phone</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Applied</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pendingWaiters.map((waiter) => (
                              <tr key={waiter.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {waiter.firstName} {waiter.lastName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.phone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.experience}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.createdAt ? new Date(waiter.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => approveWaiter(waiter.id)}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => rejectWaiter(waiter.id)}
                                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Pending Chefs Only View */}
                {approvalView === 'chefs' && (
                  <>
                    {pendingChefs.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">👨‍🍳</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No pending chef applications</h3>
                        <p className="text-gray-500">All chef applications have been processed</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Phone</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Specialization</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Applied</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pendingChefs.map((chef) => (
                              <tr key={chef.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {chef.firstName} {chef.lastName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.phone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.experience}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.specialization}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.createdAt ? new Date(chef.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => approveChef(chef.id)}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => rejectChef(chef.id)}
                                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Pending Cashiers Only View */}
                {approvalView === 'cashiers' && (
                  <>
                    {pendingCashiers.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">💰</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No pending cashier applications</h3>
                        <p className="text-gray-500">All cashier applications have been processed</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-green-50 to-green-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Phone</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Skills</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Applied</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pendingCashiers.map((cashier) => (
                              <tr key={cashier.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {cashier.name}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.phone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.experience} years
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.skills?.join(', ') || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.createdAt ? new Date(cashier.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => approveCashier(cashier.id)}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => rejectCashier(cashier.id)}
                                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Staff Management Tab */}
          {activeTab === 'waiters' && (
            <div className="space-y-8">
              {/* Staff Header with Beautiful Design */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 border border-blue-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-3">
                      👥 Staff Management
                    </h1>
                    <p className="text-gray-600 text-lg">Manage all restaurant staff members across different roles</p>
                    <div className="flex items-center space-x-6 mt-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{allWaiters.length} Waiters</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{allChefs.length} Chefs</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600 font-medium">{allCashiers.length} Cashiers</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/50">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-800">
                        {allWaiters.length + allChefs.length + allCashiers.length}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">Total Staff</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Filter Buttons */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Filter Staff by Role</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* All Staff Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setStaffView('all')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        staffView === 'all' 
                          ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-purple-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-purple-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${staffView === 'all' ? 'text-white' : 'text-purple-500'}`}>
                          👥
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${staffView === 'all' ? 'text-white' : 'text-gray-800'}`}>
                          All Staff
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${staffView === 'all' ? 'text-white' : 'text-gray-700'}`}>
                          {allWaiters.length + allChefs.length + allCashiers.length}
                        </div>
                        <p className={`text-xs ${staffView === 'all' ? 'text-purple-100' : 'text-gray-500'}`}>
                          View all staff members
                        </p>
                      </div>
                      {staffView === 'all' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-indigo-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Waiters Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setStaffView('waiters')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        staffView === 'waiters' 
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-blue-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${staffView === 'waiters' ? 'text-white' : 'text-blue-500'}`}>
                          🍽️
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${staffView === 'waiters' ? 'text-white' : 'text-gray-800'}`}>
                          Waiters
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${staffView === 'waiters' ? 'text-white' : 'text-gray-700'}`}>
                          {allWaiters.length}
                        </div>
                        <p className={`text-xs ${staffView === 'waiters' ? 'text-blue-100' : 'text-gray-500'}`}>
                          {allWaiters.filter(w => w.status === 'active').length} active
                        </p>
                      </div>
                      {staffView === 'waiters' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Chefs Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setStaffView('chefs')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        staffView === 'chefs' 
                          ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white border-orange-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 hover:border-orange-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${staffView === 'chefs' ? 'text-white' : 'text-orange-500'}`}>
                          👨‍🍳
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${staffView === 'chefs' ? 'text-white' : 'text-gray-800'}`}>
                          Chefs
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${staffView === 'chefs' ? 'text-white' : 'text-gray-700'}`}>
                          {allChefs.length}
                        </div>
                        <p className={`text-xs ${staffView === 'chefs' ? 'text-orange-100' : 'text-gray-500'}`}>
                          {allChefs.filter(c => c.status === 'active').length} active
                        </p>
                      </div>
                      {staffView === 'chefs' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>

                  {/* Cashiers Button */}
                  <div className="group relative">
                    <button
                      onClick={() => setStaffView('cashiers')}
                      className={`w-full relative overflow-hidden rounded-2xl p-3 border-2 transition-all duration-300 ${
                        staffView === 'cashiers' 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-500 shadow-lg transform scale-102' 
                          : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:border-green-300 hover:shadow-lg hover:scale-101'
                      }`}
                    >
                      <div className="relative z-10">
                        <div className={`text-2xl mb-1 ${staffView === 'cashiers' ? 'text-white' : 'text-green-500'}`}>
                          💰
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${staffView === 'cashiers' ? 'text-white' : 'text-gray-800'}`}>
                          Cashiers
                        </h3>
                        <div className={`text-lg font-bold mb-1 ${staffView === 'cashiers' ? 'text-white' : 'text-gray-700'}`}>
                          {allCashiers.length}
                        </div>
                        <p className={`text-xs ${staffView === 'cashiers' ? 'text-green-100' : 'text-gray-500'}`}>
                          {allCashiers.filter(c => c.status === 'active').length} active
                        </p>
                      </div>
                      {staffView === 'cashiers' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 rounded-2xl"></div>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Staff Display Section */}
              <div className="bg-white shadow-xl rounded-2xl border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {staffView === 'all' && '👥 All Staff Members'}
                        {staffView === 'waiters' && '🍽️ Waiters'}
                        {staffView === 'chefs' && '👨‍🍳 Chefs'}
                        {staffView === 'cashiers' && '💰 Cashiers'}
                      </h2>
                      <p className="text-gray-600">
                        {staffView === 'all' && `Showing all ${allWaiters.length + allChefs.length + allCashiers.length} staff members`}
                        {staffView === 'waiters' && `Manage ${allWaiters.length} waiter accounts`}
                        {staffView === 'chefs' && `Manage ${allChefs.length} chef accounts`}
                        {staffView === 'cashiers' && `Manage ${allCashiers.length} cashier accounts`}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      staffView === 'all' ? 'bg-purple-100 text-purple-800' :
                      staffView === 'waiters' ? 'bg-blue-100 text-blue-800' :
                      staffView === 'chefs' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {(staffView === 'all' ? allWaiters.length + allChefs.length + allCashiers.length :
                        staffView === 'waiters' ? allWaiters.length :
                        staffView === 'chefs' ? allChefs.length :
                        allCashiers.length)} Total
                    </div>
                  </div>
                </div>
                
                {/* All Staff View */}
                {staffView === 'all' && (
                  <>
                    {(allWaiters.length + allChefs.length + allCashiers.length) === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">👥</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No staff registered yet</h3>
                        <p className="text-gray-500">Staff members will appear here once they register</p>
                      </div>
                    ) : (
                      <div className="p-8">
                        {/* Waiters Section */}
                        {allWaiters.length > 0 && (
                          <div className="mb-8">
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">🍽️</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Waiters ({allWaiters.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Shift</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {allWaiters.map((waiter) => (
                                    <tr key={waiter.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {waiter.firstName} {waiter.lastName}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(waiter.status)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.experience}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {waiter.preferredShift}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          {waiter.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={() => approveWaiter(waiter.id)}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                              >
                                                Approve
                                              </button>
                                              <button
                                                onClick={() => rejectWaiter(waiter.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                              >
                                                Reject
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => deleteWaiter(waiter.id)}
                                            className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Chefs Section */}
                        {allChefs.length > 0 && (
                          <div className="mb-8">
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">👨‍🍳</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Chefs ({allChefs.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Specialization</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {allChefs.map((chef) => (
                                    <tr key={chef.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {chef.firstName} {chef.lastName}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(chef.status)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.experience}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {chef.specialization}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          {chef.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={() => approveChef(chef.id)}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                              >
                                                Approve
                                              </button>
                                              <button
                                                onClick={() => rejectChef(chef.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                              >
                                                Reject
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => deleteChef(chef.id)}
                                            className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Cashiers Section */}
                        {allCashiers.length > 0 && (
                          <div>
                            <div className="flex items-center mb-4">
                              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold">💰</span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-800">Cashiers ({allCashiers.length})</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-green-50 to-green-100">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Experience</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Shift</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {allCashiers.map((cashier) => (
                                    <tr key={cashier.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {cashier.firstName} {cashier.lastName}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.email}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(cashier.status)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.experience}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cashier.preferredShift}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                          {cashier.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={() => approveCashier(cashier.id)}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                              >
                                                Approve
                                              </button>
                                              <button
                                                onClick={() => rejectCashier(cashier.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                              >
                                                Reject
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => deleteCashier(cashier.id)}
                                            className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Waiters Only View */}
                {staffView === 'waiters' && (
                  <>
                    {allWaiters.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">🍽️</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No waiters registered yet</h3>
                        <p className="text-gray-500">Waiter accounts will appear here once they register</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {allWaiters.map((waiter) => (
                              <tr key={waiter.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {waiter.firstName} {waiter.lastName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(waiter.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.experience}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {waiter.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    {waiter.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => approveWaiter(waiter.id)}
                                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => rejectWaiter(waiter.id)}
                                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => deleteWaiter(waiter.id)}
                                      className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Chefs Only View */}
                {staffView === 'chefs' && (
                  <>
                    {allChefs.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">👨‍🍳</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No chefs registered yet</h3>
                        <p className="text-gray-500">Chef accounts will appear here once they register</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-orange-50 to-orange-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Specialization</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-orange-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {allChefs.map((chef) => (
                              <tr key={chef.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {chef.firstName} {chef.lastName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(chef.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.experience}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.specialization}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {chef.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    {chef.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => approveChef(chef.id)}
                                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => rejectChef(chef.id)}
                                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => deleteChef(chef.id)}
                                      className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Cashiers Only View */}
                {staffView === 'cashiers' && (
                  <>
                    {allCashiers.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-8xl mb-4">💰</div>
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">No cashiers registered yet</h3>
                        <p className="text-gray-500">Cashier accounts will appear here once they register</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-green-50 to-green-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Experience</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Shift</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-green-800 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {allCashiers.map((cashier) => (
                              <tr key={cashier.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {cashier.firstName} {cashier.lastName}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(cashier.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.experience}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {cashier.preferredShift}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex space-x-2">
                                    {cashier.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => approveCashier(cashier.id)}
                                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => rejectCashier(cashier.id)}
                                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => deleteCashier(cashier.id)}
                                      className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Admin Settings</h2>
                <p className="text-gray-600">Configure admin preferences</p>
              </div>
              
              <div className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Admin Role</p>
                        <p className="font-medium">Restaurant Administrator</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">System Version</p>
                        <p className="font-medium">SmartServe v1.0</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                    <div className="flex space-x-4">
                      <button 
                        onClick={fetchData}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Refresh Data
                      </button>
                      <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                        Export Reports
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
