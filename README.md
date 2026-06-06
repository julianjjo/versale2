# Versale - Used Clothing Marketplace

A full-stack application for buying and selling used clothing.

## Stack

- **Backend**: NestJS (Node.js) with Prisma ORM (SQLite for development, easy migration to Supabase/PostgreSQL)
- **Frontend**: Next.js (React) with TypeScript, Tailwind CSS, and React Query
- **Database**: SQLite (local) - designed for easy migration to PostgreSQL/Supabase

## Features

- User Authentication (Signup, Login, JWT)
- Product CRUD with search and filtering (size, brand, condition, price)
- Shopping Cart (persisted in database)
- Order Management (create orders, view history)
- User Profiles (edit profile, view orders)
- Product Reviews and Ratings
- Basic Admin Dashboard (user and product management)
- Responsive Design (mobile-first)

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root of the `apps/api` directory:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your_secret_key_here"
PORT=3001
```

### Development

To start both the API and the frontend in development mode:

```bash
npm run dev
```

This will start:
- API: http://localhost:3001
- Frontend: http://localhost:3000

API documentation will be available at: http://localhost:3001/api

### Database

We use Prisma ORM with SQLite for development.

To reset the database and run migrations:

```bash
cd apps/api
npx prisma migrate reset
```

### Building for Production

```bash
npm run build
```

To start the production servers:

```bash
npm start
```

## Project Structure

```
versale/
├─ apps/
│  ├─ api          # NestJS backend
│  └─ web          # Next.js frontend
├─ packages/
│  ├─ ui           # Shared UI components (optional)
│  ├─ types        # Shared TypeScript types
│  └─ config       # Shared configurations (ESLint, Tailwind, etc.)
└─ ...config files
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Register a new user
- `POST /auth/login` - Login and receive JWT token

### Users
- `GET /users` - Get all users (admin only)
- `GET /users/:id` - Get user by ID
- `PATCH /users/me` - Update current user's profile
- `GET /users/me` - Get current user's profile

### Products
- `GET /products` - Get all products with filtering
- `GET /products/:id` - Get product by ID
- `POST /products` - Create a new product (authenticated)
- `PATCH /products/:id` - Update a product (authenticated, owner only)
- `DELETE /products/:id` - Delete a product (authenticated, owner only)

### Cart
- `GET /cart` - Get current user's cart
- `POST /cart/items` - Add item to cart
- `PATCH /cart/items/:itemId` - Update cart item quantity
- `DELETE /cart/items/:itemId` - Remove item from cart

### Orders
- `POST /orders` - Create order from cart
- `GET /orders` - Get user's order history
- `GET /orders/:id` - Get order by ID

### Reviews
- `GET /products/:id/reviews` - Get reviews for a product
- `POST /products/:id/reviews` - Create a review for a product (authenticated)

### Admin
- `GET /admin/stats` - Get platform statistics
- `GET /admin/users` - Get all users
- `GET /admin/products` - Get all products (including pending approval)
- `PATCH /admin/products/:id/approve` - Approve a product

## Testing

Run unit and integration tests:

```bash
npm test
```

## License

This project is licensed under the MIT License.