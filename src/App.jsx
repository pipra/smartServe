import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './authentication/login'
import SignUp from './authentication/signup'
import Home from './authentication/home'
import CashierSignUp from './authentication/cashierSignUp'
import WaiterSignUp from './authentication/waiterSignUp'
import ChefSignUp from './authentication/chefSignUp'
import AdminSignUp from './authentication/adminSignUp'
import Admin from './dashboard/admin'
import Waiter from './dashboard/waiter'
import Chef from './dashboard/chef'
import Cashier from './dashboard/cashier'

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Login />} />
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
      </Routes>
    </Router>
  )
}

export default App
