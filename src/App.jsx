import './assets/styles/App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { 
  Login, 
  SignUp, 
  Home, 
  CashierSignUp, 
  WaiterSignUp, 
  ChefSignUp, 
  AdminSignUp 
} from './pages/auth'
import { Admin, Waiter, Chef, Cashier } from './pages/dashboard'
import CustomerMenu from './pages/public/CustomerMenu'

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />
        <Route path='/home' element={<Home />} />
        <Route path='/cashierSignUp' element={<CashierSignUp />} />
        <Route path='/waiterSignUp' element={<WaiterSignUp />} />
        <Route path='/chefSignUp' element={<ChefSignUp />} />
        <Route path='/adminSignUp' element={<AdminSignUp />} />
        <Route path='/dashboard/admin' element={<Admin />} />
        <Route path='/dashboard/waiter' element={<Waiter />} />
        <Route path='/dashboard/chef' element={<Chef />} />
        <Route path='/dashboard/cashier' element={<Cashier />} />
        <Route path='/menu' element={<CustomerMenu />} />
      </Routes>
    </Router>
  )
}

export default App
