require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sendVerificationEmail } = require('./services/emailService');

// Models
const User = require('./models/User');
const Campaign = require('./models/Campaign');
const Donation = require('./models/Donation');

const authRouter = require('./routes/auth');
const createAdminRouter = require('./routes/admin');
const paymentsRouter = require('./routes/payments');
const milestonesRouter = require('./routes/milestones');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.static('uploads'));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection failed:', err));

// Mount auth routes (email verification endpoints)
app.use(authRouter);

const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newUser = new User({
            username,
            email,
            password_hash: hashedPassword,
            verification_token: token,
            verification_token_expires: expiresAt
        });

        await newUser.save();

        sendVerificationEmail({ email, username }, token);

        res.status(201).json({
            message: 'User registered successfully. Please check your email to verify your account.',
        });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Error registering user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.is_verified) {
            return res.status(401).json({
                message: 'Please verify your email before logging in.',
                resendAvailable: true
            });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user_id: user._id, is_admin: user.is_admin });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/create-fundraiser', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description, goal, category } = req.body;
        const { userId } = req.user;

        if (!title || !description || !goal || !category || !userId || !req.file) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const campaign = new Campaign({
            user_id: userId,
            title,
            description,
            goal: parseFloat(goal),
            category,
            image_path: `/uploads/${req.file.filename}`,
            status: 'draft' // or pending, keeping it draft to match prev logic
        });

        await campaign.save();
        res.status(201).json({ message: 'Fundraiser created successfully' });
    } catch (err) {
        console.error('Create fundraiser error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

async function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token is required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            req.user = { userId: decoded.userId, is_admin: false };
        } else {
            req.user = { userId: decoded.userId, is_admin: user.is_admin };
        }
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid token' });
    }
}

// Mount admin routes (requires verifyToken)
app.use('/api/admin', createAdminRouter(verifyToken));

// Mount milestones router
app.use(milestonesRouter);

// Mount payment routes
app.use('/api/payments', paymentsRouter);

app.get('/fundraisers', async (req, res) => {
    try {
        const campaigns = await Campaign.find({});
        res.json(campaigns);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/fundraisers/my', verifyToken, async (req, res) => {
    try {
        const campaigns = await Campaign.find({ user_id: req.user.userId });
        res.json(campaigns);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/fundraisers/:id', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ message: 'Fundraiser not found' });
        }
        res.json(campaign);
    } catch (err) {
        console.error('Error fetching fundraiser:', err);
        res.status(500).json({ message: 'Error fetching fundraiser' });
    }
});

app.get('/donations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const donations = await Donation.find({})
            .populate('campaign_id', 'title') // fetch fundraiser title
            .sort({ created_at: -1 })
            .limit(limit);

        // Format for backward compatibility with frontend:
        const formatted = donations.map(d => ({
            id: d._id,
            amount: d.amount,
            created_at: d.created_at,
            name: d.name,
            message: d.message,
            fundraiser_title: d.campaign_id ? d.campaign_id.title : null
        }));
        
        res.json(formatted);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
