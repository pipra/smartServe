// Sample menu data for SmartServe
// This can be used to populate the database with initial menu items

export const sampleMenuItems = [
  {
    name: "Caesar Salad",
    price: 12.99,
    category: "Starters",
    description: "Fresh romaine lettuce, parmesan cheese, croutons, and our signature Caesar dressing",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Buffalo Wings",
    price: 14.99,
    category: "Starters",
    description: "Crispy chicken wings tossed in spicy buffalo sauce, served with ranch dip",
    isVegetarian: false,
    isSpicy: true,
    isVisible: true,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Grilled Salmon",
    price: 24.99,
    category: "Main Course",
    description: "Fresh Atlantic salmon grilled to perfection, served with seasonal vegetables and lemon butter sauce",
    isVegetarian: false,
    isSpicy: false,
    isVisible: true,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Margherita Pizza",
    price: 18.99,
    category: "Main Course",
    description: "Classic pizza with fresh mozzarella, tomato sauce, and basil leaves on a wood-fired crust",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Spicy Chicken Curry",
    price: 19.99,
    category: "Main Course",
    description: "Tender chicken pieces in a rich, aromatic curry sauce with basmati rice",
    isVegetarian: false,
    isSpicy: true,
    isVisible: true,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Vegetable Stir Fry",
    price: 16.99,
    category: "Main Course",
    description: "Fresh mixed vegetables stir-fried with ginger, garlic, and soy sauce, served with jasmine rice",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.3,
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Chocolate Lava Cake",
    price: 8.99,
    category: "Desserts",
    description: "Warm chocolate cake with a molten chocolate center, served with vanilla ice cream",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Tiramisu",
    price: 7.99,
    category: "Desserts",
    description: "Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Fresh Orange Juice",
    price: 4.99,
    category: "Beverages",
    description: "Freshly squeezed orange juice, no added sugar",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.4,
    image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Iced Coffee",
    price: 5.99,
    category: "Beverages",
    description: "Cold brew coffee served over ice with your choice of milk",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.2,
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Craft Beer",
    price: 6.99,
    category: "Beverages",
    description: "Local craft beer selection - ask your server for today's options",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  {
    name: "Bruschetta",
    price: 9.99,
    category: "Starters",
    description: "Toasted bread topped with fresh tomatoes, basil, garlic, and olive oil",
    isVegetarian: true,
    isSpicy: false,
    isVisible: true,
    rating: 4.4,
    image: "https://images.unsplash.com/photo-1572441713132-51c75654db73?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  }
]

// Function to add sample data to Firestore
export const addSampleData = async (db, addDoc, collection) => {
  try {
    for (const item of sampleMenuItems) {
      await addDoc(collection(db, 'MenuItems'), {
        ...item,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    console.log('Sample menu items added successfully!')
  } catch (error) {
    console.error('Error adding sample data:', error)
  }
}
