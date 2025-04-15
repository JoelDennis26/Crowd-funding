require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('uploads'));

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Added to parse form-urlencoded data
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',  // Change if needed
    password: 'web@203E',  // Change if needed
    database: 'crowd_funding'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage:storage });

// REGISTER USER
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
        res.status(201).json({ message: 'User registered successfully' });
    });
});

// LOGIN USER
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

            const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token, user_id: results[0].id });
        });
    });
});

app.post('/create-fundraiser', verifyToken,upload.single('image'), (req, res) => {
    const { userId } = req.user;  // User ID is decoded from JWT
    const { title, description, goal, category, image } = req.body;

    console.log("user - id ",userId);
    console.log("req body ",req.body);
    console.log("req file ",req.file);
    // Process and create the fundraiser
    db.query(
        'INSERT INTO fundraisers (user_id, title, description, goal, category, image_path) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, title, description, goal, category, image],
        (err, results) => {
            if (err) {
                console.error("❌ SQL ERROR:", err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ message: 'Fundraiser created successfully' });
        }
    );
});

function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];  // Get token from header

    console.log("Token recieved: "+token);

    if (!token) {
        return res.status(403).json({ message: 'Token is required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }

        // Attach decoded user info to the request
        req.user = decoded;
        next();
    });
}


// DONATE
app.post('/donate', (req, res) => {
    const { user_id, fundraiser_id, amount, name, email } = req.body;

    if (!user_id || !fundraiser_id || !amount || !name || !email) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const checkFundraiserQuery = 'SELECT * FROM fundraisers WHERE id = ?';
    db.query(checkFundraiserQuery, [fundraiser_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Fundraiser not found' });
        }

        const insertDonationQuery = 'INSERT INTO donations (user_id, fundraiser_id, amount, name, email) VALUES (?, ?, ?, ?, ?)';
        const values = [user_id, fundraiser_id, amount, name, email];
        
        db.query(insertDonationQuery, values, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error processing donation' });
            }
            res.status(200).json({ message: 'Donation successful' });
        });
    });
});

// START SERVER
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
