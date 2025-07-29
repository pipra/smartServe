import React, { useState, useEffect } from 'react'
import { db, auth } from '../authentication/firebase'
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, getDoc } from 'firebase/firestore'
import { signOut, onAuthStateChanged } from 'firebase/auth'

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

  useEffect(() => {
    fetchData()
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Total Waiters</h3>
                <p className="text-3xl font-bold text-blue-600">{allWaiters.length}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">Total Chefs</h3>
                <p className="text-3xl font-bold text-orange-600">{allChefs.length}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border border-teal-200">
                <h3 className="text-lg font-semibold text-teal-900 mb-2">Total Cashiers</h3>
                <p className="text-3xl font-bold text-teal-600">{allCashiers.length}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Pending Approvals</h3>
                <p className="text-3xl font-bold text-yellow-600">{pendingWaiters.length + pendingChefs.length + pendingCashiers.length}</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Active Staff</h3>
                <p className="text-3xl font-bold text-green-600">
                  {allWaiters.filter(w => w.status === 'active').length + allChefs.filter(c => c.status === 'active').length + allCashiers.filter(c => c.status === 'active').length}
                </p>
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
