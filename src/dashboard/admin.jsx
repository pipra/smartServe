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
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Admin Dashboard</h1>
              <p className="text-blue-600">SmartServe Restaurant Management</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-600">Welcome, {userFullName}</span>
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'menu', label: 'Menu Management' },
              { id: 'tables', label: 'Table Management' },
              { id: 'pending', label: `Pending Approvals (${pendingWaiters.length + pendingChefs.length + pendingCashiers.length})` },
              { id: 'waiters', label: 'All Waiters' },
              { id: 'chefs', label: 'All Chefs' },
              { id: 'cashiers', label: 'All Cashiers' },
              { id: 'settings', label: 'Settings' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
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
                {/* Recent Orders */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Orders</h3>
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">Table {order.tableNumber}</p>
                          <p className="text-sm text-gray-600">৳{order.totalAmount.toFixed(2)}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'served' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No recent orders</p>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('menu')}
                      className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                    >
                      <span>🍽️</span>
                      <span>Manage Menu</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('tables')}
                      className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                    >
                      <span>🪑</span>
                      <span>Manage Tables</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('pending')}
                      className="w-full bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 flex items-center justify-center space-x-2"
                    >
                      <span>👥</span>
                      <span>Review Pending Staff ({pendingWaiters.length + pendingChefs.length + pendingCashiers.length})</span>
                    </button>
                    <SampleDataLoader onDataChange={fetchData} />
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
            <div className="space-y-6">
              {/* Table Management Controls */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Table Management</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={addNewTable}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                    >
                      + Add New Table
                    </button>
                    <button
                      onClick={initializeTables}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                    >
                      Initialize Tables
                    </button>
                    <button
                      onClick={cleanUpTables}
                      className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 text-sm"
                    >
                      Clean Up All Tables
                    </button>
                  </div>
                </div>

                {/* Table Status Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">Available Tables</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {tables.filter(t => t.status === 'available').length}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-red-800">Occupied Tables</h3>
                    <p className="text-2xl font-bold text-red-600">
                      {tables.filter(t => t.status === 'occupied').length}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-800">Reserved Tables</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                      {tables.filter(t => t.status === 'reserved').length}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-800">Total Tables</h3>
                    <p className="text-2xl font-bold text-gray-600">{tables.length}</p>
                  </div>
                </div>

                {/* Table Grid */}
                <div className="grid grid-cols-6 gap-3">
                  {/* Display all existing tables */}
                  {tables
                    .sort((a, b) => a.tableNumber - b.tableNumber)
                    .map((table) => {
                      const tableNumber = table.tableNumber;
                      const status = table.status || 'available';
                      
                      return (
                        <div
                          key={tableNumber}
                          className={`p-4 rounded-lg border-2 text-center cursor-pointer transition-colors ${
                            status === 'available' 
                              ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                              : status === 'occupied'
                              ? 'bg-red-50 border-red-200 hover:bg-red-100'
                              : status === 'reserved'
                              ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="text-lg font-bold text-gray-800">
                            Table {tableNumber}
                          </div>
                          <div className={`text-xs font-medium mt-1 ${
                            status === 'available' ? 'text-green-600' :
                            status === 'occupied' ? 'text-red-600' :
                            status === 'reserved' ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {status.toUpperCase()}
                          </div>
                          
                          {/* Status Change Buttons */}
                          <div className="mt-2 space-y-1">
                            {status !== 'available' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'available')}
                                className="w-full text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              >
                                Set Available
                              </button>
                            )}
                            {status !== 'occupied' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'occupied')}
                                className="w-full text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              >
                                Set Occupied
                              </button>
                            )}
                            {status !== 'reserved' && (
                              <button
                                onClick={() => updateTableStatus(tableNumber, 'reserved')}
                                className="w-full text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                              >
                                Set Reserved
                              </button>
                            )}
                            
                            {/* Delete Table Button */}
                            <button
                              onClick={() => deleteTable(tableNumber)}
                              className="w-full text-xs bg-red-800 text-white px-2 py-1 rounded hover:bg-red-900 mt-2"
                            >
                              🗑️ Delete Table
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                  {/* Add Table Placeholder */}
                  {tables.length < 50 && (
                    <div
                      onClick={addNewTable}
                      className="p-4 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="text-4xl text-gray-400 mb-2">+</div>
                      <div className="text-sm text-gray-600">Add New Table</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-8">
              {/* Pending Waiters */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Pending Waiter Approvals</h2>
                  <p className="text-gray-600">Review and approve waiter applications</p>
                </div>
                
                {pendingWaiters.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No pending waiter approvals at this time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Experience
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Shift
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Applied
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingWaiters.map((waiter) => (
                          <tr key={waiter.id}>
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
              </div>

              {/* Pending Chefs */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Pending Chef Approvals</h2>
                  <p className="text-gray-600">Review and approve chef applications</p>
                </div>
                
                {pendingChefs.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No pending chef approvals at this time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Experience
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Specialization
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Shift
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Applied
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingChefs.map((chef) => (
                          <tr key={chef.id}>
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
              </div>

              {/* Pending Cashiers */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Pending Cashier Approvals</h2>
                  <p className="text-gray-600">Review and approve cashier applications</p>
                </div>
                
                {pendingCashiers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No pending cashier approvals at this time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Experience
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Skills
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Shift
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Applied
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingCashiers.map((cashier) => (
                          <tr key={cashier.id}>
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
              </div>
            </div>
          )}

          {/* All Waiters Tab */}
          {activeTab === 'waiters' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">All Waiters</h2>
                <p className="text-gray-600">Manage all waiter accounts</p>
              </div>
              
              {allWaiters.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No waiters registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Experience
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allWaiters.map((waiter) => (
                        <tr key={waiter.id}>
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
            </div>
          )}

          {/* All Chefs Tab */}
          {activeTab === 'chefs' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">All Chefs</h2>
                <p className="text-gray-600">Manage all chef accounts</p>
              </div>
              
              {allChefs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No chefs registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Experience
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Specialization
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allChefs.map((chef) => (
                        <tr key={chef.id}>
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
            </div>
          )}

          {/* All Cashiers Tab */}
          {activeTab === 'cashiers' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">All Cashiers</h2>
                <p className="text-gray-600">Manage all cashier accounts</p>
              </div>
              
              {allCashiers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No cashiers registered yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Experience
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allCashiers.map((cashier) => (
                        <tr key={cashier.id}>
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
