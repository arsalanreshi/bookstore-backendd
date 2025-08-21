# Bookstore Backend API

Express.js backend for the bookstore application with MongoDB integration.

## Features

- RESTful API for books management
- User authentication with JWT
- MongoDB integration with Mongoose
- Input validation
- CORS enabled for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Environment variables are already configured in `.env`

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Books
- `GET /api/books` - Get all books (with pagination, search, filtering)
- `GET /api/books/:id` - Get single book
- `POST /api/books` - Create new book
- `PUT /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book
- `GET /api/books/categories/list` - Get all categories

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (protected)

## Database Schema

### Book Model
- title, author, isbn, price, description
- category, stock, imageUrl
- publishedDate, publisher
- timestamps

### User Model
- name, email, password (hashed)
- role (user/admin), address, phone
- timestamps
