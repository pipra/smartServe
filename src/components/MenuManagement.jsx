import React, { useState, useEffect } from 'react'
import { db } from '../authentication/firebase'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore'

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Menu Management</h1>
          <p className="text-gray-600 text-lg">Manage your restaurant's menu items and categories</p>
          <div className="flex items-center space-x-4 mt-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              <span>{menuItems.filter(item => item.isVisible).length} Visible Items</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
              <span>{menuItems.filter(item => !item.isVisible).length} Hidden Items</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span>{categories.length} Categories</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="btn btn-secondary btn-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-500 border-none text-white"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Add Category
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary btn-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 bg-gradient-to-r from-orange-500 to-red-500 border-none text-white"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('items')}
          className={`py-2 px-4 font-medium text-sm focus:outline-none ${
            activeTab === 'items'
              ? 'border-b-2 border-orange-500 text-orange-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Menu Items ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`py-2 px-4 font-medium text-sm focus:outline-none ${
            activeTab === 'categories'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && (
        <>
          {/* Filters and Search */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Search Menu Items</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, description, or category..."
                    className="input input-bordered w-full pl-12 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="lg:w-64">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Category</label>
            <select
              className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">🍽️ All Categories</option>
              {getMainCategories().map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Search Results Summary */}
        {(searchTerm || filterCategory !== 'All') && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredItems.length} of {menuItems.length} items
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
              {(searchTerm || filterCategory !== 'All') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterCategory('All')
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="relative h-48">
              <img
                src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                alt={item.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                {item.isVegetarian && (
                  <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    🌱 Veg
                  </span>
                )}
                {item.isSpicy && (
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    🌶️ Spicy
                  </span>
                )}
              </div>
              <div className="absolute top-2 left-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item.isVisible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {item.isVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>
            
            <div className="p-4">
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
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🍽️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No menu items found</h3>
          <p className="text-gray-500">Add your first menu item to get started!</p>
        </div>
      )}
        </>
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🍽️</span>
                </div>
                <div className='mt-15'>
                  <h3 className="text-2xl font-bold text-gray-800">Add New Menu Item</h3>
                  <p className="text-gray-600">Create a delicious new item for your menu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false)
                  resetForm()
                }}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📝</span>
                  </span>
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">🏷️</span>
                      Item Name
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Grilled Salmon with Herbs"
                      className="input input-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">💰</span>
                      Price (BDT)
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="input input-bordered w-full pl-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <span className="mr-2">📂</span>
                    Category
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {getMainCategories().map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcategory Field */}
                {formData.category && getSubCategories(formData.category).length > 0 && (
                  <div className="mt-6 space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">📂</span>
                      Subcategory
                    </label>
                    <select
                      className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    >
                      <option value="">No subcategory</option>
                      {getSubCategories(formData.category).map(subcat => (
                        <option key={subcat.id} value={subcat.name}>
                          {subcat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-6 space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <span className="mr-2">📄</span>
                    Description
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the dish ingredients, preparation, and what makes it special..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  ></textarea>
                  <div className="text-xs text-gray-500 text-right">
                    {formData.description.length}/200 characters
                  </div>
                </div>
              </div>

              {/* Image URL Section */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📸</span>
                  </span>
                  Image URL
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Food Image URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      className="input input-bordered w-full"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-2">Enter a direct link to the food image</p>
                  </div>
                  
                  {formData.imageUrl && (
                    <div className="border-2 border-dashed border-purple-300 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Image Preview:</p>
                      <div className="w-32 h-32 mx-auto rounded-lg overflow-hidden">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm" style={{display: 'none'}}>
                          Invalid image URL
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Properties Section */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">⚙️</span>
                  </span>
                  Item Properties
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200 hover:border-green-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-success checkbox-lg"
                        checked={formData.isVegetarian}
                        onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">🌱</span>
                          <span className="font-medium text-gray-800">Vegetarian</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Plant-based ingredients only</p>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-red-200 hover:border-red-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-error checkbox-lg"
                        checked={formData.isSpicy}
                        onChange={(e) => setFormData({ ...formData, isSpicy: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">🌶️</span>
                          <span className="font-medium text-gray-800">Spicy</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Contains hot spices</p>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200 hover:border-blue-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-lg"
                        checked={formData.isVisible}
                        onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">👁️</span>
                          <span className="font-medium text-gray-800">Visible</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Show to customers</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="btn btn-outline btn-lg px-8"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    resetForm()
                  }}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg px-8 shadow-lg hover:shadow-xl transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-sm mr-2"></span>
                      Adding Item...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add to Menu
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedItem && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✏️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Edit Menu Item</h3>
                  <p className="text-gray-600">Update details for "{selectedItem.name}"</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false)
                  setSelectedItem(null)
                  resetForm()
                }}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📝</span>
                  </span>
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">🏷️</span>
                      Item Name
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Grilled Salmon with Herbs"
                      className="input input-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">💰</span>
                      Price (BDT)
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="input input-bordered w-full pl-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <span className="mr-2">📂</span>
                    Category
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {getMainCategories().map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcategory Field */}
                {formData.category && getSubCategories(formData.category).length > 0 && (
                  <div className="mt-6 space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="mr-2">📂</span>
                      Subcategory
                    </label>
                    <select
                      className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    >
                      <option value="">No subcategory</option>
                      {getSubCategories(formData.category).map(subcat => (
                        <option key={subcat.id} value={subcat.name}>
                          {subcat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-6 space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <span className="mr-2">📄</span>
                    Description
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the dish ingredients, preparation, and what makes it special..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  ></textarea>
                  <div className="text-xs text-gray-500 text-right">
                    {formData.description.length}/200 characters
                  </div>
                </div>
              </div>

              {/* Image URL Section */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📸</span>
                  </span>
                  Update Image URL
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Food Image URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      className="input input-bordered w-full"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-2">Enter a direct link to the food image</p>
                  </div>
                  
                  {formData.imageUrl && (
                    <div className="border-2 border-dashed border-purple-300 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Image Preview:</p>
                      <div className="w-32 h-32 mx-auto rounded-lg overflow-hidden">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm" style={{display: 'none'}}>
                          Invalid image URL
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Properties Section */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">⚙️</span>
                  </span>
                  Item Properties
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200 hover:border-green-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-success checkbox-lg"
                        checked={formData.isVegetarian}
                        onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">🌱</span>
                          <span className="font-medium text-gray-800">Vegetarian</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Plant-based ingredients only</p>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-red-200 hover:border-red-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-error checkbox-lg"
                        checked={formData.isSpicy}
                        onChange={(e) => setFormData({ ...formData, isSpicy: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">🌶️</span>
                          <span className="font-medium text-gray-800">Spicy</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Contains hot spices</p>
                      </div>
                    </label>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200 hover:border-blue-300 transition-colors">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-lg"
                        checked={formData.isVisible}
                        onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">👁️</span>
                          <span className="font-medium text-gray-800">Visible</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Show to customers</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="btn btn-outline btn-lg px-8"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedItem(null)
                    resetForm()
                  }}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg px-8 shadow-lg hover:shadow-xl transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-sm mr-2"></span>
                      Updating Item...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Update Item
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal modal-open mt-15">
          <div className="modal-box w-11/12 max-w-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <span className="mr-3 text-3xl">📂</span>
                Add New Category
              </h2>
              <button
                className="btn btn-sm btn-circle btn-outline hover:bg-red-50 hover:border-red-300"
                onClick={() => {
                  setIsCategoryModalOpen(false)
                  resetCategoryForm()
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                  <span className="mr-2">🏷️</span>
                  Category Name
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Starters, Main Course, Desserts"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                  <span className="mr-2">📝</span>
                  Description
                </label>
                <textarea
                  className="textarea textarea-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of this category..."
                  rows="3"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center mb-2">
                  <span className="mr-2">📂</span>
                  Parent Category (Optional)
                </label>
                <select
                  className="select select-bordered w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={categoryFormData.parentCategory}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, parentCategory: e.target.value })}
                >
                  <option value="">None (Main Category)</option>
                  {getMainCategories().map(category => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a parent category to create a subcategory
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={categoryFormData.isActive}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                />
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <span className="mr-2">✅</span>
                  Active Category
                </label>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="btn btn-outline btn-lg px-8"
                  onClick={() => {
                    setIsCategoryModalOpen(false)
                    resetCategoryForm()
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg px-8 bg-gradient-to-r from-blue-500 to-indigo-500 border-none text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-sm mr-2"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
