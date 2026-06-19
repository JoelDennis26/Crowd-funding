# FundHive 🐝

FundHive is a modern, transparent crowdfunding platform designed to empower individuals, communities, and visionaries to fund their dreams. Whether it’s for education, medical emergencies, startup ideas, or environmental causes, FundHive provides a seamless way to raise and contribute funds. 

Zero platform convenience fees are collected—your donations go directly toward making a difference.

## 🚀 Tech Stack

This project was recently modernized into a fully decoupled Single Page Application (SPA) architecture:

### Frontend
- **React.js** powered by **Vite** for lightning-fast HMR and build times
- **React Router (v6)** for client-side navigation
- **Axios** for API communication
- Pure, handwritten CSS with premium glassmorphism design aesthetics

### Backend
- **Node.js & Express.js** providing a robust REST API
- **MySQL2** for persistent relational data storage
- **Bcrypt & JWT** for secure user authentication and session management
- **Multer** for handling local image uploads

### Integrations
- **Razorpay API** for secure, real-time payment processing (Test Mode)
- **Nodemailer** for automated, transactional SMTP email notifications

---

## ✨ Features

- **User Authentication:** Secure signup, login, and JWT-based session handling.
- **Campaign Creation:** Users can easily launch campaigns with rich descriptions, goals, and cover images.
- **Razorpay Donations:** Fully integrated checkout flow allowing users to safely donate to campaigns.
- **Admin Dashboard:** Specialized admin role to review, approve, or reject pending campaigns before they go live.
- **Automated Emails:** Live email notifications sent for campaign approvals, donations received, and milestone targets met.
- **Live Donation Feed:** Real-time feed of recent donations globally visible on the homepage.
- **Responsive Design:** A beautiful, responsive glassmorphism UI that looks great on any device.

---

## 🛠️ Local Setup & Installation

### Prerequisites
- Node.js (v16+)
- MySQL Server

### 1. Database Setup
1. Open your MySQL client and create a new database called `crowdfunding`.
2. Locate the database schema inside the `/migrations` folder (or just run the backend server—it might auto-create tables depending on your config).

### 2. Backend Environment Variables
Create a `.env` file in the root directory (`/Crowd-funding`) and configure the following variables:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crowdfunding

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# SMTP / Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=FundHive <your_email@gmail.com>

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Frontend App URL
FRONTEND_URL=http://localhost:5173
```

### 3. Install Dependencies
Install dependencies for both the backend and frontend.
```bash
# In the root directory (Backend)
npm install

# In the client directory (Frontend)
cd client
npm install
```

### 4. Running the Application

You need to start two separate servers in your terminal to run the app.

**Terminal 1: Start the Backend Server**
```bash
# In the root directory
node server.js
```
*(The API server will run on `http://localhost:3000`)*

**Terminal 2: Start the React Frontend**
```bash
# In the client directory
cd client
npm run dev
```
*(The Vite dev server will run on `http://localhost:5173`)*

Open `http://localhost:5173` in your browser to view the application!

---

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License
This project is open-source and free to use.
