import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './config.js';

// Orders service
export const ordersService = {
  // Get all orders
  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'orders'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Get orders by status
  async getByStatus(status) {
    const q = query(collection(db, 'orders'), where('status', '==', status));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Create new order
  async create(orderData) {
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  },

  // Update order
  async update(orderId, updateData) {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      ...updateData,
      updatedAt: new Date()
    });
  },

  // Delete order
  async delete(orderId) {
    await deleteDoc(doc(db, 'orders', orderId));
  },

  // Listen to order changes
  subscribeToOrderChanges(callback) {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(orders);
    });
  }
};

// Menu service
export const menuService = {
  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'menuItems'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(menuItem) {
    const docRef = await addDoc(collection(db, 'menuItems'), menuItem);
    return docRef.id;
  },

  async update(itemId, updateData) {
    const itemRef = doc(db, 'menuItems', itemId);
    await updateDoc(itemRef, updateData);
  },

  async delete(itemId) {
    await deleteDoc(doc(db, 'menuItems', itemId));
  }
};

// Tables service
export const tablesService = {
  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'tables'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateStatus(tableId, status) {
    const tableRef = doc(db, 'tables', tableId);
    await updateDoc(tableRef, { 
      status, 
      lastUpdated: new Date() 
    });
  }
};
