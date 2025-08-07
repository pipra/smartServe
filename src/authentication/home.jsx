import React, { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, getDoc } from 'firebase/firestore'

export default function Home() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [menuItems, setMenuItems] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTable, setSelectedTable] = useState(null)
    const [cart, setCart] = useState([])
    const [showCart, setShowCart] = useState(false)
    const [currentOrder, setCurrentOrder] = useState(null)
    const [orderStatus, setOrderStatus] = useState('select-table') // select-table, browsing, cart, ordered, confirmed, preparing, ready, served, billing, completed
    const [availableTables, setAvailableTables] = useState([])
    const [categories, setCategories] = useState(['All'])
    const [activeTab, setActiveTab] = useState('menu') // menu, cart, status, profile, tables
    const [userOrders, setUserOrders] = useState([])
    const [userProfile, setUserProfile] = useState(null) // For storing additional user profile data
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [editProfileData, setEditProfileData] = useState({ firstName: '', lastName: '' })
    const [selectedItem, setSelectedItem] = useState(null) // For item details modal
    const [showItemDetails, setShowItemDetails] = useState(false) // Show/hide item details modal
    const [itemQuantity, setItemQuantity] = useState(1) // Quantity for selected item
    const [orderFilter, setOrderFilter] = useState('all') // all, pending, in-progress, completed, cancelled
    const [showTableSelection, setShowTableSelection] = useState(false) // Show/hide table selection
    const [showRatingModal, setShowRatingModal] = useState(false) // Show/hide rating modal
    const [orderRating, setOrderRating] = useState(0) // Current rating selection
    const [ratingComment, setRatingComment] = useState('') // Optional rating comment

    // Helper function to get user display name
    const getUserDisplayName = () => {
        if (userProfile?.firstName && userProfile?.lastName) {
            return `${userProfile.firstName} ${userProfile.lastName}`
        }
        if (user?.displayName) {
            return user.displayName
        }
        if (user?.email) {
            const username = user.email.split('@')[0]
            return `${username.charAt(0).toUpperCase()}${username.slice(1)}`
        }
        return 'User'
    }

    // Helper function to calculate/enhance menu item ratings
    const enhanceMenuItemsWithRatings = (items) => {
        return items.map(item => {
            // If item doesn't have a rating, generate one based on factors
            if (!item.rating) {
                let calculatedRating = 3.5; // Base rating
                
                // Boost rating for vegetarian items
                if (item.isVegetarian) calculatedRating += 0.3;
                
                // Boost rating for items with images
                if (item.image) calculatedRating += 0.2;
                
                // Add some randomness but keep it realistic
                const randomFactor = (Math.random() - 0.5) * 1.0;
                calculatedRating += randomFactor;
                
                // Ensure rating is between 1.0 and 5.0
                calculatedRating = Math.max(1.0, Math.min(5.0, calculatedRating));
                
                item.rating = calculatedRating;
                item.reviewCount = Math.floor(Math.random() * 50) + 5; // 5-55 reviews
            }
            
            return item;
        });
    }

    // Load user profile data from localStorage
    useEffect(() => {
        if (user) {
            const savedProfile = localStorage.getItem(`userProfile_${user.uid}`)
            if (savedProfile) {
                setUserProfile(JSON.parse(savedProfile))
            }
        }
    }, [user])

    // Save profile function
    const saveProfile = () => {
        if (user && editProfileData.firstName.trim() && editProfileData.lastName.trim()) {
            const newProfile = {
                firstName: editProfileData.firstName.trim(),
                lastName: editProfileData.lastName.trim(),
                updatedAt: new Date().toISOString()
            }
            setUserProfile(newProfile)
            localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(newProfile))
            setIsEditingProfile(false)
            setEditProfileData({ firstName: '', lastName: '' })
            
            // Show success feedback (you could replace this with a toast notification)
            console.log('Profile updated successfully!')
        } else {
            console.log('Please enter both first and last name')
        }
    }

    // Set default tab based on user state
    useEffect(() => {
        if (user && !selectedTable) {
            setActiveTab('tables') // Show tables tab by default when no table selected
        }
    }, [user, selectedTable])

    useEffect(() => {
        // Authentication state listener
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser)
            
            // Check user role and redirect to appropriate dashboard
            if (currentUser) {
                try {
                    let userRole = null
                    let userData = null

                    // Check Admin collection
                    const adminDoc = await getDoc(doc(db, 'Admin', currentUser.uid))
                    if (adminDoc.exists()) {
                        userData = adminDoc.data()
                        userRole = 'admin'
                    } else {
                        // Check Waiters collection
                        const waiterDoc = await getDoc(doc(db, 'Waiters', currentUser.uid))
                        if (waiterDoc.exists()) {
                            userData = waiterDoc.data()
                            userRole = 'waiter'
                        } else {
                            // Check Chefs collection
                            const chefDoc = await getDoc(doc(db, 'Chefs', currentUser.uid))
                            if (chefDoc.exists()) {
                                userData = chefDoc.data()
                                userRole = 'chef'
                            } else {
                                // Check Cashiers collection
                                const cashierDoc = await getDoc(doc(db, 'Cashiers', currentUser.uid))
                                if (cashierDoc.exists()) {
                                    userData = cashierDoc.data()
                                    userRole = 'cashier'
                                }
                            }
                        }
                    }

                    // Redirect staff to their dashboards if approved
                    if (userData && userRole) {
                        // Check approval status for staff roles
                        if (userRole === 'waiter' && userData.approval && userData.status === 'approved') {
                            console.log('Approved waiter detected, redirecting to waiter dashboard...')
                            setIsRedirecting(true)
                            window.location.replace('/dashboard/waiter')
                            return
                        }
                        
                        if (userRole === 'chef' && userData.approval && userData.status === 'approved') {
                            console.log('Approved chef detected, redirecting to chef dashboard...')
                            setIsRedirecting(true)
                            window.location.replace('/dashboard/chef')
                            return
                        }
                        
                        if (userRole === 'cashier' && userData.approval && userData.status === 'approved') {
                            console.log('Approved cashier detected, redirecting to cashier dashboard...')
                            setIsRedirecting(true)
                            window.location.replace('/dashboard/cashier')
                            return
                        }

                        // Admin users are always approved
                        if (userRole === 'admin') {
                            console.log('Admin user detected, redirecting to admin dashboard...')
                            setIsRedirecting(true)
                            window.location.replace('/dashboard/admin')
                            return
                        }
                    }
                } catch (error) {
                    console.error('Error checking user role:', error)
                }
            }
            
            setLoading(false)
        })

        // Real-time menu items listener
        const menuUnsubscribe = onSnapshot(collection(db, 'MenuItems'), (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            // Only show visible items (keep unavailable items visible but disable cart actions)
            const visibleItems = items.filter(item => item.isVisible !== false)
            // Enhance items with ratings
            const enhancedItems = enhanceMenuItemsWithRatings(visibleItems)
            setMenuItems(enhancedItems)
        })
        
        // Real-time tables listener
        const tablesUnsubscribe = onSnapshot(collection(db, 'Tables'), (snapshot) => {
            const tables = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            // Sort tables by number and only show available tables for selection
            const sortedTables = tables
                .filter(table => table.status === 'available')
                .sort((a, b) => a.tableNumber - b.tableNumber)
            setAvailableTables(sortedTables)
        })

        // Real-time categories listener
        const categoriesUnsubscribe = onSnapshot(collection(db, 'Categories'), (snapshot) => {
            const categoriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            // Get only main categories (no parent)
            const mainCategories = categoriesData
                .filter(category => !category.parentId)
                .map(category => category.name)
                .sort()
            setCategories(['All', ...mainCategories])
        })

        return () => {
            unsubscribe()
            menuUnsubscribe()
            tablesUnsubscribe()
            categoriesUnsubscribe()
        }
    }, [])

    // Real-time user orders listener
    useEffect(() => {
        if (user) {
            const userOrdersUnsubscribe = onSnapshot(
                query(collection(db, 'Orders'), where('customerName', '==', user.email?.split('@')[0] || 'Customer')),
                (snapshot) => {
                    const orders = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    // Sort by timestamp, newest first
                    const sortedOrders = orders.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate())
                    setUserOrders(sortedOrders)
                }
            )
            return () => userOrdersUnsubscribe()
        }
    }, [user])

    // Simple refresh function for tables (though real-time listeners make this unnecessary)
    const refreshTables = () => {
        // The real-time listener will automatically update the tables
        // This function is just for user feedback
        console.log('Tables are automatically updated in real-time!')
    }

    // Real-time order status monitoring
    useEffect(() => {
        if (currentOrder) {
            const unsubscribe = onSnapshot(
                query(collection(db, 'Orders'), where('id', '==', currentOrder.id)),
                (snapshot) => {
                    if (!snapshot.empty) {
                        const orderData = snapshot.docs[0].data()
                        setOrderStatus(orderData.status)
                        setCurrentOrder({ ...currentOrder, ...orderData })
                    }
                }
            )
            return () => unsubscribe()
        }
    }, [currentOrder])

    const selectTable = (tableNumber) => {
        setSelectedTable(tableNumber)
        setOrderStatus('browsing')
        setActiveTab('menu')
    }

    // Open item details modal (currently unused but kept for future use)
    const _openItemDetails = (item) => {
        setSelectedItem(item)
        setItemQuantity(1)
        setShowItemDetails(true)
    }

    // Close item details modal
    const closeItemDetails = () => {
        setSelectedItem(null)
        setShowItemDetails(false)
        setItemQuantity(1)
    }

    // Add item to cart from details modal
    const addItemToCart = () => {
        if (selectedItem) {
            const existingItem = cart.find(cartItem => cartItem.id === selectedItem.id)
            if (existingItem) {
                setCart(cart.map(cartItem => 
                    cartItem.id === selectedItem.id 
                        ? { ...cartItem, quantity: cartItem.quantity + itemQuantity }
                        : cartItem
                ))
            } else {
                setCart([...cart, { ...selectedItem, quantity: itemQuantity }])
            }
            
            // Reset quantity after adding but keep modal open
            setItemQuantity(1)
            
            // Don't close modal - keep it open as requested
            console.log('Item added to cart, modal stays open')
        }
    }

    const addToCart = (item) => {
        console.log('🛒 Add to cart clicked for:', item.name)
        console.log('🛒 Current cart:', cart)
        console.log('🛒 User authenticated:', !!user)
        
        const existingItem = cart.find(cartItem => cartItem.id === item.id)
        if (existingItem) {
            setCart(cart.map(cartItem => 
                cartItem.id === item.id 
                    ? { ...cartItem, quantity: cartItem.quantity + 1 }
                    : cartItem
            ))
            console.log('🛒 Updated existing item quantity')
        } else {
            setCart([...cart, { ...item, quantity: 1 }])
            console.log('🛒 Added new item to cart')
        }
        
        // Show brief cart feedback but don't close any modals
        console.log('🛒 Item added to cart from menu grid')
    }

    const removeFromCart = (itemId) => {
        setCart(cart.filter(item => item.id !== itemId))
    }

    const updateQuantity = (itemId, newQuantity) => {
        if (newQuantity === 0) {
            removeFromCart(itemId)
        } else {
            setCart(cart.map(item => 
                item.id === itemId ? { ...item, quantity: newQuantity } : item
            ))
        }
    }

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
    }

    const placeOrder = async () => {
        if (cart.length === 0) return

        try {
            const orderData = {
                tableNumber: selectedTable,
                items: cart,
                totalAmount: calculateTotal(),
                status: 'pending', // pending -> confirmed -> preparing -> ready -> served -> billing -> completed
                customerName: user?.email?.split('@')[0] || 'Customer',
                timestamp: new Date(),
                createdAt: new Date()
            }

            const orderRef = await addDoc(collection(db, 'Orders'), orderData)
            const newOrder = { id: orderRef.id, ...orderData }
            
            setCurrentOrder(newOrder)
            setOrderStatus('ordered')
            setCart([])
            setActiveTab('status')
            
            // Close item details modal if open
            setShowItemDetails(false)
            setSelectedItem(null)
            setItemQuantity(1)
            
            console.log('Order placed successfully:', newOrder)
        } catch (error) {
            console.error('Error placing order:', error)
            alert('Failed to place order. Please try again.')
        }
    }

    const requestBill = async () => {
        try {
            if (currentOrder) {
                // Update order status to billing
                setOrderStatus('billing')
                console.log('Bill requested for table:', selectedTable)
            }
        } catch (error) {
            console.error('Error requesting bill:', error)
        }
    }

    const cancelOrder = async (orderId) => {
        try {
            // Update order status to cancelled in Firestore
            const orderRef = doc(db, 'Orders', orderId)
            await updateDoc(orderRef, {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelledBy: user?.uid
            })
            
            // If this is the current order, reset the order state
            if (currentOrder && currentOrder.id === orderId) {
                setCurrentOrder(null)
                setOrderStatus('browsing')
            }
            
            console.log('Order cancelled successfully:', orderId)
        } catch (error) {
            console.error('Error cancelling order:', error)
            alert('Failed to cancel order. Please try again.')
        }
    }

    // Submit order rating
    const submitRating = async () => {
        if (!currentOrder || orderRating === 0) return

        try {
            const orderRef = doc(db, 'Orders', currentOrder.id)
            await updateDoc(orderRef, {
                rating: orderRating,
                ratingComment: ratingComment,
                ratedAt: new Date()
            })
            
            setShowRatingModal(false)
            setOrderRating(0)
            setRatingComment('')
            console.log('Rating submitted successfully')
        } catch (error) {
            console.error('Error submitting rating:', error)
        }
    }

    // Check if order is completed and show rating modal
    useEffect(() => {
        if (currentOrder && orderStatus === 'completed' && !currentOrder.rating && !showRatingModal) {
            // Small delay to let the completion animation finish
            setTimeout(() => {
                setShowRatingModal(true)
            }, 2000)
        }
    }, [orderStatus, currentOrder, showRatingModal])

    const handleLogout = async () => {
        try {
            sessionStorage.setItem('justLoggedOut', 'true')
            
            // Close any open modals
            setShowItemDetails(false)
            setSelectedItem(null)
            setItemQuantity(1)
            
            await signOut(auth)
            console.log('User logged out successfully')
        } catch (error) {
            console.error('Error logging out:', error)
        }
    }

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             item.description.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesCategory && matchesSearch
    })

    // Show redirecting screen for staff users
    if (isRedirecting) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="animate-spin h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting to Your Dashboard...</h2>
                    <p className="text-gray-600">Please wait while we redirect you to your dashboard</p>
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
                                <button 
                                    onClick={() => {
                                        setSelectedTable(null)
                                        setOrderStatus('select-table')
                                        setActiveTab('menu')
                                        setCart([])
                                        setCurrentOrder(null)
                                        setShowTableSelection(false)
                                    }}
                                    className="flex items-center hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                                        <span className="text-white font-bold text-xl">🍽️</span>
                                    </div>
                                    <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        SmartServe
                                    </span>
                                </button>
                                {selectedTable && (
                                    <div className="ml-4 flex items-center bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl shadow-lg">
                                        <span className="text-lg mr-2">🍽️</span>
                                        <div className="flex flex-col">
                                            <span className="text-xs opacity-90 leading-none">Table</span>
                                            <span className="text-lg font-bold leading-none">{selectedTable}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Main Navigation Tabs - Always visible when user is logged in */}
                            {user && (
                                <div className="flex items-center space-x-2 mr-4">
                                    <button
                                        onClick={() => setActiveTab('tables')}
                                        className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                                            activeTab === 'tables' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <span>🏠</span>
                                        <span className="hidden md:inline">Tables</span>
                                    </button>
                                    {selectedTable && (
                                        <>
                                            <button
                                                onClick={() => setActiveTab('menu')}
                                                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                                                    activeTab === 'menu' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                                                }`}
                                            >
                                                <span>🍽️</span>
                                                <span className="hidden md:inline">Menu</span>
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('cart')}
                                                className={`px-4 py-2 rounded-lg transition-colors relative flex items-center space-x-2 ${
                                                    activeTab === 'cart' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                                                }`}
                                            >
                                                <span>🛒</span>
                                                <span className="hidden md:inline">Cart</span>
                                                {cart.length > 0 && (
                                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                                    </span>
                                                )}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setActiveTab('status')}
                                        className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                                            activeTab === 'status' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <span>📋</span>
                                        <span className="hidden md:inline">Orders</span>
                                        {userOrders.length > 0 && (
                                            <span className="ml-1 bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs">
                                                {userOrders.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('profile')}
                                        className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                                            activeTab === 'profile' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <span>👤</span>
                                        <span className="hidden md:inline">Profile</span>
                                    </button>
                                </div>
                            )}

                            {/* Quick Cart Button for when not on cart tab */}
                            {cart.length > 0 && activeTab !== 'cart' && selectedTable && (
                                <button 
                                    onClick={() => setActiveTab('cart')}
                                    className="relative bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors md:hidden"
                                >
                                    🛒 Cart
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                    </span>
                                </button>
                            )}
                            
                            {!loading && !user && (
                                <a href="/login" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                    Sign In
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Table Selection Screen - show for all users when no table selected and not on Tables tab, Profile tab, or Status tab */}
            {orderStatus === 'select-table' && activeTab !== 'tables' && activeTab !== 'profile' && activeTab !== 'status' && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                            {user ? `Welcome back, ${getUserDisplayName()}!` : 'Welcome to SmartServe'}
                        </h1>
                        <p className="text-xl text-gray-600 mb-8">
                            {user ? 'Select your table to start ordering from our delicious menu' : 'Ready to start ordering? Select your table to begin'}
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        {!showTableSelection ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-6">🍽️</div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Order?</h2>
                                <p className="text-lg text-gray-600 mb-8">
                                    Click the button below to select your table and start browsing our delicious menu
                                </p>
                                <button
                                    onClick={() => setShowTableSelection(true)}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
                                >
                                    🍽️ Select Your Table
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-2xl font-bold text-gray-900">Choose Your Table</h2>
                                    <button
                                        onClick={() => setShowTableSelection(false)}
                                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                                    >
                                        ← Back
                                    </button>
                                </div>
                                {availableTables.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 text-lg">No tables available at the moment</p>
                                        <button
                                            onClick={refreshTables}
                                            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                        >
                                            Refresh Tables
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 max-w-6xl mx-auto">
                                        {availableTables.map((table) => (
                                            <button
                                                key={table.tableNumber}
                                                onClick={() => selectTable(table.tableNumber)}
                                                className="group relative aspect-square bg-white border-2 border-gray-200 rounded-2xl hover:border-indigo-400 transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col items-center justify-center text-gray-700 hover:text-indigo-600 min-h-[80px] overflow-hidden"
                                            >
                                                {/* Background gradient on hover */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                                                
                                                {/* Table icon */}
                                                <div className="relative z-10 text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">
                                                    🍽️
                                                </div>
                                                
                                                {/* Table number */}
                                                <div className="relative z-10 text-lg font-bold group-hover:text-indigo-700 transition-colors duration-300">
                                                    {table.tableNumber}
                                                </div>
                                                
                                                {/* Status indicator */}
                                                <div className="absolute top-2 right-2 z-10">
                                                    <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                                                </div>
                                                
                                                {/* Hover effect overlay */}
                                                <div className="absolute inset-0 border-2 border-indigo-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Tables Tab - Dedicated table selection interface */}
            {activeTab === 'tables' && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    {!user ? (
                        <div className="text-center">
                            <div className="text-6xl mb-6">🏠</div>
                            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                                Select Your Table
                            </h1>
                            <p className="text-xl text-gray-600 mb-8">
                                Please sign in to select a table and start ordering
                            </p>
                            <a 
                                href="/login" 
                                className="bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors font-bold text-lg shadow-lg"
                            >
                                Sign In to Continue
                            </a>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-12">
                                <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                                    Select Your Table
                                </h1>
                                <p className="text-xl text-gray-600 mb-8">
                                    {selectedTable 
                                        ? `Currently at Table ${selectedTable}. Choose a different table if needed.`
                                        : 'Choose your table to start ordering from our delicious menu'
                                    }
                                </p>
                            </div>
                    
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        {selectedTable && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <span className="text-2xl">🍽️</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-green-900">Currently at Table {selectedTable}</h3>
                                            <p className="text-green-700">You can switch to a different table if needed</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <button
                                            onClick={() => setActiveTab('menu')}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                        >
                                            🍽️ Browse Menu
                                        </button>
                                        {cart.length > 0 && (
                                            <button
                                                onClick={() => setActiveTab('cart')}
                                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                            >
                                                🛒 View Cart ({cart.length})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Tables</h2>
                            {availableTables.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-6xl mb-4">🏠</div>
                                    <p className="text-gray-500 text-lg mb-4">No tables available at the moment</p>
                                    <button
                                        onClick={refreshTables}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        🔄 Refresh Tables
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 max-w-6xl mx-auto">
                                    {availableTables.map((table) => (
                                        <button
                                            key={table.tableNumber}
                                            onClick={() => selectTable(table.tableNumber)}
                                            className={`group relative aspect-square bg-white border-2 rounded-2xl hover:border-indigo-400 transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col items-center justify-center text-gray-700 hover:text-indigo-600 min-h-[80px] overflow-hidden ${
                                                selectedTable === table.tableNumber 
                                                    ? 'border-green-500 bg-green-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            {/* Background gradient on hover or selected */}
                                            <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-300 rounded-2xl ${
                                                selectedTable === table.tableNumber 
                                                    ? 'from-green-50 to-green-100 opacity-100'
                                                    : 'from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100'
                                            }`}></div>
                                            
                                            {/* Table icon */}
                                            <div className="relative z-10 text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">
                                                🍽️
                                            </div>
                                            
                                            {/* Table number */}
                                            <div className={`relative z-10 text-lg font-bold transition-colors duration-300 ${
                                                selectedTable === table.tableNumber 
                                                    ? 'text-green-700'
                                                    : 'group-hover:text-indigo-700'
                                            }`}>
                                                {table.tableNumber}
                                            </div>
                                            
                                            {/* Status indicator */}
                                            <div className="absolute top-2 right-2 z-10">
                                                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                                                    selectedTable === table.tableNumber 
                                                        ? 'bg-green-500'
                                                        : 'bg-green-400'
                                                }`}></div>
                                            </div>
                                            
                                            {/* Selected indicator */}
                                            {selectedTable === table.tableNumber && (
                                                <div className="absolute top-2 left-2 z-10">
                                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs">✓</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Hover effect overlay */}
                                            <div className={`absolute inset-0 border-2 rounded-2xl transition-opacity duration-300 ${
                                                selectedTable === table.tableNumber 
                                                    ? 'border-green-500 opacity-100'
                                                    : 'border-indigo-500 opacity-0 group-hover:opacity-100'
                                            }`}></div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Stats for logged users */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
                            <h3 className="text-xl font-bold text-indigo-900 mb-4">Your Account Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-indigo-600">{userOrders.length}</p>
                                    <p className="text-sm text-indigo-700">Total Orders</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-green-600">
                                        ৳{userOrders.filter(order => 
                                            order.status && 
                                            ['confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].includes(order.status)
                                        ).reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(2)}
                                    </p>
                                    <p className="text-sm text-green-700">Total Spent</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-purple-600">{cart.length}</p>
                                    <p className="text-sm text-purple-700">Items in Cart</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-orange-600">
                                        {userOrders.filter(order => order.status === 'completed').length}
                                    </p>
                                    <p className="text-sm text-orange-700">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>
                        </>
                    )}
                </div>
            )}

            {/* User Stats Dashboard - when user is logged in, on menu tab, but no table selected */}
            {user && orderStatus === 'select-table' && activeTab === 'menu' && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                            Your Account Overview
                        </h2>
                        <p className="text-lg text-gray-600 mb-8">
                            View your order history and account statistics
                        </p>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                            <div className="text-3xl mb-2">📋</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Your Orders</h3>
                            <p className="text-2xl font-bold text-indigo-600">{userOrders.length}</p>
                            <p className="text-gray-600 text-sm">Total orders placed</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                            <div className="text-3xl mb-2">💰</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Total Spent</h3>
                            <p className="text-2xl font-bold text-green-600">
                                ৳{userOrders.filter(order => 
                                    order.status && 
                                    ['confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].includes(order.status)
                                ).reduce((sum, order) => sum + (order.totalAmount || 0), 0).toFixed(2)}
                            </p>
                            <p className="text-gray-600 text-sm">Only confirmed orders</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                            <div className="text-3xl mb-2">⭐</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Completed</h3>
                            <p className="text-2xl font-bold text-purple-600">
                                {userOrders.filter(order => order.status === 'completed').length}
                            </p>
                            <p className="text-gray-600 text-sm">Finished orders</p>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-center mb-6">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setActiveTab('tables')}
                                className="bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                                🏠 Select Table
                            </button>
                            <button
                                onClick={() => setActiveTab('status')}
                                className="bg-indigo-600 text-white py-4 px-6 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                            >
                                📋 View Order History
                            </button>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className="bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                                👤 View Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Status Display */}
            {currentOrder && orderStatus !== 'select-table' && orderStatus !== 'browsing' && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-8">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-4 flex items-center justify-center space-x-3">
                                <span>Order Status</span>
                                <span>-</span>
                                <span className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                                    <span className="text-xl mr-2">🍽️</span>
                                    <span>Table {selectedTable}</span>
                                </span>
                            </h2>
                            <div className="flex justify-center items-center space-x-4">
                                {['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].map((status, index) => {
                                    const currentIndex = ['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].indexOf(orderStatus)
                                    const isCompleted = currentIndex > index
                                    const isCurrent = orderStatus === status
                                    
                                    const getStatusColor = () => {
                                        if (isCurrent) {
                                            return {
                                                'ordered': 'bg-blue-500 text-white shadow-lg shadow-blue-200',
                                                'confirmed': 'bg-green-500 text-white shadow-lg shadow-green-200',
                                                'preparing': 'bg-orange-500 text-white shadow-lg shadow-orange-200',
                                                'ready': 'bg-purple-500 text-white shadow-lg shadow-purple-200',
                                                'served': 'bg-indigo-500 text-white shadow-lg shadow-indigo-200',
                                                'billing': 'bg-yellow-500 text-black shadow-lg shadow-yellow-200',
                                                'completed': 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                            }[status] || 'bg-gray-400'
                                        } else if (isCompleted) {
                                            return 'bg-gray-300 text-gray-600'
                                        } else {
                                            return 'bg-gray-200 text-gray-400'
                                        }
                                    }

                                    return (
                                        <div key={status} className="flex items-center">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 ${getStatusColor()}`}>
                                                {status === 'ordered' && '📝'}
                                                {status === 'confirmed' && '✅'}
                                                {status === 'preparing' && '👨‍🍳'}
                                                {status === 'ready' && '🔔'}
                                                {status === 'served' && '🍽️'}
                                                {status === 'billing' && '💳'}
                                                {status === 'completed' && '✨'}
                                            </div>
                                            <span className="ml-2 text-sm capitalize font-medium">{status}</span>
                                            {index < 6 && <div className={`w-8 h-1 mx-3 rounded transition-all duration-500 ${isCompleted ? 'bg-gray-300' : 'bg-gray-200'}`}></div>}
                                        </div>
                                    )
                                })}
                            </div>
                            
                            {orderStatus === 'served' && (
                                <button
                                    onClick={requestBill}
                                    className="mt-6 bg-yellow-500 text-black px-6 py-3 rounded-lg hover:bg-yellow-400 transition-colors font-bold"
                                >
                                    Request Bill 💳
                                </button>
                            )}
                            
                            {orderStatus === 'completed' && (
                                <div className="mt-6 text-center">
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4">
                                        <div className="text-4xl mb-3">🎉</div>
                                        <h3 className="text-xl font-bold text-green-800 mb-2">Order Completed!</h3>
                                        <p className="text-green-700">Thank you for dining with us. We hope you enjoyed your meal!</p>
                                    </div>
                                    
                                    {!currentOrder?.rating && (
                                        <button
                                            onClick={() => setShowRatingModal(true)}
                                            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 font-bold shadow-lg"
                                        >
                                            ⭐ Rate Your Experience
                                        </button>
                                    )}
                                    
                                    {currentOrder?.rating && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <p className="text-yellow-800 font-medium">Thank you for your feedback!</p>
                                            <div className="flex justify-center mt-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <span key={star} className={`text-2xl ${star <= currentOrder.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                                                        ⭐
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Menu Display (when browsing) */}
            {orderStatus === 'browsing' && activeTab === 'menu' && (
                <>
                    {/* Hero Section */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                            <h1 className="text-4xl md:text-6xl font-bold mb-4">
                                Delicious Menu
                            </h1>
                            <p className="text-xl md:text-2xl text-indigo-100 mb-8 flex items-center justify-center space-x-3">
                                <span className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                                    <span className="text-2xl mr-2">🍽️</span>
                                    <span className="font-semibold">Table {selectedTable}</span>
                                </span>
                                <span>-</span>
                                <span>Discover our exquisite collection of culinary delights</span>
                            </p>
                            
                            {/* Search Bar */}
                            <div className="max-w-md mx-auto">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search for dishes..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-4 py-3 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-white/30"
                                    />
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {/* Availability Notice */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center space-x-2">
                                <span className="text-green-600">✅</span>
                                <p className="text-green-800 text-sm font-medium">
                                    Menu items shown are currently available. Availability is updated in real-time by our kitchen staff.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                                        selectedCategory === category
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-white text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>

                        {/* Menu Items Grid */}
                        {loading ? (
                            <div className="flex justify-center items-center py-16">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredItems.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredItems.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="relative group rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-80"
                                        style={{
                                            backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%), url(${item.image || 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat'
                                        }}
                                        onDoubleClick={() => {
                                            console.log('🔍 Double-click detected, opening item details for:', item.name)
                                            _openItemDetails(item)
                                        }}
                                        title="Double-click to view details"
                                    >
                                        {/* Fallback background image handling */}
                                        <img
                                            src={item.image || 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                                            alt=""
                                            className="hidden"
                                            onError={(e) => {
                                                console.log('Primary image failed, trying fallback for:', item.name);
                                                const cardElement = e.target.closest('[data-item-id]') || e.target.closest('.group');
                                                if (cardElement) {
                                                    cardElement.style.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%), url(https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80)`;
                                                }
                                            }}
                                            onLoad={() => {
                                                console.log('Background image loaded successfully for:', item.name);
                                            }}
                                        />
                                        
                                        {/* Price badge - Always visible */}
                                        <div className="absolute top-3 right-3 z-20">
                                            <span className="bg-white/95 backdrop-blur-sm text-indigo-600 px-3 py-1 rounded-full text-sm font-bold shadow-lg border border-white/20">
                                                ৳{item.price?.toFixed(2) || '0.00'}
                                            </span>
                                        </div>
                                        
                                        {/* Rating badge - Always visible */}
                                        {item.rating && (
                                            <div className="absolute top-3 left-3 z-20">
                                                <div className="bg-white/95 backdrop-blur-sm text-yellow-600 px-2 py-1 rounded-full text-xs font-semibold shadow-lg border border-white/20 flex items-center">
                                                    <span className="text-yellow-400 text-sm">⭐</span>
                                                    <span className="ml-1">{Number(item.rating).toFixed(1)}</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Content overlay at bottom */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 text-white z-20">
                                            <div className="mb-3">
                                                <h3 className="text-xl font-bold text-white mb-1 line-clamp-1">
                                                    {item.name}
                                                </h3>
                                                <p className="text-gray-200 text-sm line-clamp-2 opacity-90">
                                                    {item.description || 'Delicious dish prepared with fresh ingredients and authentic flavors.'}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center space-x-2">
                                                    {item.available === false && (
                                                        <span className="bg-red-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
                                                            ❌ Unavailable
                                                        </span>
                                                    )}
                                                    {item.isVegetarian && (
                                                        <span className="bg-green-500/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
                                                            🌱 Veg
                                                        </span>
                                                    )}
                                                    {item.isSpicy && (
                                                        <span className="bg-red-500/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
                                                            🌶️ Spicy
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Action button - Single Add to Cart button */}
                                            <div className="flex justify-center">
                                                {item.available === false ? (
                                                    <button 
                                                        disabled
                                                        className="bg-gray-400 text-gray-600 px-6 py-3 rounded-lg cursor-not-allowed font-medium text-sm shadow-lg min-w-[120px]"
                                                    >
                                                        ❌ Unavailable
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => {
                                                            console.log('🔍 Button clicked for item:', item.name)
                                                            e.stopPropagation()
                                                            console.log('🔍 About to call addToCart')
                                                            addToCart(item)
                                                        }}
                                                        className="bg-white text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm shadow-lg min-w-[120px]"
                                                    >
                                                        🛒 Add to Cart
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Hover overlay effect */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 z-5"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="text-6xl mb-4">🍽️</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">No items found</h3>
                                <p className="text-gray-600">
                                    {searchTerm ? 'Try a different search term' : 'No menu items available in this category'}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Cart View */}
            {activeTab === 'cart' && user && (
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                            🛒 Your Cart {selectedTable && `- Table ${selectedTable}`}
                        </h2>
                        
                        {!selectedTable ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🍽️</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Select a table first</h3>
                                <p className="text-gray-600 mb-6">Choose your table to start adding items to cart</p>
                                <button
                                    onClick={() => setOrderStatus('select-table')}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                                >
                                    Select Table
                                </button>
                            </div>
                        ) : cart.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🛒</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h3>
                                <p className="text-gray-600 mb-6">Add some delicious items from our menu</p>
                                <button
                                    onClick={() => setActiveTab('menu')}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                                >
                                    Browse Menu
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4 mb-8">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex items-center bg-gray-50 rounded-xl p-4">
                                            <img
                                                src={item.image || 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'}
                                                alt={item.name}
                                                className="w-16 h-16 object-cover rounded-lg mr-4"
                                            />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-lg">{item.name}</h4>
                                                <p className="text-gray-600 text-sm">{item.description}</p>
                                                <p className="text-indigo-600 font-semibold">৳{item.price.toFixed(2)} each</p>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <button 
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    className="w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xl font-bold w-8 text-center">{item.quantity}</span>
                                                <button 
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="w-8 h-8 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                            <div className="ml-4 text-right">
                                                <p className="text-lg font-bold">৳{(item.price * item.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="border-t pt-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-2xl font-bold">Total:</span>
                                        <span className="text-3xl font-bold text-indigo-600">৳{calculateTotal().toFixed(2)}</span>
                                    </div>
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={() => setActiveTab('menu')}
                                            className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors font-bold"
                                        >
                                            Add More Items
                                        </button>
                                        <button 
                                            onClick={placeOrder}
                                            className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-bold"
                                        >
                                            Place Order 🍽️
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Order Status View */}
            {activeTab === 'status' && user && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                            📋 Order History {selectedTable && `- Table ${selectedTable}`}
                        </h2>
                        
                        {/* Order Filter Options */}
                        <div className="mb-8">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Orders</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <button
                                        onClick={() => setOrderFilter('pending')}
                                        className={`px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                                            orderFilter === 'pending'
                                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                                : 'bg-white text-blue-700 border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>📝</span>
                                            <span>Pending Orders</span>
                                        </div>
                                        <div className="text-xs mt-1 opacity-80">
                                            {(() => {
                                                const pendingCount = userOrders.filter(order => order.status === 'pending' || order.status === 'ordered').length;
                                                console.log('Pending orders:', userOrders.filter(order => order.status === 'pending' || order.status === 'ordered'));
                                                console.log('All order statuses:', userOrders.map(order => order.status));
                                                return pendingCount;
                                            })()} orders
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => setOrderFilter('in-progress')}
                                        className={`px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                                            orderFilter === 'in-progress'
                                                ? 'bg-orange-500 text-white shadow-lg transform scale-105'
                                                : 'bg-white text-orange-700 border-2 border-orange-200 hover:bg-orange-50 hover:border-orange-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>👨‍🍳</span>
                                            <span>In Progress</span>
                                        </div>
                                        <div className="text-xs mt-1 opacity-80">
                                            {userOrders.filter(order => 
                                                order.status && 
                                                ['confirmed', 'preparing', 'ready', 'served', 'billing'].includes(order.status)
                                            ).length} orders
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => setOrderFilter('completed')}
                                        className={`px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                                            orderFilter === 'completed'
                                                ? 'bg-green-500 text-white shadow-lg transform scale-105'
                                                : 'bg-white text-green-700 border-2 border-green-200 hover:bg-green-50 hover:border-green-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>✨</span>
                                            <span>Completed</span>
                                        </div>
                                        <div className="text-xs mt-1 opacity-80">
                                            {userOrders.filter(order => order.status === 'completed').length} orders
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => setOrderFilter('cancelled')}
                                        className={`px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                                            orderFilter === 'cancelled'
                                                ? 'bg-red-500 text-white shadow-lg transform scale-105'
                                                : 'bg-white text-red-700 border-2 border-red-200 hover:bg-red-50 hover:border-red-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <span>❌</span>
                                            <span>Cancelled</span>
                                        </div>
                                        <div className="text-xs mt-1 opacity-80">
                                            {userOrders.filter(order => order.status === 'cancelled').length} orders
                                        </div>
                                    </button>
                                </div>
                                
                                {/* <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => setOrderFilter('all')}
                                        className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium text-sm ${
                                            orderFilter === 'all'
                                                ? 'bg-indigo-500 text-white shadow-lg'
                                                : 'bg-white text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <span>📊</span>
                                            <span>Show All Orders ({userOrders.length})</span>
                                        </div>
                                    </button>
                                </div> */}
                            </div>
                        </div>
                        
                        {/* Current Order Status */}
                        {currentOrder && (
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8 border border-indigo-200">
                                <h3 className="text-xl font-bold text-indigo-900 mb-4">Current Order Status</h3>
                                <div className="flex flex-wrap justify-center items-center gap-4 mb-4">
                                    {['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].map((status, index) => {
                                        const currentIndex = ['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].indexOf(orderStatus);
                                        const isCompleted = currentIndex > index;
                                        const isCurrent = orderStatus === status;
                                        
                                        const getStatusColor = () => {
                                            if (isCurrent) {
                                                return {
                                                    'ordered': 'bg-blue-500 text-white shadow-lg shadow-blue-200',
                                                    'confirmed': 'bg-green-500 text-white shadow-lg shadow-green-200',
                                                    'preparing': 'bg-orange-500 text-white shadow-lg shadow-orange-200',
                                                    'ready': 'bg-purple-500 text-white shadow-lg shadow-purple-200',
                                                    'served': 'bg-indigo-500 text-white shadow-lg shadow-indigo-200',
                                                    'billing': 'bg-yellow-500 text-black shadow-lg shadow-yellow-200',
                                                    'completed': 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                                }[status] || 'bg-gray-400'
                                            } else if (isCompleted) {
                                                return 'bg-gray-400 text-white'
                                            } else {
                                                return 'bg-gray-200 text-gray-500'
                                            }
                                        }

                                        return (
                                            <div key={status} className="flex items-center">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-500 ${getStatusColor()}`}>
                                                    {status === 'ordered' && '📝'}
                                                    {status === 'confirmed' && '✅'}
                                                    {status === 'preparing' && '👨‍🍳'}
                                                    {status === 'ready' && '🔔'}
                                                    {status === 'served' && '🍽️'}
                                                    {status === 'billing' && '💳'}
                                                    {status === 'completed' && '✨'}
                                                </div>
                                                <span className="ml-2 text-sm font-medium capitalize">{status}</span>
                                                {index < 6 && <div className={`w-8 h-1 mx-2 rounded transition-all duration-500 ${isCompleted ? 'bg-gray-400' : 'bg-gray-200'}`}></div>}
                                            </div>
                                        )
                                    })}
                                </div>
                                
                                <div className="bg-white rounded-lg p-4">
                                    <p className="text-lg font-semibold mb-2">Order Total: ৳{currentOrder.totalAmount?.toFixed(2)}</p>
                                    <p className="text-gray-600">Items: {currentOrder.items?.length} items</p>
                                </div>
                                
                                {orderStatus === 'served' && (
                                    <button
                                        onClick={requestBill}
                                        className="mt-4 bg-yellow-500 text-black px-6 py-3 rounded-lg hover:bg-yellow-400 transition-colors font-bold"
                                    >
                                        Request Bill 💳
                                    </button>
                                )}
                            </div>
                        )}
                        
                        {/* Order History */}
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {(() => {
                                const filteredOrdersCount = (() => {
                                    if (orderFilter === 'all') return userOrders.length
                                    if (orderFilter === 'pending') return userOrders.filter(order => order.status === 'pending' || order.status === 'ordered').length
                                    if (orderFilter === 'in-progress') return userOrders.filter(order => 
                                        order.status && 
                                        ['confirmed', 'preparing', 'ready', 'served', 'billing'].includes(order.status)
                                    ).length
                                    if (orderFilter === 'completed') return userOrders.filter(order => order.status === 'completed').length
                                    if (orderFilter === 'cancelled') return userOrders.filter(order => order.status === 'cancelled').length
                                    return 0
                                })()
                                
                                const getFilterTitle = () => {
                                    switch(orderFilter) {
                                        case 'pending': return 'Pending Orders'
                                        case 'in-progress': return 'In Progress Orders'
                                        case 'completed': return 'Completed Orders'
                                        case 'cancelled': return 'Cancelled Orders'
                                        default: return selectedTable ? 'Previous Orders' : 'All Your Orders'
                                    }
                                }
                                
                                return `${getFilterTitle()} (${filteredOrdersCount})`
                            })()}
                        </h3>
                        {(() => {
                            // Filter orders based on selected filter
                            const getFilteredOrders = () => {
                                console.log('Current filter:', orderFilter);
                                console.log('All orders:', userOrders);
                                console.log('Order statuses:', userOrders.map(order => ({ id: order.id, status: order.status })));
                                
                                if (orderFilter === 'all') return userOrders
                                if (orderFilter === 'pending') {
                                    const pending = userOrders.filter(order => order.status === 'pending' || order.status === 'ordered')
                                    console.log('Filtered pending orders:', pending);
                                    return pending;
                                }
                                if (orderFilter === 'in-progress') return userOrders.filter(order => 
                                    order.status && 
                                    ['confirmed', 'preparing', 'ready', 'served', 'billing'].includes(order.status)
                                )
                                if (orderFilter === 'completed') return userOrders.filter(order => order.status === 'completed')
                                if (orderFilter === 'cancelled') return userOrders.filter(order => order.status === 'cancelled')
                                return []
                            }
                            
                            const filteredOrders = getFilteredOrders()
                            
                            if (filteredOrders.length === 0) {
                                const getEmptyMessage = () => {
                                    switch(orderFilter) {
                                        case 'pending': return { icon: '📝', title: 'No pending orders', desc: 'You have no pending orders at the moment' }
                                        case 'in-progress': return { icon: '👨‍🍳', title: 'No orders in progress', desc: 'You have no orders currently being prepared' }
                                        case 'completed': return { icon: '✨', title: 'No completed orders', desc: 'You have no completed orders yet' }
                                        case 'cancelled': return { icon: '❌', title: 'No cancelled orders', desc: 'You have no cancelled orders' }
                                        default: return { icon: '📋', title: 'No order history', desc: 'Your orders will appear here' }
                                    }
                                }
                                
                                const emptyMsg = getEmptyMessage()
                                
                                return (
                                    <div className="text-center py-8">
                                        <div className="text-6xl mb-4">{emptyMsg.icon}</div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{emptyMsg.title}</h3>
                                        <p className="text-gray-600 mb-6">{emptyMsg.desc}</p>
                                    </div>
                                )
                            }
                            
                            return (
                                <div className="space-y-4">
                                    {filteredOrders.map((order) => (
                                    <div key={order.id} className="bg-gray-50 rounded-xl p-6 border-l-4 border-indigo-500">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-lg">Order #{order.id.slice(-6)}</h4>
                                                <p className="text-gray-600">Table {order.tableNumber}</p>
                                                <p className="text-sm text-gray-500">
                                                    {order.timestamp?.toDate().toLocaleDateString()} at {order.timestamp?.toDate().toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-indigo-600">৳{order.totalAmount?.toFixed(2)}</p>
                                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                                    order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                    order.status === 'served' ? 'bg-indigo-100 text-indigo-800' :
                                                    order.status === 'ready' ? 'bg-purple-100 text-purple-800' :
                                                    order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                                                    order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                    order.status === 'billing' ? 'bg-yellow-100 text-yellow-800' :
                                                    order.status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {order.status === 'ordered' && '📝 Ordered'}
                                                    {order.status === 'pending' && '📝 Pending'}
                                                    {order.status === 'confirmed' && '✅ Confirmed'}
                                                    {order.status === 'preparing' && '👨‍🍳 Preparing'}
                                                    {order.status === 'ready' && '🔔 Ready'}
                                                    {order.status === 'served' && '🍽️ Served'}
                                                    {order.status === 'billing' && '💳 Billing'}
                                                    {order.status === 'completed' && '✨ Completed'}
                                                    {order.status === 'cancelled' && '❌ Cancelled'}
                                                    {!['ordered', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed', 'cancelled'].includes(order.status) && order.status}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Order Status Progress Bar */}
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-gray-700">Order Progress</span>
                                                <span className="text-sm text-gray-500">
                                                    {order.status === 'completed' ? '100%' : 
                                                     order.status === 'billing' ? '90%' :
                                                     order.status === 'served' ? '75%' :
                                                     order.status === 'ready' ? '60%' :
                                                     order.status === 'preparing' ? '45%' :
                                                     order.status === 'confirmed' ? '30%' :
                                                     order.status === 'cancelled' ? '0%' :
                                                     '15%'} Complete
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full transition-all duration-300 ${
                                                        order.status === 'completed' ? 'bg-emerald-500 w-full' :
                                                        order.status === 'billing' ? 'bg-yellow-500 w-6/7' :
                                                        order.status === 'served' ? 'bg-indigo-500 w-5/6' :
                                                        order.status === 'ready' ? 'bg-purple-500 w-4/6' :
                                                        order.status === 'preparing' ? 'bg-orange-500 w-3/6' :
                                                        order.status === 'confirmed' ? 'bg-green-500 w-2/6' :
                                                        order.status === 'cancelled' ? 'bg-red-500 w-0' :
                                                        'bg-blue-400 w-1/6'
                                                    }`}
                                                ></div>
                                            </div>
                                        </div>
                                        
                                        {/* Status Steps */}
                                        <div className="mb-4">
                                            <div className="flex flex-wrap justify-center items-center gap-2 text-xs">
                                                {['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].map((status, index) => {
                                                    const currentStatusIndex = ['ordered', 'confirmed', 'preparing', 'ready', 'served', 'billing', 'completed'].indexOf(order.status);
                                                    const isCurrentStatus = order.status === status;
                                                    const isPastStatus = currentStatusIndex > index;
                                                    const statusEmojis = {
                                                        ordered: '📝',
                                                        confirmed: '✅',
                                                        preparing: '👨‍🍳',
                                                        ready: '🔔',
                                                        served: '🍽️',
                                                        billing: '💳',
                                                        completed: '✨'
                                                    };
                                                    
                                                    const getStatusColor = () => {
                                                        if (isCurrentStatus) {
                                                            return {
                                                                'ordered': 'bg-blue-500 text-white shadow-sm',
                                                                'confirmed': 'bg-green-500 text-white shadow-sm',
                                                                'preparing': 'bg-orange-500 text-white shadow-sm',
                                                                'ready': 'bg-purple-500 text-white shadow-sm',
                                                                'served': 'bg-indigo-500 text-white shadow-sm',
                                                                'billing': 'bg-yellow-500 text-white shadow-sm',
                                                                'completed': 'bg-emerald-500 text-white shadow-sm'
                                                            }[status] || 'bg-gray-400 text-white'
                                                        } else if (isPastStatus) {
                                                            return 'bg-gray-400 text-white'
                                                        } else {
                                                            return 'bg-gray-200 text-gray-500'
                                                        }
                                                    }
                                                    
                                                    const getTextColor = () => {
                                                        if (isCurrentStatus) {
                                                            return {
                                                                'ordered': 'font-bold text-blue-700',
                                                                'confirmed': 'font-bold text-green-700',
                                                                'preparing': 'font-bold text-orange-700',
                                                                'ready': 'font-bold text-purple-700',
                                                                'served': 'font-bold text-indigo-700',
                                                                'completed': 'font-bold text-emerald-700'
                                                            }[status] || 'font-bold text-gray-700'
                                                        } else if (isPastStatus) {
                                                            return 'text-gray-600 font-medium'
                                                        } else {
                                                            return 'text-gray-500'
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <div key={status} className="flex items-center">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${getStatusColor()}`}>
                                                                {statusEmojis[status]}
                                                            </div>
                                                            <span className={`ml-1 capitalize text-xs transition-all duration-300 ${getTextColor()}`}>
                                                                {status}
                                                            </span>
                                                            {index < 5 && (
                                                                <div className={`w-4 h-1 mx-1 rounded transition-all duration-300 ${
                                                                    isPastStatus ? 'bg-gray-400' : 'bg-gray-200'
                                                                }`}></div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                                            {order.items?.map((item, index) => (
                                                <div key={index} className="text-sm bg-white rounded p-2">
                                                    <span className="font-medium">{item.name}</span>
                                                    <span className="text-gray-600"> x{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Cancel Order Button - Only show for pending/ordered status */}
                                        {(order.status === 'pending' || order.status === 'ordered') && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                                        <span className="text-sm text-blue-600 font-medium">
                                                            Waiting for waiter confirmation
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
                                                                cancelOrder(order.id)
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 text-sm font-medium flex items-center space-x-2 shadow-md hover:shadow-lg"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                        </svg>
                                                        <span>Cancel Order</span>
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    You can cancel this order until it's confirmed by the waiter
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )})()}
                    </div>
                </div>
            )}

            {/* Profile View */}
            {activeTab === 'profile' && user && (
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Profile Header Card */}
                        <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
                            {/* Background Pattern */}
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600"></div>
                            <div className="absolute inset-0 opacity-10">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <defs>
                                        <pattern id="profilePattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                            <circle cx="10" cy="10" r="2" fill="white" opacity="0.3"/>
                                        </pattern>
                                    </defs>
                                    <rect width="100" height="100" fill="url(#profilePattern)"/>
                                </svg>
                            </div>
                            
                            {/* Header Content */}
                            <div className="relative px-8 py-12 text-center">
                                <div className="relative inline-block mb-6">
                                    <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl border-4 border-white">
                                        <span className="text-indigo-600 text-5xl">👤</span>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                        </svg>
                                    </div>
                                </div>
                                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
                                    {userProfile?.firstName && userProfile?.lastName 
                                        ? `${userProfile.firstName} ${userProfile.lastName}`
                                        : getUserDisplayName()
                                    }
                                </h1>
                                <p className="text-xl text-blue-100 mb-2">{user.email}</p>
                                <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                    Active Member
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Personal Information - Takes 2/3 width */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                    {/* Section Header */}
                                    <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 border-b border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                                    </svg>
                                                </div>
                                                <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsEditingProfile(!isEditingProfile)
                                                    if (!isEditingProfile) {
                                                        setEditProfileData({
                                                            firstName: userProfile?.firstName || '',
                                                            lastName: userProfile?.lastName || ''
                                                        })
                                                    }
                                                }}
                                                className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                    isEditingProfile 
                                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                                                }`}
                                            >
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {isEditingProfile ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                    )}
                                                </svg>
                                                {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="p-6">
                                        {isEditingProfile ? (
                                            <div className="space-y-6">
                                                <div className="text-center pb-6 border-b border-gray-100">
                                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Update Your Information</h3>
                                                    <p className="text-gray-600">Keep your profile information current and accurate</p>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">First Name</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Enter your first name"
                                                                value={editProfileData.firstName}
                                                                onChange={(e) => setEditProfileData({...editProfileData, firstName: e.target.value})}
                                                                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                                                            />
                                                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="block text-sm font-semibold text-gray-700">Last Name</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Enter your last name"
                                                                value={editProfileData.lastName}
                                                                onChange={(e) => setEditProfileData({...editProfileData, lastName: e.target.value})}
                                                                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                                                            />
                                                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100">
                                                    <button
                                                        onClick={() => {
                                                            setIsEditingProfile(false)
                                                            setEditProfileData({ firstName: '', lastName: '' })
                                                        }}
                                                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                                                    >
                                                        Cancel Changes
                                                    </button>
                                                    <button
                                                        onClick={saveProfile}
                                                        disabled={!editProfileData.firstName.trim() || !editProfileData.lastName.trim()}
                                                        className={`px-8 py-3 rounded-xl transition-all duration-200 font-medium flex items-center space-x-2 ${
                                                            editProfileData.firstName.trim() && editProfileData.lastName.trim()
                                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                                                        </svg>
                                                        <span>Save Changes</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="group p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 hover:border-blue-200 transition-all duration-200">
                                                    <div className="flex items-center mb-3">
                                                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-semibold text-blue-700">Full Name</label>
                                                            <p className="text-lg font-bold text-gray-900 mt-1">
                                                                {userProfile?.firstName && userProfile?.lastName 
                                                                    ? `${userProfile.firstName} ${userProfile.lastName}`
                                                                    : getUserDisplayName()
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="group p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 hover:border-emerald-200 transition-all duration-200">
                                                    <div className="flex items-center mb-3">
                                                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-semibold text-emerald-700">Email Address</label>
                                                            <p className="text-lg font-bold text-gray-900 mt-1 break-words">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="group p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 hover:border-purple-200 transition-all duration-200">
                                                    <div className="flex items-center mb-3">
                                                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-semibold text-purple-700">Username</label>
                                                            <p className="text-lg font-bold text-gray-900 mt-1">{user.email?.split('@')[0] || 'User'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="group p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border border-orange-100 hover:border-orange-200 transition-all duration-200">
                                                    <div className="flex items-center mb-3">
                                                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-200">
                                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-semibold text-orange-700">Account Status</label>
                                                            <p className="text-lg font-bold text-green-600 mt-1 flex items-center">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                                                Active
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Current Session Card */}
                                {selectedTable && (
                                    <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
                                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
                                                    </svg>
                                                </div>
                                                <h2 className="text-xl font-bold text-white">Current Dining Session</h2>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                                                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                        <span className="text-white text-2xl font-bold">#{selectedTable}</span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-green-700 mb-1">Table Number</p>
                                                    <p className="text-2xl font-bold text-green-600">{selectedTable}</p>
                                                </div>
                                                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                                                    <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"/>
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm font-semibold text-blue-700 mb-1">Items in Cart</p>
                                                    <p className="text-2xl font-bold text-blue-600">{cart.length}</p>
                                                </div>
                                                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                                                    <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm font-semibold text-purple-700 mb-1">Cart Total</p>
                                                    <p className="text-2xl font-bold text-purple-600">৳{calculateTotal().toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Sidebar - Takes 1/3 width */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* Quick Actions */}
                                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                                </svg>
                                            </div>
                                            <h2 className="text-lg font-bold text-white">Quick Actions</h2>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-3">
                                        <button
                                            onClick={() => setActiveTab('menu')}
                                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                            </svg>
                                            <span>Browse Menu</span>
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('status')}
                                            className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white py-3 px-4 rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                                            </svg>
                                            <span>View Orders</span>
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 px-4 rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                                            </svg>
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cart Sidebar */}
            {showCart && cart.length > 0 && (
                <div className="fixed right-4 top-20 w-80 bg-white rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Your Order</h3>
                            <button 
                                onClick={() => setShowCart(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-4">
                        {cart.map((item) => (
                            <div key={item.id} className="flex items-center mb-3 pb-3 border-b">
                                <img
                                    src={item.image || 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'}
                                    alt={item.name}
                                    className="w-12 h-12 object-cover rounded-lg mr-3 bg-gray-200"
                                    onError={(e) => {
                                        e.target.src = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80';
                                    }}
                                />
                                <div className="flex-1">
                                    <h4 className="font-medium text-sm">{item.name}</h4>
                                    <p className="text-xs text-gray-600">৳{item.price.toFixed(2)} each</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-6 h-6 bg-gray-200 rounded text-xs"
                                    >
                                        -
                                    </button>
                                    <span className="text-sm">{item.quantity}</span>
                                    <button 
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-6 h-6 bg-gray-200 rounded text-xs"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))}
                        
                        <div className="border-t pt-3">
                            <div className="flex justify-between font-bold text-lg mb-4">
                                <span>Total: ৳{calculateTotal().toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={placeOrder}
                                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-bold"
                            >
                                Place Order 🍽️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Item Details Modal */}
            {showItemDetails && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="relative overflow-hidden">
                            {/* Loading placeholder for modal image */}
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse"></div>
                            
                            <img
                                src={selectedItem.image || 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                                alt={selectedItem.name || 'Menu item'}
                                className="relative z-10 w-full h-64 object-cover rounded-t-2xl"
                                onError={(e) => {
                                    console.log('Modal image failed, using fallback');
                                    e.target.src = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                                    e.target.onerror = () => {
                                        e.target.src = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                                    };
                                }}
                                onLoad={(e) => {
                                    // Hide loading animation
                                    const loadingDiv = e.target.parentElement.querySelector('.animate-pulse');
                                    if (loadingDiv) {
                                        loadingDiv.style.opacity = '0';
                                        setTimeout(() => {
                                            loadingDiv.style.display = 'none';
                                        }, 300);
                                    }
                                }}
                                loading="eager"
                            />
                            <button
                                onClick={closeItemDetails}
                                className="absolute top-4 right-4 z-20 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors shadow-lg"
                            >
                                ✕
                            </button>
                            <div className="absolute top-4 left-4 z-20">
                                <span className="bg-white bg-opacity-90 backdrop-blur-sm text-indigo-600 px-4 py-2 rounded-full text-lg font-bold shadow-lg">
                                    ৳{selectedItem.price?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedItem.name}</h2>
                                    {selectedItem.rating && (
                                        <div className="flex items-center mb-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                            <div className="flex items-center">
                                                <span className="text-yellow-400 text-2xl">⭐</span>
                                                <div className="ml-3">
                                                    <div className="flex items-center">
                                                        <span className="text-xl font-bold text-gray-800">
                                                            {Number(selectedItem.rating).toFixed(1)}
                                                        </span>
                                                        <span className="text-gray-600 ml-2">/ 5.0</span>
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {selectedItem.reviewCount ? 
                                                            `Based on ${selectedItem.reviewCount} user reviews` : 
                                                            'User Rating'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedItem.rating >= 4.5 && (
                                                <div className="ml-auto">
                                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                                        🏆 Highly Rated
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 mb-4">
                                {selectedItem.isVegetarian && (
                                    <span className="bg-green-100 text-green-800 px-3 py-2 rounded-full text-sm font-medium">
                                        🌱 Vegetarian
                                    </span>
                                )}
                                {selectedItem.isSpicy && (
                                    <span className="bg-red-100 text-red-800 px-3 py-2 rounded-full text-sm font-medium">
                                        🌶️ Spicy
                                    </span>
                                )}
                                {selectedItem.category && (
                                    <span className="bg-blue-100 text-blue-800 px-3 py-2 rounded-full text-sm font-medium">
                                        {selectedItem.category}
                                    </span>
                                )}
                            </div>
                            
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {selectedItem.description || 'Delicious dish prepared with fresh ingredients and authentic flavors.'}
                                </p>
                            </div>
                            
                            {selectedItem.ingredients && (
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingredients</h3>
                                    <p className="text-gray-600">{selectedItem.ingredients}</p>
                                </div>
                            )}
                            
                            {selectedItem.allergens && (
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Allergen Information</h3>
                                    <p className="text-red-600">{selectedItem.allergens}</p>
                                </div>
                            )}
                            
                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-4">
                                        <span className="text-lg font-medium text-gray-700">Quantity:</span>
                                        <div className="flex items-center space-x-3">
                                            <button 
                                                onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                                                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-lg font-medium transition-colors"
                                            >
                                                -
                                            </button>
                                            <span className="text-xl font-bold w-12 text-center">{itemQuantity}</span>
                                            <button 
                                                onClick={() => setItemQuantity(itemQuantity + 1)}
                                                className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-lg font-medium transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Total</p>
                                        <p className="text-2xl font-bold text-indigo-600">
                                            ৳{(selectedItem.price * itemQuantity).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex space-x-4">
                                    <button
                                        onClick={closeItemDetails}
                                        className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors font-bold"
                                    >
                                        Close
                                    </button>
                                    <button 
                                        onClick={addItemToCart}
                                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-bold"
                                    >
                                        🛒 Add ৳{(selectedItem.price * itemQuantity).toFixed(2)} to Cart
                                    </button>
                                </div>
                                
                                {/* Cart Status and Actions */}
                                {cart.some(cartItem => cartItem.id === selectedItem.id) && (
                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-green-800 text-sm font-medium">
                                                ✅ This item is in your cart
                                            </p>
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">
                                                {cart.find(cartItem => cartItem.id === selectedItem.id)?.quantity || 0} items
                                            </span>
                                        </div>
                                        <div className="text-xs text-green-700 mb-3">
                                            Total cart value: ৳{cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => setActiveTab('cart')}
                                                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                            >
                                                🛒 View Cart ({cart.length} items)
                                            </button>
                                            {cart.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        placeOrder()
                                                        closeItemDetails()
                                                    }}
                                                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                                >
                                                    🍽️ Place Order Now
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* If no items in cart yet */}
                                {!cart.some(cartItem => cartItem.id === selectedItem.id) && cart.length > 0 && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-blue-800 text-sm text-center">
                                            🛒 You have {cart.length} other item(s) in your cart
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Modal */}
            {showRatingModal && currentOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">⭐</div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Rate Your Experience</h2>
                            <p className="text-gray-600">How was your dining experience today?</p>
                        </div>
                        
                        <div className="mb-6">
                            <div className="flex justify-center space-x-2 mb-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setOrderRating(star)}
                                        className={`text-4xl transition-all duration-200 hover:scale-110 ${
                                            star <= orderRating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                                        }`}
                                    >
                                        ⭐
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-sm text-gray-500">
                                {orderRating === 0 && 'Click stars to rate'}
                                {orderRating === 1 && 'Poor'}
                                {orderRating === 2 && 'Fair'}
                                {orderRating === 3 && 'Good'}
                                {orderRating === 4 && 'Very Good'}
                                {orderRating === 5 && 'Excellent'}
                            </p>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comments (Optional)
                            </label>
                            <textarea
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                placeholder="Tell us about your experience..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                rows="3"
                            />
                        </div>
                        
                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowRatingModal(false)
                                    setOrderRating(0)
                                    setRatingComment('')
                                }}
                                className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                            >
                                Skip
                            </button>
                            <button
                                onClick={submitRating}
                                disabled={orderRating === 0}
                                className={`flex-1 py-3 rounded-lg transition-colors font-medium ${
                                    orderRating > 0 
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Submit Rating
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-12 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-xl">🍽️</span>
                            </div>
                            <span className="text-2xl font-bold">SmartServe</span>
                        </div>
                        <p className="text-gray-400 mb-4">Table-wise ordering made simple</p>
                        <p className="text-gray-500">&copy; 2025 SmartServe. All rights reserved.</p>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                .line-clamp-1 {
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                
                .line-clamp-2 {
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </div>
    )
}