require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);



app.use('/images', express.static(path.join(__dirname, 'images')));

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '', 
    database: process.env.DB_NAME || 'crowd_funding'
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL via Connection Pool');
        connection.release();
    }
});

// Make db accessible to route modules via req.app.get('db')
app.set('db', db);

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
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 
    [username, email, hashedPassword], 
    (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            return res.status(500).json({ message: 'Error registering user' });
        }

        const userId = result.insertId;

        // Requirement 1.1 — generate a unique 64-char hex token with 24-hour expiry
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

        db.query(
            'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAt],
            (tokenErr) => {
                if (tokenErr) {
                    console.error('[register] Failed to insert verification token:', tokenErr);
                    // User is created but token failed — still return success so the user
                    // can use resend-verification to get a new token.
                }

                // Fire-and-forget: send verification email
                sendVerificationEmail({ email, username }, token);

                res.status(201).json({
                    message: 'User registered successfully. Please check your email to verify your account.',
                });
            }
        );
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const hashedPassword = results[0].password_hash;

        if(!hashedPassword){
            return res.status(500).json({ message: 'Password not found in database' });
        }

        bcrypt.compare(password, hashedPassword, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            if (results[0].is_verified !== 1) {
                return res.status(401).json({
                    message: 'Please verify your email before logging in.',
                    resendAvailable: true
                });
            }

            const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token, user_id: results[0].id, is_admin: results[0].is_admin });
        });
    });
});

app.post('/create-fundraiser', verifyToken, upload.single('image'), (req, res) => {
    const { title, description, goal, category, end_date } = req.body;
    const { userId } = req.user;

    if (!title || !description || !goal || !category || !userId || !req.file) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const fundraiser = {
        user_id: userId,
        title,
        description,
        goal: parseFloat(goal),
        category,
        image_path: `/uploads/${req.file.filename}`,
        verification_status: 'pending',
        status: 'draft',
    };

    db.query('INSERT INTO fundraisers SET ?', fundraiser, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // return res.status(409).json({ message: 'Duplicate fundraiser' });
                return res.status(201).json({ message: 'Fundraiser created successfully' });
            }
            console.error('DB insert error:', err);
            return res.status(500).json({ message: 'Server error' });
        }

        return res.status(201).json({ message: 'Fundraiser created successfully' });
    });
});


function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    console.log("Token recieved: "+token);

    if (!token) {
        return res.status(403).json({ message: 'Token is required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }

        // Fetch is_admin from the database so admin middleware can rely on it
        db.query('SELECT is_admin FROM users WHERE id = ?', [decoded.userId], (dbErr, rows) => {
            if (dbErr || rows.length === 0) {
                req.user = { userId: decoded.userId, is_admin: 0 };
            } else {
                req.user = { userId: decoded.userId, is_admin: rows[0].is_admin };
            }
            next();
        });
    });
}

// Mount admin routes (requires verifyToken + isAdmin)
app.use('/api/admin', createAdminRouter(db, verifyToken));

// Mount milestones router
app.use(milestonesRouter);

// Mount payment routes — inject db connection via req.db
app.use('/api/payments', (req, _res, next) => { req.db = db; next(); }, paymentsRouter);


app.get('/fundraisers', (req, res) => {
    console.log("Fetching fundraisers from DB...");
    db.query('SELECT * FROM Fundraisers', (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Found ${results.length} fundraisers`);
        res.json(results);
    });
});

app.get('/fundraisers/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM Fundraisers WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error fetching fundraiser:', err);
            return res.status(500).json({ message: 'Error fetching fundraiser' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Fundraiser not found' });
        }
        res.json(results[0]);
    });
});

app.get('/donations', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    
    const query = `
        SELECT 
            d.id, 
            d.amount, 
            d.created_at,
            d.name,
            f.title AS fundraiser_title
        FROM Donations d
        LEFT JOIN Fundraisers f ON d.fundraiser_id = f.id
        ORDER BY d.created_at DESC
        LIMIT ?
    `;

    console.log(query);
    
    db.query(query, [limit], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
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
