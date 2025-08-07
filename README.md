# SmartServe - Complete Restaurant Management System 🍽️

**SmartServe** is a comprehensive, modern restaurant management system built with React, Firebase, and Tailwind CSS. The system provides a complete solution for restaurant operations with role-based authentication, real-time order management, menu administration, and customer service features.

## 🌟 Key Features

### **Role-Based Authentication System**
- **Admin Dashboard** - Complete restaurant oversight and management
- **Waiter Interface** - Order taking, table management, and customer service
- **Chef Dashboard** - Kitchen operations and menu item status management
- **Cashier System** - Billing, payment processing, and order completion
- **Approval Workflow** - Admin approval required for new staff accounts

### **Real-Time Order Management**
- Live order tracking from placement to completion
- Status updates: Pending → Confirmed → Preparing → Ready → Served → Completed
- Real-time notifications and updates across all dashboards
- Order editing and modification capabilities

### **Advanced Menu Management**
- Dynamic menu item creation with photo support
- Category and subcategory organization
- Pricing, descriptions, and dietary information
- Visibility controls (show/hide items)
- Bulk menu operations and filtering

### **Table Management System**
- Interactive table layout with visual status indicators
- Real-time table availability tracking
- Customer assignment and order history
- Table capacity and seating management

## 🚀 Technology Stack

- **Frontend**: React 19.0.0 with modern hooks and functional components
- **Build Tool**: Vite 6.0.1 for fast development and optimized builds
- **Styling**: Tailwind CSS 4.0.0 with custom components and DaisyUI
- **Database**: Firebase Firestore for real-time data synchronization
- **Authentication**: Firebase Authentication with role-based access control
- **Routing**: React Router 7.0.2 for seamless navigation

## 📱 System Architecture

### **Dashboard Overview**

#### **👨‍💼 Admin Dashboard**
- **Analytics & Reporting**: Revenue tracking, order statistics, staff performance
- **Staff Management**: Approve/reject waiter, chef, and cashier applications
- **Menu Administration**: Complete CRUD operations for menu items and categories
- **Table Configuration**: Add, modify, and manage restaurant seating
- **System Settings**: Restaurant configuration and operational controls

#### **🍽️ Waiter Dashboard**
- **Order Taking**: Modern Place Order modal with photo-supported menu display
- **Table Management**: Visual table status with capacity indicators and order tracking
- **Customer Service**: Order editing, status updates, and customer interaction
- **Order History**: Complete order tracking and management interface

#### **👨‍🍳 Chef Dashboard**
- **Order Queue**: Real-time incoming orders with preparation tracking
- **Menu Status**: Control dish availability and kitchen inventory
- **Order Processing**: Update order status through preparation stages
- **Kitchen Analytics**: Order volume and preparation time tracking

#### **💰 Cashier Dashboard**
- **Billing System**: Two-step process (Process Bill → Mark Complete)
- **Payment Processing**: Multiple payment method support
- **Order History**: Complete transaction records and customer details
- **Revenue Tracking**: Daily sales and transaction analytics

## 📋 Detailed Feature Breakdown

### **Authentication & Security**
```
Registration → Pending Status → Admin Approval → Active Account
```
- Secure role-based authentication
- Email/password login with Firebase
- Account approval workflow for staff
- Session management and auto-logout
- Password reset and account recovery

### **Order Management Workflow**
```
Place Order → Confirm → Kitchen Prep → Ready → Serve → Bill → Complete
```
- **Waiter**: Takes orders with customer and table assignment
- **Chef**: Receives orders, updates preparation status
- **Waiter**: Serves ready orders to customers
- **Cashier**: Processes billing and marks orders complete

### **Menu Management Features**
- **Rich Menu Editor**: Photo uploads, detailed descriptions, pricing
- **Category System**: Hierarchical organization with main categories and subcategories
- **Dietary Information**: Vegetarian, spicy, and allergen indicators
- **Visibility Controls**: Show/hide items from customer view
- **Rating System**: Customer feedback and item popularity tracking

