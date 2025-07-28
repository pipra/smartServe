import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './authentication/login'
import SignUp from './authentication/signup'
import Home from './authentication/home'
import AdminSignUp from './authentication/admin-signup'
import ChefSignUp from './authentication/chef-signup'
import WaiterSignUp from './authentication/waiter-signup'


function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />
        <Route path='/home' element={<Home />} />
        <Route path='/admin-signup' element={<AdminSignUp />} />
        <Route path='/chef-signup' element={<ChefSignUp />} />
        <Route path='/waiter-signup' element={<WaiterSignUp />} />
      </Routes>
    </Router>
  )
}

export default App
