import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import React, { useState } from 'react'
import { auth, db } from './firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log("User logged in Successfully!!");
            
            // Check multiple collections to find user data
            let userData = null;
            let userRole = null;
            
            // First, try to find user in Admin collection
            const adminDoc = await getDoc(doc(db, 'Admin', userCredential.user.uid));
            if (adminDoc.exists()) {
                userData = adminDoc.data();
                userRole = 'admin';
            } else {
                // Then try Waiters collection
                const waiterDoc = await getDoc(doc(db, 'Waiters', userCredential.user.uid));
                if (waiterDoc.exists()) {
                    userData = waiterDoc.data();
                    userRole = 'waiter';
                } else {
                    // Then try Chefs collection
                    const chefDoc = await getDoc(doc(db, 'Chefs', userCredential.user.uid));
                    if (chefDoc.exists()) {
                        userData = chefDoc.data();
                        userRole = 'chef';
                    } else {
                        // Then try Cashiers collection
                        const cashierDoc = await getDoc(doc(db, 'Cashiers', userCredential.user.uid));
                        if (cashierDoc.exists()) {
                            userData = cashierDoc.data();
                            userRole = 'cashier';
                        } else {
                            // Finally try users collection (for other roles)
                            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
                            if (userDoc.exists()) {
                                userData = userDoc.data();
                                userRole = userData.role;
                            }
                        }
                    }
                }
            }
            
            if (userData) {
                // Check if waiter account is approved
                if (userRole === 'waiter' && (!userData.approval || userData.status === 'pending')) {
                    setError('Your waiter account is pending admin approval. Please wait for approval before logging in.');
                    setIsLoading(false);
                    return;
                }
                
                // Check if chef account is approved
                if (userRole === 'chef' && (!userData.approval || userData.status === 'pending')) {
                    setError('Your chef account is pending admin approval. Please wait for approval before logging in.');
                    setIsLoading(false);
                    return;
                }
                
                // Check if cashier account is approved
                if (userRole === 'cashier' && (!userData.approval || userData.status === 'pending')) {
                    setError('Your cashier account is pending admin approval. Please wait for approval before logging in.');
                    setIsLoading(false);
                    return;
                }
                

                console.log(userData);

                // Redirect based on user role
                switch (userRole) {
                    case 'admin':
                        window.location.href = "/dashboard/admin";
                        break;
                    case 'waiter':
                        window.location.href = "/dashboard/waiter";
                        break;
                    case 'chef':
                        window.location.href = "/dashboard/chef";
                        break;
                    case 'cashier':
                        window.location.href = "/dashboard/cashier";
                        break;
                    default:
                        window.location.href = "/home";
                        console.log("Unknown user role, redirecting to home.");
                }
            } else {
                // If no user document exists, redirect to home
                console.log("No user document found, redirecting to home.");
                window.location.href = "/home";
            }
        } catch(error) {
            console.log(error.message);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SmartServe</h1>
          <p className="text-gray-600">Welcome back! Please sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pl-11"
                  placeholder="Enter your email"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 pl-11 pr-11"
                  placeholder="Enter your password"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
              </div>
              <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500 font-medium">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <a href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign Up
              </a>
            </p>
          </div>

          {/* Waiter */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Want to be a waiter?{' '}
              <a href="/waiterSignUp" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign Up
              </a>
            </p>
          </div>

         {/* Chef */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Want to be a Chef?{' '}
              <a href="/chefSignUp" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign Up
              </a>
            </p>
          </div>

          {/* Cashier */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Want to be a Cashier?{' '}
              <a href="/cashierSignUp" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign Up
              </a>
            </p>
          </div>

          {/* Admin */}
          {/* <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Want to be an Admin?{' '}
              <a href="/adminSignUp" className="font-medium text-purple-600 hover:text-purple-500">
                Sign Up
              </a>
            </p>
          </div> */}
          
        </div>
      </div>
    </div>
  )
}