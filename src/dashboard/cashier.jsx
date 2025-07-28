import React, { useState, useEffect } from 'react'
import { db } from '../authentication/firebase'
import { collection, getDocs, addDoc } from 'firebase/firestore'

function Cashier() {
  const [activeTab, setActiveTab] = useState('pos')
  const [orders, setOrders] = useState([])
  const [currentOrder, setCurrentOrder] = useState([])
  const [menuItems] = useState([
    { id: 1, name: 'Burger', price: 12.99, category: 'Main' },
    { id: 2, name: 'Pizza', price: 15.99, category: 'Main' },
    { id: 3, name: 'Salad', price: 8.99, category: 'Appetizer' },
    { id: 4, name: 'Pasta', price: 13.99, category: 'Main' },
    { id: 5, name: 'Soda', price: 2.99, category: 'Beverage' },
    { id: 6, name: 'Coffee', price: 3.99, category: 'Beverage' },
  ])
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    tableNumber: ''
  })
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, 'Orders'))
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setOrders(ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (error) {
      console.error('Error fetching orders:', error)
    }
  }

  const addToOrder = (item) => {
    const existingItem = currentOrder.find(orderItem => orderItem.id === item.id)
    if (existingItem) {
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.id === item.id
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ))
    } else {
      setCurrentOrder([...currentOrder, { ...item, quantity: 1 }])
    }
  }

  const removeFromOrder = (itemId) => {
    setCurrentOrder(currentOrder.filter(item => item.id !== itemId))
  }

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromOrder(itemId)
    } else {
      setCurrentOrder(currentOrder.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ))
    }
  }

  const calculateTotal = () => {
    return currentOrder.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)
  }

  const processPayment = async () => {
    if (currentOrder.length === 0) {
      alert('Please add items to the order first.')
      return
    }

    if (!customerInfo.name || !customerInfo.phone) {
      alert('Please enter customer name and phone number.')
      return
    }

    setLoading(true)
    try {
      const orderData = {
        items: currentOrder,
        customerInfo,
        paymentMethod,
        total: parseFloat(calculateTotal()),
        status: 'paid',
        createdAt: new Date().toISOString(),
        processedBy: 'cashier'
      }

      await addDoc(collection(db, 'Orders'), orderData)
      
      // Clear the current order
      setCurrentOrder([])
      setCustomerInfo({ name: '', phone: '', tableNumber: '' })
      setPaymentMethod('cash')
      
      // Refresh orders list
      fetchOrders()
      
      alert('Payment processed successfully!')
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Error processing payment. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-teal-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-teal-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-teal-900">Cashier Dashboard</h1>
              <p className="text-teal-600">SmartServe Point of Sale</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-teal-600">Welcome, Cashier</span>
              <button 
                onClick={() => {
                  localStorage.removeItem('user')
                  window.location.href = '/login'
                }}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-teal-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'pos', label: 'Point of Sale' },
              { id: 'orders', label: 'Order History' },
              { id: 'reports', label: 'Daily Reports' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-600'
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
          
          {/* Point of Sale Tab */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Menu Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Menu Items</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {menuItems.map((item) => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-medium text-gray-900">{item.name}</h3>
                              <p className="text-sm text-gray-500">{item.category}</p>
                              <p className="text-lg font-semibold text-teal-600">${item.price}</p>
                            </div>
                            <button
                              onClick={() => addToOrder(item)}
                              className="bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Order */}
              <div>
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Current Order</h2>
                  </div>
                  <div className="p-6">
                    {/* Customer Info */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Customer Name</label>
                        <input
                          type="text"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Table Number (Optional)</label>
                        <input
                          type="text"
                          value={customerInfo.tableNumber}
                          onChange={(e) => setCustomerInfo({...customerInfo, tableNumber: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Enter table number"
                        />
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2 mb-4">
                      {currentOrder.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No items in order</p>
                      ) : (
                        currentOrder.map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-2 border border-gray-200 rounded">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-500">${item.price} each</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="bg-gray-200 text-gray-700 w-6 h-6 rounded text-sm"
                              >
                                -
                              </button>
                              <span className="font-medium">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="bg-gray-200 text-gray-700 w-6 h-6 rounded text-sm"
                              >
                                +
                              </button>
                              <button
                                onClick={() => removeFromOrder(item.id)}
                                className="bg-red-500 text-white w-6 h-6 rounded text-sm"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Total */}
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold">Total:</span>
                        <span className="text-2xl font-bold text-teal-600">${calculateTotal()}</span>
                      </div>

                      {/* Payment Method */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Credit/Debit Card</option>
                          <option value="digital">Digital Payment</option>
                        </select>
                      </div>

                      {/* Process Payment Button */}
                      <button
                        onClick={processPayment}
                        disabled={loading}
                        className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Processing...' : 'Process Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order History Tab */}
          {activeTab === 'orders' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Order History</h2>
                <p className="text-gray-600">Recent transactions</p>
              </div>
              
              {orders.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No orders processed yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {order.id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {order.customerInfo?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.items?.length || 0} items
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${order.total?.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.paymentMethod}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Daily Reports</h2>
                <p className="text-gray-600">Sales summary for today</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-teal-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-teal-900 mb-2">Total Sales</h3>
                    <p className="text-3xl font-bold text-teal-600">
                      ${orders.reduce((total, order) => total + (order.total || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">Orders Processed</h3>
                    <p className="text-3xl font-bold text-blue-600">{orders.length}</p>
                  </div>
                  
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 mb-2">Average Order</h3>
                    <p className="text-3xl font-bold text-green-600">
                      ${orders.length > 0 ? (orders.reduce((total, order) => total + (order.total || 0), 0) / orders.length).toFixed(2) : '0.00'}
                    </p>
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

export default Cashier