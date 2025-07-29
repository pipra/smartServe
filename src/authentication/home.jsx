import React, { useState, useEffect } from 'react'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

export default function Home() {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const slides = [
        {
            image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1974&q=80",
            title: "Welcome to SmartServe",
            subtitle: "Revolutionizing Restaurant Management"
        },
        {
            image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
            title: "Streamlined Operations",
            subtitle: "Efficient Management for Modern Restaurants"
        },
        {
            image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1974&q=80",
            title: "Enhanced Customer Experience",
            subtitle: "Delivering Excellence Every Time"
        }
    ]

    const features = [
        {
            icon: "👨‍💼",
            title: "Admin Dashboard",
            description: "Complete control over staff, inventory, and operations with powerful analytics and reporting tools."
        },
        {
            icon: "🍽️",
            title: "Waiter Management",
            description: "Streamlined order taking, table management, and customer service coordination."
        },
        {
            icon: "👨‍🍳",
            title: "Kitchen Operations",
            description: "Real-time order management, inventory tracking, and menu planning for chefs."
        },
        {
            icon: "💰",
            title: "Cashier System",
            description: "Secure payment processing, receipt generation, and transaction management."
        },
        {
            icon: "📊",
            title: "Analytics & Reports",
            description: "Comprehensive insights into sales, performance, and customer behavior."
        },
        {
            icon: "🔒",
            title: "Secure & Reliable",
            description: "Enterprise-grade security with role-based access control and data protection."
        }
    ]

    const testimonials = [
        {
            name: "Sarah Johnson",
            role: "Restaurant Owner",
            image: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=387&q=80",
            quote: "SmartServe transformed our restaurant operations. The efficiency gains are incredible!"
        },
        {
            name: "Mike Chen",
            role: "Head Chef",
            image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=387&q=80",
            quote: "Kitchen management has never been easier. Real-time orders and inventory tracking are game-changers."
        },
        {
            name: "Emily Rodriguez",
            role: "Manager",
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
            quote: "The analytics dashboard provides insights we never had before. Highly recommended!"
        }
    ]

    useEffect(() => {
        // Authentication state listener
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setLoading(false)
        })

        // Carousel timer
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length)
        }, 5000)

        return () => {
            clearInterval(timer)
            unsubscribe()
        }
    }, [slides.length])

    const handleLogout = async () => {
        try {
            // Set logout flag to prevent auto-redirect
            sessionStorage.setItem('justLoggedOut', 'true')
            await signOut(auth)
            console.log('User logged out successfully')
        } catch (error) {
            console.error('Error logging out:', error)
        }
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="bg-white shadow-lg fixed w-full z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center">
                                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-xl">S</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-900">SmartServe</span>
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#home" className="text-gray-900 hover:text-indigo-600 font-medium transition-colors">Home</a>
                            <a href="#features" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">Features</a>
                            <a href="#about" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">About</a>
                            <a href="#contact" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">Contact</a>
                            
                            {!loading && (
                                user ? (
                                    <div className="flex items-center space-x-4">
                                        <span className="text-gray-700 font-medium">
                                            Welcome, {user.email?.split('@')[0] || 'User'}
                                        </span>
                                        <button 
                                            onClick={handleLogout}
                                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                ) : (
                                    <a href="/login" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                        Sign In
                                    </a>
                                )
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="text-gray-700 hover:text-indigo-600 focus:outline-none"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Mobile Navigation */}
                    {isMenuOpen && (
                        <div className="md:hidden">
                            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
                                <a href="#home" className="block px-3 py-2 text-gray-900 font-medium">Home</a>
                                <a href="#features" className="block px-3 py-2 text-gray-700 hover:text-indigo-600">Features</a>
                                <a href="#about" className="block px-3 py-2 text-gray-700 hover:text-indigo-600">About</a>
                                <a href="#contact" className="block px-3 py-2 text-gray-700 hover:text-indigo-600">Contact</a>
                                
                                {!loading && (
                                    user ? (
                                        <div className="px-3 py-2">
                                            <div className="text-gray-700 font-medium mb-2">
                                                Welcome, {user.email?.split('@')[0] || 'User'}
                                            </div>
                                            <button 
                                                onClick={handleLogout}
                                                className="w-full bg-red-600 text-white px-3 py-2 rounded-lg text-center hover:bg-red-700 transition-colors"
                                            >
                                                Sign Out
                                            </button>
                                        </div>
                                    ) : (
                                        <a href="/login" className="block px-3 py-2 bg-indigo-600 text-white rounded-lg text-center">Sign In</a>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section with Carousel */}
            <section id="home" className="relative h-screen overflow-hidden">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentSlide ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                        <div
                            className="h-full bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: `url(${slide.image})` }}
                        >
                            <div className="absolute inset-0 bg-black bg-opacity-50"></div>
                            <div className="relative h-full flex items-center justify-center text-center text-white px-4">
                                <div className="max-w-4xl">
                                    <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
                                        {slide.title}
                                    </h1>
                                    <p className="text-xl md:text-2xl mb-8 animate-fade-in-delay">
                                        {slide.subtitle}
                                    </p>
                                    <div className="space-x-4">
                                        <a
                                            href="/login"
                                            className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors inline-block"
                                        >
                                            Get Started
                                        </a>
                                        <a
                                            href="#features"
                                            className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors inline-block"
                                        >
                                            Learn More
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Carousel Indicators */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`w-3 h-3 rounded-full transition-colors ${
                                index === currentSlide ? 'bg-white' : 'bg-white bg-opacity-50'
                            }`}
                        />
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Comprehensive tools designed to streamline your restaurant operations and enhance customer experience
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-20 bg-indigo-600">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
                        <div>
                            <div className="text-4xl font-bold mb-2">500+</div>
                            <div className="text-indigo-200">Restaurants</div>
                        </div>
                        <div>
                            <div className="text-4xl font-bold mb-2">50K+</div>
                            <div className="text-indigo-200">Orders Processed</div>
                        </div>
                        <div>
                            <div className="text-4xl font-bold mb-2">99.9%</div>
                            <div className="text-indigo-200">Uptime</div>
                        </div>
                        <div>
                            <div className="text-4xl font-bold mb-2">24/7</div>
                            <div className="text-indigo-200">Support</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Clients Say</h2>
                        <p className="text-xl text-gray-600">Trusted by restaurant owners and managers worldwide</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="bg-gray-50 p-8 rounded-xl">
                                <div className="flex items-center mb-4">
                                    <img
                                        className="w-12 h-12 rounded-full mr-4"
                                        src={testimonial.image}
                                        alt={testimonial.name}
                                    />
                                    <div>
                                        <div className="font-semibold text-gray-900">{testimonial.name}</div>
                                        <div className="text-gray-600 text-sm">{testimonial.role}</div>
                                    </div>
                                </div>
                                <p className="text-gray-700 italic">"{testimonial.quote}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your Restaurant?</h2>
                    <p className="text-xl text-indigo-100 mb-8">
                        Join thousands of restaurants already using SmartServe to streamline operations and boost efficiency
                    </p>
                    <div className="space-x-4">
                        <a
                            href="/signup"
                            className="bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
                        >
                            Start Free Trial
                        </a>
                        <a
                            href="#contact"
                            className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-white hover:text-indigo-600 transition-colors inline-block"
                        >
                            Contact Sales
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer id="contact" className="bg-gray-900 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center mb-4">
                                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-xl">S</span>
                                </div>
                                <span className="text-2xl font-bold">SmartServe</span>
                            </div>
                            <p className="text-gray-400 mb-4 max-w-md">
                                Revolutionizing restaurant management with cutting-edge technology and intuitive design.
                            </p>
                            <div className="flex space-x-4">
                                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                                    </svg>
                                </a>
                                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                                    </svg>
                                </a>
                                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <ul className="space-y-2 text-gray-400">
                                <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
                                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="/login" className="hover:text-white transition-colors">Sign In</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
                            <ul className="space-y-2 text-gray-400">
                                <li>📧 info@smartserve.com</li>
                                <li>📞 +1 (555) 123-4567</li>
                                <li>📍 123 Restaurant St, Food City, FC 12345</li>
                                <li>🕒 24/7 Support Available</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
                        <p>&copy; 2025 SmartServe. All rights reserved. Built with ❤️ for restaurants worldwide.</p>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes fade-in-delay {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .animate-fade-in {
                    animation: fade-in 1s ease-out;
                }
                
                .animate-fade-in-delay {
                    animation: fade-in-delay 1s ease-out 0.3s both;
                }
            `}</style>
        </div>
    )
}