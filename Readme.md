# 🚀 Oracyn Backend API

A robust Node.js backend API for the Oracyn Document Intelligence Platform with user authentication, PostgreSQL database, and Docker support.

## 🏗️ Architecture

- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas
- **Security**: Helmet, CORS, Rate limiting
- **Containerization**: Docker & Docker Compose
- **Cache**: Redis (ready for implementation)

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Validation**: Zod
- **Security**: Helmet, CORS, express-rate-limit
- **File Upload**: Multer
- **Development**: Nodemon
- **Containerization**: Docker

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone Repository

```bash
git clone <repository-url>
cd oracyn-backend
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configurations
nano .env
```

### 3. Docker Setup (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Backend)
npm run docker:up

# Or build and start
npm run docker:build

# View logs
docker-compose logs -f backend

# Stop services
npm run docker:down
```

### 4. Manual Setup (Alternative)

```bash
# Install dependencies
npm install

# Start PostgreSQL (make sure it's running)
# Update DATABASE_URL in .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

## 📡 API Endpoints

### Base URL: `http://localhost:5000/api`

### 🔐 Authentication Routes

| Method | Endpoint                    | Description            | Access  |
| ------ | --------------------------- | ---------------------- | ------- |
| POST   | `/auth/register`            | Register new user      | Public  |
| POST   | `/auth/login`               | User login             | Public  |
| POST   | `/auth/logout`              | User logout            | Private |
| POST   | `/auth/refresh`             | Refresh access token   | Public  |
| GET    | `/auth/me`                  | Get current user       | Private |
| PUT    | `/auth/profile`             | Update profile         | Private |
| PUT    | `/auth/password`            | Change password        | Private |
| POST   | `/auth/verify-email`        | Verify email           | Public  |
| POST   | `/auth/resend-verification` | Resend verification    | Public  |
| POST   | `/auth/forgot-password`     | Request password reset | Public  |
| POST   | `/auth/reset-password`      | Reset password         | Public  |
| DELETE | `/auth/account`             | Deactivate account     | Private |

### 📊 System Routes

| Method | Endpoint  | Description       | Access |
| ------ | --------- | ----------------- | ------ |
| GET    | `/status` | API status        | Public |
| GET    | `/health` | Health check      | Public |
| GET    | `/docs`   | API documentation | Public |

## 🧪 API Testing

### Register User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "username": "johndoe",
    "password": "SecurePass123!",
    "confirmPassword": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login User

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Profile (with token)

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🗄️ Database Schema

### User Model

- **id**: Unique identifier (CUID)
- **email**: User email (unique)
- **username**: Username (unique)
- **password**: Hashed password
- **firstName/lastName**: Name fields
- **bio/profession**: Profile info
- **isActive/isVerified**: Account status
- **Security fields**: Reset tokens, verification tokens
- **Timestamps**: createdAt, updatedAt

### Related Models (Ready for LLM Backend)

- **Chat**: User conversations
- **Message**: Chat messages
- **Document**: Uploaded files
- **Chart**: Generated visualizations

## 🔧 Development Scripts

```bash
# Development
npm run dev              # Start with nodemon
npm start               # Production start

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Docker
npm run docker:up       # Start containers
npm run docker:down     # Stop containers
npm run docker:build    # Build and start
```

## 🛡️ Security Features

- **JWT Authentication** with access & refresh tokens
- **Password Hashing** with bcrypt (12 rounds)
- **Rate Limiting** (100 requests/15min per IP)
- **CORS Protection** with configurable origins
- **Helmet Security** headers
- **Input Validation** with Zod schemas
- **SQL Injection Protection** via Prisma
- **Email Verification** required for sensitive operations
- **Password Reset** with time-limited tokens

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/         # Route controllers
│   │   └── authController.js
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js         # Authentication middleware
│   │   ├── validation.js   # Zod validation schemas
│   │   └── errorHandler.js # Error handling
│   ├── routes/             # API routes
│   │   ├── index.js        # Main router
│   │   └── auth.js         # Auth routes
│   ├── utils/              # Utility functions
│   │   ├── jwt.js          # JWT utilities
│   │   └── bcrypt.js       # Password utilities
│   └── app.js              # Express app setup
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── docker-compose.yml      # Docker services
├── Dockerfile             # Container config
└── package.json           # Dependencies
```

## 🔐 Environment Variables

| Variable             | Description           | Default        |
| -------------------- | --------------------- | -------------- |
| `NODE_ENV`           | Environment           | development    |
| `PORT`               | Server port           | 5000           |
| `DATABASE_URL`       | PostgreSQL connection | Required       |
| `JWT_SECRET`         | JWT signing secret    | Required       |
| `JWT_REFRESH_SECRET` | Refresh token secret  | Required       |
| `BCRYPT_ROUNDS`      | Password hash rounds  | 12             |
| `CORS_ORIGIN`        | Allowed origins       | localhost:3000 |

## 🚦 Health Checks

- **API Status**: `GET /api/status`
- **Health Check**: `GET /api/health`
- **Database**: Connection test included
- **Docker**: Built-in health check

## 🔮 Future Integrations

### LLM Backend Connection (Planned)

- Chat management routes
- Document processing endpoints
- Chart generation APIs
- File upload handling
- AI response streaming

### Additional Features (Roadmap)

- Redis caching
- Email service integration
- File storage (S3/local)
- Advanced user roles
- Audit logging
- WebSocket support

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**

   ```bash
   # Check if PostgreSQL is running
   docker-compose ps

   # View database logs
   docker-compose logs postgres
   ```

2. **Port Already in Use**

   ```bash
   # Kill process on port 5000
   lsof -ti:5000 | xargs kill -9
   ```

3. **Prisma Issues**

   ```bash
   # Reset database
   npm run db:push --force-reset

   # Regenerate client
   npm run db:generate
   ```

### Development Tips

- Use `npm run db:studio` for database visualization
- Check logs with `docker-compose logs -f backend`
- Use `/api/health` to verify service status
- Test endpoints with `/api/docs` reference

## 📞 Support

- **Documentation**: `/api/docs`
- **Health Status**: `/api/health`
- **Issues**: Create GitHub issue
- **Email**: support@oracyn.com

---

**Built with ❤️ for the Oracyn Document Intelligence Platform**
