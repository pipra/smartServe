// Simple script to create an admin user
// This is a utility script to help create the first admin user

console.log(`
=================================
   SmartServe Admin User Setup
=================================

To create an admin user:

1. Open your browser and go to: http://localhost:5173
2. Click on "Want to be an Admin? Sign Up" (purple link at the bottom)
3. Fill in the admin registration form with:
   - Full Name: Your name
   - Email: Your email address
   - Admin Code: ADMIN2025
   - Password: Your secure password
   - Confirm Password: Same password

4. After successful registration, you'll be redirected to login
5. Login with your admin credentials
6. You'll be automatically redirected to /dashboard/admin

Admin Features:
- Dashboard with statistics overview
- Staff management sections
- Restaurant management tools
- Logout functionality

The admin verification code is: ADMIN2025
(In production, this should be more secure and configurable)

Happy administrating! 🎉
`);