### **Advanced UI Components**

#### **Modern Place Order Modal** *(Recently Enhanced)*
- **Professional Header**: Gradient backgrounds with customer/table information
- **Menu Display**: 4-column responsive grid with photo support and fallback emojis
- **Category Filtering**: Dynamic category badges with item counts
- **Shopping Cart**: Sticky positioned cart with item management
- **Smart Features**: Availability indicators, price calculations, order validation

#### **Table Management Interface**
- **Visual Status Indicators**: Color-coded availability (Available/Occupied/Reserved)
- **Order Tracking**: Active orders per table with customer information
- **Capacity Display**: Seating information and customer count
- **Revenue Tracking**: Per-table sales and transaction history

## 🛠️ Installation & Setup

### **Prerequisites**
- Node.js 18+ and npm
- Firebase account with project setup
- Modern web browser with JavaScript enabled

### **Installation Steps**

1. **Clone Repository**
```bash
git clone https://github.com/pipra/smartServe.git
cd smartServe
```

2. **Install Dependencies**
```bash
npm install
```

3. **Firebase Configuration**
- Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
- Enable Authentication (Email/Password)
- Create Firestore Database
- Copy configuration to `src/authentication/firebase.jsx`

4. **Environment Setup**
```bash
# Create .env file with Firebase configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
```

5. **Start Development Server**
```bash
npm run dev
```

6. **Build for Production**
```bash
npm run build
```

## 📊 Database Schema

### **Collections Structure**

#### **Users Collection**
```javascript
{
  uid: "firebase_user_id",
  email: "user@email.com",
  role: "admin|waiter|chef|cashier",
  firstName: "John",
  lastName: "Doe",
  status: "active|pending|rejected",
  createdAt: timestamp
}
```

#### **Orders Collection**
```javascript
{
  id: "auto_generated",
  customerName: "Customer Name",
  tableNumber: 5,
  items: [
    {
      id: "item_id",
      name: "Dish Name",
      price: 25.99,
      quantity: 2,
      photo: "image_url"
    }
  ],
  totalAmount: 51.98,
  status: "pending|confirmed|preparing|ready|served|completed",
  waiterName: "Waiter Name",
  timestamp: firestore_timestamp,
  confirmedAt: timestamp,
  completedAt: timestamp
}
```

#### **MenuItems Collection**
```javascript
{
  id: "auto_generated",
  name: "Dish Name",
  description: "Detailed description",
  price: 18.99,
  category: "Main Course",
  subcategory: "Seafood",
  image: "photo_url",
  isVegetarian: boolean,
  isSpicy: boolean,
  isVisible: boolean,
  rating: 0,
  createdAt: timestamp
}
```

#### **Tables Collection**
```javascript
{
  id: "auto_generated",
  tableNumber: 5,
  capacity: 4,
  status: "available|occupied|reserved",
  currentCustomer: "Customer Name",
  lastUpdated: timestamp
}
```

## 🎨 UI/UX Features

### **Design System**
- **Modern Gradients**: Beautiful color transitions throughout the interface
- **Professional Typography**: Clear hierarchy with multiple font weights
- **Interactive Elements**: Hover effects, animations, and micro-interactions
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Consistent Iconography**: Emoji-based icons for intuitive navigation

### **User Experience**
- **Real-time Updates**: Live synchronization across all user interfaces
- **Loading States**: Professional loading indicators and skeleton screens
- **Error Handling**: Comprehensive error messages and recovery options
- **Accessibility**: Keyboard navigation and screen reader support
- **Performance**: Optimized bundle sizes and lazy loading

## 📈 System Statistics & Analytics

### **Performance Metrics**
- **Bundle Size**: Optimized for fast loading
- **Database Queries**: Efficient real-time listeners
- **User Sessions**: Persistent authentication state
- **Order Processing**: Average 2-3 second order placement

