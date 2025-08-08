import React, { useState, useEffect } from 'react'
import { db } from '../../services/firebase/config.js'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'

export default function MenuManagement({ onDataChange }) {
  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('items') // 'items' or 'categories'
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    subcategory: '',
    description: '',
    isVegetarian: false,
    isSpicy: false,
    isVisible: true,
    rating: 4.5,
    imageUrl: ''
  })
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    parentCategory: '', // For subcategories
    isActive: true
  })
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')

  useEffect(() => {
    fetchMenuItems()
    fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'Categories'))
      const categoriesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCategories(categoriesData)
      
      // Set default category if available
      if (categoriesData.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: categoriesData[0].name }))
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'MenuItems'))
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setMenuItems(items)
    } catch (error) {
      console.error('Error fetching menu items:', error)
    }
  }

  // Category Management Functions
  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const categoryData = {
        ...categoryFormData,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await addDoc(collection(db, 'Categories'), categoryData)
      
      setIsCategoryModalOpen(false)
      resetCategoryForm()
      fetchCategories()
      
      if (onDataChange) {
        onDataChange()
      }
      
      showNotification(`Category "${categoryFormData.name}" added successfully!`, 'success')
    } catch (error) {
      console.error('Error adding category:', error)
      showNotification('Failed to add category', 'error')
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (categoryId, categoryName) => {
    if (window.confirm(`Are you sure you want to delete category "${categoryName}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'Categories', categoryId))
        fetchCategories()
        
        if (onDataChange) {
          onDataChange()
        }
        
        showNotification(`Category "${categoryName}" deleted successfully!`, 'success')
      } catch (error) {
        console.error('Error deleting category:', error)
        showNotification('Failed to delete category', 'error')
      }
    }
  }

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      parentCategory: '',
      isActive: true
    })
  }

  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div')
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500'
    const icon = type === 'success' ? '✅' : '❌'
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <span>${icon}</span>
        <span>${message}</span>
      </div>
    `
    document.body.appendChild(notification)
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  }

  // Helper functions to get categories and subcategories
  const getMainCategories = () => {
    return categories.filter(cat => !cat.parentCategory)
  }

  const getSubCategories = (parentCategory) => {
    return categories.filter(cat => cat.parentCategory === parentCategory)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const itemData = {
        ...formData,
        price: parseFloat(formData.price),
        image: formData.imageUrl,
        rating: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await addDoc(collection(db, 'MenuItems'), itemData)
      
      setIsAddModalOpen(false)
      resetForm()
      fetchMenuItems()
      
      // Notify parent component of data change
      if (onDataChange) {
        onDataChange()
      }
      
      showNotification(`Menu item "${formData.name}" added successfully!`, 'success')
      
      console.log('Menu item added successfully:', itemData)
    } catch (error) {
      console.error('Error adding menu item:', error)
      showNotification('Failed to add menu item', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const itemData = {
        ...formData,
        price: parseFloat(formData.price),
        image: formData.imageUrl,
        updatedAt: new Date()
      }

      await updateDoc(doc(db, 'MenuItems', selectedItem.id), itemData)
      
      setIsEditModalOpen(false)
      setSelectedItem(null)
      resetForm()
      fetchMenuItems()
      
      // Notify parent component of data change
      if (onDataChange) {
        onDataChange()
      }
      
      alert('Menu item updated successfully!')
    } catch (error) {
      console.error('Error updating menu item:', error)
      alert('Failed to update menu item')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'MenuItems', item.id))
        fetchMenuItems()
        
        // Notify parent component of data change
        if (onDataChange) {
          onDataChange()
        }
        
        alert('Menu item deleted successfully!')
      } catch (error) {
        console.error('Error deleting menu item:', error)
        alert('Failed to delete menu item')
      }
    }
  }

  const toggleVisibility = async (item) => {
    try {
      await updateDoc(doc(db, 'MenuItems', item.id), {
        isVisible: !item.isVisible,
        updatedAt: new Date()
      })
      fetchMenuItems()
      
      // Notify parent component of data change
      if (onDataChange) {
        onDataChange()
      }
    } catch (error) {
      console.error('Error toggling visibility:', error)
      alert('Failed to update visibility')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: '',
      subcategory: '',
      description: '',
      isVegetarian: false,
      isSpicy: false,
      isVisible: true,
      rating: 4.5,
      imageUrl: ''
    })
  }

  const openEditModal = (item) => {
    setSelectedItem(item)
    setFormData({ 
      ...item, 
      imageUrl: item.image || ''
    })
    setIsEditModalOpen(true)
  }

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-8">
      {/* Menu Management Header with Beautiful Design */}
      <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-2xl shadow-xl p-8 border border-emerald-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600 bg-clip-text text-transparent mb-2">
              🍽️ Menu Management Center
            </h1>
            <p className="text-emerald-600 text-lg font-medium mb-4">
              Manage your restaurant's delicious menu items and categories
            </p>
            
            {/* Enhanced Statistics Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2 bg-white/60 px-4 py-2 rounded-xl shadow-sm">
                <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">{menuItems.filter(item => item.isVisible).length} Visible Items</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/60 px-4 py-2 rounded-xl shadow-sm">
                <div className="w-3 h-3 bg-gradient-to-r from-gray-400 to-slate-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">{menuItems.filter(item => !item.isVisible).length} Hidden Items</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/60 px-4 py-2 rounded-xl shadow-sm">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-semibold text-gray-700">{categories.length} Categories</span>
              </div>
            </div>
          </div>
          
          {/* Enhanced Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
          {/* Add Category Button */}
          <div className="group relative">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-2xl hover:shadow-purple-500/25 transform hover:scale-105 transition-all duration-300 border-2 border-transparent hover:border-white/20 min-w-[180px]"
            >
              {/* Animated background overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* Glowing effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-400/20 to-purple-400/20 blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              
              {/* Content */}
              <div className="relative flex items-center justify-center space-x-2">
                <div className="bg-white/20 p-1.5 rounded-full group-hover:bg-white/30 transition-colors duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <span className="font-semibold tracking-wide">Add Category</span>
              </div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000"></div>
            </button>
            
            {/* Floating badge */}
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg transform rotate-12 group-hover:rotate-6 transition-transform duration-300">
              ✨ New
            </div>
          </div>

          {/* Add Menu Item Button */}
          <div className="group relative">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-2xl hover:shadow-orange-500/25 transform hover:scale-105 transition-all duration-300 border-2 border-transparent hover:border-white/20 min-w-[180px]"
            >
              {/* Animated background overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 via-red-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* Glowing effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-400/20 to-red-400/20 blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              
              {/* Content */}
              <div className="relative flex items-center justify-center space-x-2">
                <div className="bg-white/20 p-1.5 rounded-full group-hover:bg-white/30 transition-colors duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="font-semibold tracking-wide">Add Menu Item</span>
              </div>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000"></div>
            </button>
            
            {/* Floating badge */}
            <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-400 to-emerald-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg transform rotate-12 group-hover:rotate-6 transition-transform duration-300">
              🍽️ Menu
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Enhanced Tab Navigation */}
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('items')}
          className={`py-3 px-6 font-medium text-sm focus:outline-none rounded-t-lg transition-all duration-200 ${
            activeTab === 'items'
              ? 'border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          🍽️ Menu Items ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`py-3 px-6 font-medium text-sm focus:outline-none rounded-t-lg transition-all duration-200 ${
            activeTab === 'categories'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          📁 Categories ({categories.length})
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="mt-6">
        {/* Tab Content */}
        {activeTab === 'items' && (
          <div>
            {/* Enhanced Filters and Search Section */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <span className="text-emerald-600 mr-2">🔍</span>
                  Search Menu Items
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, description, or category..."
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm bg-white shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="lg:w-64">
                <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <span className="text-blue-600 mr-2">📁</span>
                  Filter by Category
                </label>
                <select
                  className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm bg-white shadow-sm"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Enhanced Search Results Summary */}
          {(searchTerm || filterCategory !== 'All') && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    ✨ Showing <span className="text-emerald-600 font-bold">{filteredItems.length}</span> of <span className="font-bold">{menuItems.length}</span> items
                    {searchTerm && (
                      <span className="ml-2">
                        for "<span className="font-medium text-gray-800">{searchTerm}</span>"
                      </span>
                    )}
                    {filterCategory !== 'All' && (
                      <span className="ml-2">
                        in <span className="font-medium text-gray-800">{filterCategory}</span>
                      </span>
                    )}
                  </p>
                </div>
                {(searchTerm || filterCategory !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterCategory('All')
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                  >
                    🔄 Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Menu Items Grid */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">🍽️ Menu Items Collection</h3>
              <p className="text-gray-600">Browse and manage your delicious menu offerings</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-102 border border-gray-100">
                  <div className="relative h-48">
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="absolute top-3 right-3 flex gap-2">
                      {item.isVegetarian && (
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          🌱 Veg
                        </span>
                      )}
                      {item.isSpicy && (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          🌶️ Spicy
                        </span>
                      )}
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                        item.isVisible ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                      }`}>
                        {item.isVisible ? '✅ Visible' : '❌ Hidden'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg text-gray-800 line-clamp-1">{item.name}</h3>
                <span className="text-xl font-bold text-primary">৳{item.price}</span>
              </div>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="badge badge-outline">{item.category}</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-sm font-medium">{item.rating}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(item)}
                  className="btn btn-sm btn-outline flex-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleVisibility(item)}
                  className={`btn btn-sm flex-1 ${
                    item.isVisible ? 'btn-warning' : 'btn-success'
                  }`}
                >
                  {item.isVisible ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="btn btn-sm btn-error"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

              {filteredItems.length === 0 && (
                <div className="col-span-full">
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🍽️</div>
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No menu items found</h3>
                    <p className="text-gray-500">Add your first menu item to get started!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getMainCategories().map((category) => (
              <div key={category.id} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{category.name}</h3>
                    {category.description && (
                      <p className="text-gray-600 text-sm">{category.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => deleteCategory(category.id, category.name)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete Category"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Subcategories */}
                {getSubCategories(category.name).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Subcategories:</h4>
                    <div className="flex flex-wrap gap-2">
                      {getSubCategories(category.name).map((subcat) => (
                        <span
                          key={subcat.id}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {subcat.name}
                          <button
                            onClick={() => deleteCategory(subcat.id, subcat.name)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Menu Items Count */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Menu Items:</span>
                    <span className="font-medium">{menuItems.filter(item => item.category === category.name).length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {categories.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No categories found</h3>
              <p className="text-gray-500">Add your first category to organize your menu!</p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Enhanced Add Menu Item Modal with Beautiful Design */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            {/* Beautiful Backdrop with Blur Effect */}
            <div 
              className="fixed inset-0 bg-gradient-to-br from-orange-900/80 via-red-900/70 to-pink-900/80 backdrop-blur-sm transition-opacity" 
              onClick={() => {
                setIsAddModalOpen(false)
                resetForm()
              }}
            ></div>

            {/* Modal Content with Stunning Design */}
            <div className="inline-block align-bottom bg-white rounded-3xl px-8 pt-8 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full border-4 border-gradient-to-r from-orange-200 to-red-200 max-h-[90vh] overflow-y-auto">
              
              {/* Spectacular Header Section */}
              <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-3xl p-8 mb-8 overflow-hidden">
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/30 rounded-full translate-x-12 -translate-y-12"></div>
                  <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/10 rounded-full -translate-x-20 translate-y-20"></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    {/* Beautiful Icon Container */}
                    <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-2 border-white/30">
                      <span className="text-5xl filter drop-shadow-lg">🍽️</span>
                    </div>
                    <div>
                      <h3 className="text-5xl font-black text-white mb-3 drop-shadow-lg">
                        Add New Menu Item
                      </h3>
                      <p className="text-white/90 font-semibold text-xl drop-shadow-md">
                        ✨ Create a delicious new addition to your menu
                      </p>
                    </div>
                  </div>
                  
                  {/* Premium Close Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false)
                      resetForm()
                    }}
                    className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-90 border border-white/30"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Premium Form Content */}
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Basic Information Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                    <div className="flex items-center mb-8">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-2xl">📝</span>
                      </div>
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                        Basic Information
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-xl font-bold text-gray-800 flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-lg">🏷️</span>
                          </div>
                          Item Name
                          <span className="text-red-500 ml-3 text-2xl">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="✨ e.g., Grilled Salmon with Herbs"
                          className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xl font-bold text-gray-800 flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-lg">💰</span>
                          </div>
                          Price (BDT)
                          <span className="text-red-500 ml-3 text-2xl">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-500 text-xl font-bold">৳</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full px-6 py-5 pl-12 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">📂</span>
                        </div>
                        Category
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <select
                        className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        <option value="">🏠 Select a category</option>
                        {getMainCategories().map(category => (
                          <option key={category.id} value={category.name}>
                            📁 {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategory Field */}
                    {formData.category && getSubCategories(formData.category).length > 0 && (
                      <div className="mt-8 space-y-3">
                        <label className="text-xl font-bold text-gray-800 flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-lg">📂</span>
                          </div>
                          Subcategory
                        </label>
                        <select
                          className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium"
                          value={formData.subcategory}
                          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        >
                          <option value="">📂 No subcategory</option>
                          {getSubCategories(formData.category).map(subcat => (
                            <option key={subcat.id} value={subcat.name}>
                              📁 {subcat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mt-8 space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">📄</span>
                        </div>
                        Description
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <textarea
                        className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400 resize-none"
                        placeholder="📖 Describe the dish ingredients, preparation, and what makes it special..."
                        rows="5"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                      />
                      <div className="text-lg text-gray-500 text-right font-semibold">
                        {formData.description.length}/500 characters
                      </div>
                    </div>
                  </div>
                </div>

                {/* Image URL Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                    <div className="flex items-center mb-8">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-2xl">📸</span>
                      </div>
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
                        Food Image
                      </h4>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-xl font-bold text-gray-800 flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-lg">🖼️</span>
                          </div>
                          Food Image URL
                        </label>
                        <input
                          type="url"
                          placeholder="🌐 https://example.com/delicious-food-image.jpg"
                          className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-purple-200 focus:border-purple-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                        />
                        <p className="text-lg text-purple-600 font-semibold flex items-center">
                          <span className="mr-2">💡</span>
                          Enter a direct link to showcase your delicious food
                        </p>
                      </div>
                      
                      {formData.imageUrl && (
                        <div className="border-2 border-dashed border-purple-300 rounded-2xl p-6 bg-purple-50">
                          <p className="text-lg font-bold text-purple-700 mb-4">🖼️ Image Preview:</p>
                          <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-2xl">
                            <img 
                              src={formData.imageUrl} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                            <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 text-lg font-semibold" style={{display: 'none'}}>
                              ❌ Invalid image URL
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item Properties Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                    <div className="flex items-center mb-8">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-2xl">⚙️</span>
                      </div>
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                        Item Properties
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="relative group/item">
                        <div className="absolute -inset-1 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl blur opacity-20 group-hover/item:opacity-40 transition duration-300"></div>
                        <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 hover:border-green-300 transition-all duration-300 transform hover:scale-105">
                          <label className="flex items-center space-x-4 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-7 h-7 text-green-600 border-3 border-gray-300 rounded-xl focus:ring-6 focus:ring-green-200 transition-all duration-300"
                              checked={formData.isVegetarian}
                              onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-3xl">🌱</span>
                                <span className="font-bold text-xl text-gray-800">Vegetarian</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-2 font-semibold">Plant-based ingredients only</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="relative group/item">
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-400 to-orange-400 rounded-2xl blur opacity-20 group-hover/item:opacity-40 transition duration-300"></div>
                        <div className="relative bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border-2 border-red-200 hover:border-red-300 transition-all duration-300 transform hover:scale-105">
                          <label className="flex items-center space-x-4 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-7 h-7 text-red-600 border-3 border-gray-300 rounded-xl focus:ring-6 focus:ring-red-200 transition-all duration-300"
                              checked={formData.isSpicy}
                              onChange={(e) => setFormData({ ...formData, isSpicy: e.target.checked })}
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-3xl">🌶️</span>
                                <span className="font-bold text-xl text-gray-800">Spicy</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-2 font-semibold">Contains hot spices</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="relative group/item">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl blur opacity-20 group-hover/item:opacity-40 transition duration-300"></div>
                        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200 hover:border-blue-300 transition-all duration-300 transform hover:scale-105">
                          <label className="flex items-center space-x-4 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-7 h-7 text-blue-600 border-3 border-gray-300 rounded-xl focus:ring-6 focus:ring-blue-200 transition-all duration-300"
                              checked={formData.isVisible}
                              onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="text-3xl">👁️</span>
                                <span className="font-bold text-xl text-gray-800">Visible</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-2 font-semibold">Show to customers</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spectacular Action Buttons */}
                <div className="flex justify-end space-x-6 pt-8">
                  <button
                    type="button"
                    className="px-12 py-5 text-xl font-bold text-gray-600 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl border-2 border-gray-300"
                    onClick={() => {
                      setIsAddModalOpen(false)
                      resetForm()
                    }}
                  >
                    <svg className="w-6 h-6 mr-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="relative px-16 py-5 text-xl font-bold text-white bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 border-2 border-white/20 overflow-hidden"
                    disabled={loading}
                  >
                    {/* Button Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-4 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding Item...
                      </div>
                    ) : (
                      <div className="flex items-center relative z-10">
                        <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                        ✨ Add to Menu
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Edit Menu Item Modal with Beautiful Design */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            {/* Beautiful Backdrop with Blur Effect */}
            <div 
              className="fixed inset-0 bg-gradient-to-br from-amber-900/80 via-orange-900/70 to-red-900/80 backdrop-blur-sm transition-opacity" 
              onClick={() => {
                setIsEditModalOpen(false)
                setSelectedItem(null)
                resetForm()
              }}
            ></div>

            {/* Modal Content with Stunning Design */}
            <div className="inline-block align-bottom bg-white rounded-3xl px-8 pt-8 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full border-4 border-gradient-to-r from-amber-200 to-red-200">
            {/* Premium Header with Beautiful Gradient */}
            <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-12 rounded-t-3xl overflow-hidden">
              {/* Background Pattern Elements */}
              <div className="absolute inset-0">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-16 -translate-y-16"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/30 rounded-full translate-x-12 -translate-y-12"></div>
                <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/10 rounded-full -translate-x-20 translate-y-20"></div>
              </div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  {/* Beautiful Icon Container */}
                  <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-2 border-white/30">
                    <span className="text-5xl filter drop-shadow-lg">✏️</span>
                  </div>
                  <div>
                    <h3 className="text-5xl font-black text-white mb-3 drop-shadow-lg">
                      Edit Menu Item
                    </h3>
                    <p className="text-white/90 font-semibold text-xl drop-shadow-md">
                      ⚡ Update details for "{selectedItem.name}"
                    </p>
                  </div>
                </div>
                
                {/* Premium Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedItem(null)
                    resetForm()
                  }}
                  className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-90 border border-white/30"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Premium Form Content */}

            <form onSubmit={handleEdit} className="space-y-8">
              
              {/* Basic Information Section */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                  <div className="flex items-center mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <span className="text-2xl">📝</span>
                    </div>
                    <h4 className="text-2xl font-bold bg-gradient-to-r from-amber-700 to-orange-600 bg-clip-text text-transparent">
                      Basic Information
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">🏷️</span>
                        </div>
                        Item Name
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Premium Grilled Salmon with Herbs ✨"
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg font-medium focus:border-emerald-500 focus:bg-white transition-all duration-300 placeholder-gray-400 shadow-inner"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">💰</span>
                        </div>
                        Price (BDT)
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-lg font-bold text-lg shadow-md">
                          ৳
                        </div>
                      <input
                        type="number"
                        placeholder="150"
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl pl-16 pr-6 py-4 text-lg font-medium focus:border-yellow-500 focus:bg-white transition-all duration-300 placeholder-gray-400 shadow-inner"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Section */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                  <div className="flex items-center mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <span className="text-2xl">📱</span>
                    </div>
                    <h4 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">
                      Category Information
                    </h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">📂</span>
                        </div>
                        Category
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <select
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg font-medium focus:border-purple-500 focus:bg-white transition-all duration-300 shadow-inner"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="" className="text-gray-400">Choose a category ✨</option>
                        {getMainCategories().map(category => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcategory Field */}
                    {formData.category && getSubCategories(formData.category).length > 0 && (
                      <div className="space-y-3">
                        <label className="text-xl font-bold text-gray-800 flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-lg">🏷️</span>
                          </div>
                          Subcategory
                        </label>
                        <select
                          className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg font-medium focus:border-teal-500 focus:bg-white transition-all duration-300 shadow-inner"
                          value={formData.subcategory}
                          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        >
                          <option value="" className="text-gray-400">No subcategory ✨</option>
                          {getSubCategories(formData.category).map(subcat => (
                            <option key={subcat.id} value={subcat.name}>
                              {subcat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">�</span>
                        </div>
                        Description
                        <span className="text-red-500 ml-3 text-2xl">*</span>
                      </label>
                      <textarea
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg font-medium focus:border-rose-500 focus:bg-white transition-all duration-300 placeholder-gray-400 shadow-inner min-h-[120px] resize-none"
                        placeholder="Tell us what makes this dish special... ✨"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                      ></textarea>
                      <div className="text-sm text-gray-500 text-right font-medium">
                        {formData.description.length}/200 characters
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>

              {/* Image URL Section */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                  <div className="flex items-center mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <span className="text-2xl">�️</span>
                    </div>
                    <h4 className="text-2xl font-bold bg-gradient-to-r from-violet-700 to-purple-600 bg-clip-text text-transparent">
                      Image & Visual
                    </h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xl font-bold text-gray-800 flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                          <span className="text-lg">📸</span>
                        </div>
                        Food Image URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/delicious-food.jpg ✨"
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg font-medium focus:border-violet-500 focus:bg-white transition-all duration-300 placeholder-gray-400 shadow-inner"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      />
                      <p className="text-sm text-gray-500 font-medium">Enter a direct link to showcase your delicious food item</p>
                    </div>
                    
                    {formData.imageUrl && (
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-dashed border-violet-300 rounded-2xl p-6">
                        <p className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                          <span className="mr-2">👀</span>
                          Image Preview:
                        </p>
                        <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden shadow-xl">
                          <img 
                            src={formData.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                          <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 text-lg font-medium" style={{display: 'none'}}>
                            ❌ Invalid image URL
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Properties Section */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                  <div className="flex items-center mb-8">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                      <span className="text-2xl">⚙️</span>
                    </div>
                    <h4 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                      Item Properties & Settings
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                      <div className="relative bg-white rounded-2xl p-6 border-2 border-green-200 hover:border-green-300 transition-all duration-300 shadow-lg">
                        <label className="flex items-center space-x-4 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-6 h-6 text-green-600 bg-gray-100 border-gray-300 rounded-lg focus:ring-green-500 focus:ring-2"
                            checked={formData.isVegetarian}
                            onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-3xl">🌱</span>
                              <span className="text-xl font-bold text-gray-800">Vegetarian</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 font-medium">Made with plant-based ingredients only</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                      <div className="relative bg-white rounded-2xl p-6 border-2 border-red-200 hover:border-red-300 transition-all duration-300 shadow-lg">
                        <label className="flex items-center space-x-4 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-6 h-6 text-red-600 bg-gray-100 border-gray-300 rounded-lg focus:ring-red-500 focus:ring-2"
                            checked={formData.isSpicy}
                            onChange={(e) => setFormData({ ...formData, isSpicy: e.target.checked })}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-3xl">🌶️</span>
                              <span className="text-xl font-bold text-gray-800">Spicy</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 font-medium">Contains hot spices and peppers</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                      <div className="relative bg-white rounded-2xl p-6 border-2 border-blue-200 hover:border-blue-300 transition-all duration-300 shadow-lg">
                        <label className="flex items-center space-x-4 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-6 h-6 text-blue-600 bg-gray-100 border-gray-300 rounded-lg focus:ring-blue-500 focus:ring-2"
                            checked={formData.isVisible}
                            onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-3xl">👁️</span>
                              <span className="text-xl font-bold text-gray-800">Visible</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 font-medium">Show this item to customers</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-6 pt-8 border-t-2 border-gray-200">
                <button
                  type="button"
                  className="px-10 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedItem(null)
                    resetForm()
                  }}
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-10 py-4 bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Updating Item...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Update Menu Item ✨
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Add Category Modal with Beautiful Design */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            {/* Beautiful Backdrop with Blur Effect */}
            <div 
              className="fixed inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/70 to-pink-900/80 backdrop-blur-sm transition-opacity" 
              onClick={() => {
                setIsCategoryModalOpen(false)
                resetCategoryForm()
              }}
            ></div>

            {/* Modal Content with Stunning Design */}
            <div className="inline-block align-bottom bg-white rounded-3xl px-8 pt-8 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border-4 border-gradient-to-r from-indigo-200 to-purple-200">
              
              {/* Spectacular Header Section */}
              <div className="relative bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 mb-8 overflow-hidden">
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/30 rounded-full translate-x-12 -translate-y-12"></div>
                  <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/10 rounded-full -translate-x-20 translate-y-20"></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    {/* Beautiful Icon Container */}
                    <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-2 border-white/30">
                      <span className="text-5xl filter drop-shadow-lg">�</span>
                    </div>
                    <div>
                      <h2 className="text-5xl font-black text-white mb-3 drop-shadow-lg">
                        Add New Category
                      </h2>
                      <p className="text-white/90 font-semibold text-xl drop-shadow-md">
                        ✨ Organize your menu with beautiful categories
                      </p>
                    </div>
                  </div>
                  
                  {/* Premium Close Button */}
                  <button
                    className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 hover:rotate-90 border border-white/30"
                    onClick={() => {
                      setIsCategoryModalOpen(false)
                      resetCategoryForm()
                    }}
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Premium Form Content */}
              <form onSubmit={handleCategorySubmit} className="space-y-8">
                
                {/* Category Name Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                    <label className="text-xl font-bold text-gray-800 flex items-center mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-xl">🏷️</span>
                      </div>
                      Category Name
                      <span className="text-red-500 ml-3 text-2xl">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-indigo-200 focus:border-indigo-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400"
                      placeholder="✨ e.g., Appetizers, Main Courses, Desserts"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Description Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                    <label className="text-xl font-bold text-gray-800 flex items-center mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-xl">📝</span>
                      </div>
                      Description
                    </label>
                    <textarea
                      className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-purple-200 focus:border-purple-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium placeholder-gray-400 resize-none"
                      placeholder="📖 Describe this category and what items it contains..."
                      rows="5"
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Parent Category Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                    <label className="text-xl font-bold text-gray-800 flex items-center mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-xl">📂</span>
                      </div>
                      Parent Category
                      <span className="text-gray-500 ml-3 font-medium">(Optional)</span>
                    </label>
                    <select
                      className="w-full px-6 py-5 text-xl border-2 border-gray-200 rounded-2xl focus:ring-6 focus:ring-blue-200 focus:border-blue-500 transition-all duration-300 bg-gray-50 hover:bg-white shadow-inner hover:shadow-lg font-medium"
                      value={categoryFormData.parentCategory}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, parentCategory: e.target.value })}
                    >
                      <option value="">🏠 None (Main Category)</option>
                      {getMainCategories().map(category => (
                        <option key={category.id} value={category.name}>
                          📁 {category.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-lg text-blue-600 font-semibold mt-3 flex items-center">
                      <span className="mr-2">💡</span>
                      Select a parent category to create a subcategory
                    </p>
                  </div>
                </div>

                {/* Active Status Section */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                    <div className="flex items-center space-x-6">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="w-8 h-8 text-green-600 border-3 border-gray-300 rounded-xl focus:ring-6 focus:ring-green-200 transition-all duration-300"
                          checked={categoryFormData.isActive}
                          onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                        />
                      </div>
                      <label className="text-xl font-bold text-gray-800 flex items-center cursor-pointer">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <span className="text-xl">✅</span>
                        </div>
                        Active Category
                      </label>
                    </div>
                    <p className="text-lg text-green-600 font-semibold mt-3 ml-20">
                      Category will be visible to customers when active
                    </p>
                  </div>
                </div>

                {/* Spectacular Action Buttons */}
                <div className="flex justify-end space-x-6 pt-8">
                  <button
                    type="button"
                    className="px-12 py-5 text-xl font-bold text-gray-600 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl border-2 border-gray-300"
                    onClick={() => {
                      setIsCategoryModalOpen(false)
                      resetCategoryForm()
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="relative px-16 py-5 text-xl font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 border-2 border-white/20 overflow-hidden"
                    disabled={loading}
                  >
                    {/* Button Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-4 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Category...
                      </div>
                    ) : (
                      <div className="flex items-center relative z-10">
                        <svg className="w-8 h-8 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                        ✨ Add Category
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
