import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import React, { useState, useEffect } from 'react'
import { auth, db } from '../../services/firebase/config.js'
import { onAuthStateChanged } from 'firebase/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check if user is already logged in on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        // Check for logout flag first
        const loggedOut = sessionStorage.getItem('justLoggedOut')
        if (loggedOut) {
          sessionStorage.removeItem('justLoggedOut') // Clean up
          setIsCheckingAuth(false)
          return
        }

        if (user) {
          console.log('User already logged in, checking role...')
          
          // Verify user has valid token
          try {
            const token = await user.getIdToken(false)
            if (!token) {
              setIsCheckingAuth(false)
              return
            }
          } catch (tokenError) {
            console.log('Token verification failed:', tokenError)
            setIsCheckingAuth(false)
            return
          }

          // Check user role and redirect accordingly
          let userData = null
          let userRole = null

          // Check Admin collection
          const adminDoc = await getDoc(doc(db, 'Admin', user.uid))
          if (adminDoc.exists()) {
            userData = adminDoc.data()
            userRole = 'admin'
          } else {
            // Check Waiters collection
            const waiterDoc = await getDoc(doc(db, 'Waiters', user.uid))
            if (waiterDoc.exists()) {
              userData = waiterDoc.data()
              userRole = 'waiter'
            } else {
              // Check Chefs collection
              const chefDoc = await getDoc(doc(db, 'Chefs', user.uid))
              if (chefDoc.exists()) {
                userData = chefDoc.data()
                userRole = 'chef'
              } else {
                // Check Cashiers collection
                const cashierDoc = await getDoc(doc(db, 'Cashiers', user.uid))
                if (cashierDoc.exists()) {
                  userData = cashierDoc.data()
                  userRole = 'cashier'
                } else {
                  // Check users collection
                  const userDoc = await getDoc(doc(db, 'Users', user.uid))
                  if (userDoc.exists()) {
                    userData = userDoc.data()
                    userRole = userData.role || userData.userType || 'user' // Check both role and userType fields
                  }
                }
              }
            }
          }

          if (userData && userRole) {
            // Check approval status for staff roles
            if (userRole === 'waiter' && (!userData.approval || userData.status === 'pending')) {
              console.log('Waiter account pending approval, staying on login page')
              setIsCheckingAuth(false)
              return
            }
            
            if (userRole === 'chef' && (!userData.approval || userData.status === 'pending')) {
              console.log('Chef account pending approval, staying on login page')
              setIsCheckingAuth(false)
              return
            }
            
            if (userRole === 'cashier' && (!userData.approval || userData.status === 'pending')) {
              console.log('Cashier account pending approval, staying on login page')
              setIsCheckingAuth(false)
              return
            }

            // Redirect based on user role
            console.log('User already authenticated, redirecting to dashboard for role:', userRole)
            switch (userRole) {
              case 'admin':
                window.location.replace('/dashboard/admin')
                break
              case 'waiter':
                window.location.replace('/dashboard/waiter')
                break
              case 'chef':
                window.location.replace('/dashboard/chef')
                break
              case 'cashier':
                window.location.replace('/dashboard/cashier')
                break
              default:
                window.location.replace('/home')
            }
            return // Don't set isCheckingAuth to false since we're redirecting
          }
        }
        
        setIsCheckingAuth(false)
      } catch (error) {
        console.error('Error checking auth state:', error)
        setIsCheckingAuth(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="animate-spin h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Checking authentication...</h2>
          <p className="text-gray-600">Please wait while we verify your login status</p>
        </div>
      </div>
    )
  }

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
                            // Finally try Users collection (for other roles)
                            const userDoc = await getDoc(doc(db, 'Users', userCredential.user.uid));
                            if (userDoc.exists()) {
                                userData = userDoc.data();
                                userRole = userData.role || userData.userType || 'user'; // Check both role and userType fields
                            }
                        }
                    }
                }
            }
            
            if (userData) {
                // Check approval status for staff roles
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
                

                console.log('User data found:', userData);
                console.log('User role identified:', userRole);

                // Redirect based on user role
                switch (userRole) {
                    case 'admin':
                        window.location.replace('/dashboard/admin');
                        break;
                    case 'waiter':
                        window.location.replace('/dashboard/waiter');
                        break;
                    case 'chef':
                        window.location.replace('/dashboard/chef');
                        break;
                    case 'cashier':
                        window.location.replace('/dashboard/cashier');
                        break;
                    case 'user':
                    default:
                        window.location.replace('/home');
                }
            } else {
                // If no user document exists, show error
                console.log("No user document found in any collection.");
                setError('User account not found. Please contact support or try signing up again.');
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

          {/* Divider */}
          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">New to SmartServe?</span>
              </div>
            </div>
          </div>

          {/* Sign Up Options */}
          <div className="space-y-4">
            <h3 className="text-center text-sm font-medium text-gray-900 mb-4">Join as:</h3>
            
            {/* Role-based signup buttons grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* General User */}
              <a
                href="/signup"
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-2 text-gray-500 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                User
              </a>

              {/* Waiter */}
              <a
                href="/waiterSignUp"
                className="flex items-center justify-center px-4 py-3 border border-green-300 rounded-lg text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-2 text-green-500 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Waiter
              </a>

              {/* Chef */}
              <a
                href="/chefSignUp"
                className="flex items-center justify-center px-4 py-3 border border-orange-300 rounded-lg text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-2 text-orange-500 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Chef
              </a>

              {/* Cashier */}
              <a
                href="/cashierSignUp"
                className="flex items-center justify-center px-4 py-3 border border-teal-300 rounded-lg text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 hover:border-teal-400 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-2 text-teal-500 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cashier
              </a>
            </div>

            {/* Admin - Special placement */}
            <div className="pt-2">
              <a
                href="/adminSignUp"
                className="flex items-center justify-center w-full px-4 py-3 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 mr-2 text-purple-500 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Administrator
              </a>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}