### **Scalability Features**
- **Real-time Synchronization**: Handles multiple concurrent users
- **Modular Architecture**: Easy to extend with new features
- **Database Optimization**: Indexed queries for fast performance
- **Role-Based Security**: Scalable permission system

## 🛡️ Security Features

- **Firebase Security Rules**: Database-level access control
- **Role-Based Authentication**: Restricted dashboard access
- **Input Validation**: Client and server-side data validation
- **Session Management**: Automatic logout and session refresh
- **Data Privacy**: Secure user information handling

## 📞 Support & Maintenance

### **Development Team**
This comprehensive restaurant management system is developed by a dedicated team of 4 members:

1. **Md. Habibur Rahman** (GitHub: [hello-habibi](https://github.com/hello-habibi))
2. **Md. Mahim Babu**
3. **Md. Habibur Rahman** (GitHub: [pipra](https://github.com/pipra))
4. **Sumaiya Khatun**

For any support or inquiries, please contact: **habibur.191522@gmail.com**

### **System Requirements**
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Network**: Stable internet connection for real-time features
- **Device**: Desktop/laptop recommended for admin functions, mobile-friendly for all roles

## �️ Web Structure

```
smartServe/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── authentication/
│   │   ├── adminSignUp.jsx          # Admin registration interface
│   │   ├── cashierSignUp.jsx        # Cashier registration interface
│   │   ├── chefSignUp.jsx           # Chef registration interface
│   │   ├── firebase.jsx             # Firebase configuration & auth
│   │   ├── home.jsx                 # Landing page component
│   │   ├── login.jsx                # User login interface
│   │   ├── signup.jsx               # General registration hub
│   │   └── waiterSignUp.jsx         # Waiter registration interface
│   ├── components/
│   │   ├── CustomerMenu.jsx         # Customer-facing menu display
│   │   ├── MenuManagement.jsx       # Admin menu CRUD operations
│   │   └── SampleDataLoader.jsx     # Development data utilities
│   ├── dashboard/
│   │   ├── admin.jsx                # Admin management dashboard
│   │   ├── cashier.jsx              # Billing & payment interface
│   │   ├── chef.jsx                 # Kitchen order management
│   │   └── waiter.jsx               # Order taking & table management
│   ├── data/
│   │   └── sampleMenuData.js        # Sample menu items for testing
│   ├── App.css                      # Global application styles
│   ├── App.jsx                      # Main application component
│   ├── index.css                    # Base CSS styles
│   └── main.jsx                     # React application entry point
├── create-admin.js                  # Admin user creation script
├── create-approved-cashier.js       # Cashier approval script
├── debug-firebase.js                # Firebase debugging utilities
├── eslint.config.js                 # ESLint configuration
├── index.html                       # HTML entry point
├── package.json                     # Project dependencies & scripts
├── populate-menu-items.js           # Database seeding script
├── README.md                        # Project documentation
├── test-data.js                     # Test data generation
├── vite.config.js                   # Vite build configuration
├── waiter-approval-system.js        # Waiter approval automation
└── waiter-setup.js                  # Waiter account setup script
```

### **Component Architecture**
- **Authentication Layer**: Role-based signup and login system
- **Dashboard Layer**: Specialized interfaces for each user role
- **Component Layer**: Reusable UI components and utilities
- **Data Layer**: Firebase integration and sample data management
- **Configuration Layer**: Build tools and development scripts

## �🎯 Future Enhancements

- **Customer Mobile App**: Online ordering and table reservations
- **Inventory Management**: Stock tracking and supplier integration
- **Advanced Analytics**: Business intelligence and reporting dashboard
- **Multi-location Support**: Chain restaurant management
- **Integration APIs**: POS systems and third-party service connections

---

**SmartServe** - Transforming Restaurant Operations with Modern Technology ✨


The application will be available at `http://localhost:5173`

<div align="center">
  <p>⭐ Star this repository if you find it helpful!</p>
</div>