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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'web@203E', 
    database: 'crowd_funding'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

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
        res.status(201).json({ message: 'User registered successfully' });
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

            const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token, user_id: results[0].id });
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
    };

    db.query('INSERT INTO fundraisers SET ?', fundraiser, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // return res.status(409).json({ message: 'Duplicate fundraiser' });
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

        req.user = {
            userId: decoded.userId
        };
        next();
    });
}



app.post('/donate', verifyToken, (req, res) => {
    const { fundraiserId, amount ,name, email} = req.body;
    const donor_id = req.user.userId;

    console.log(donor_id);

    console.log(fundraiserId+" "+amount)
    if (!fundraiserId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid donation request.' });
    }

    const fundraiserQuery = 'SELECT * FROM Fundraisers WHERE id = ? AND status = "active"';

    db.query(fundraiserQuery, [fundraiserId], (err, results) => {
        if (err) {
            console.error('Error fetching fundraiser:', err);
            return res.status(500).json({ message: 'Server error.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Fundraiser not found or not active.' });
        }

        const fundraiser = results[0];

        if (fundraiser.user_id === donor_id) {
            return res.status(403).json({ message: 'You cannot donate to your own fundraiser.' });
        }

        const insertDonation = 'INSERT INTO Donations (user_id, fundraiser_id, amount, name, email) VALUES (?, ?, ?, ? , ?)';
        const updateFundraiser = 'UPDATE Fundraisers SET raised = raised + ? WHERE id = ?';

        db.query(insertDonation, [donor_id, fundraiserId, amount,name,email], (err) => {
            if (err) {
                console.error('Error inserting donation:', err);
                return res.status(500).json({ message: 'Failed to record donation.' });
            }

            db.query(updateFundraiser, [amount, fundraiserId], (err) => {
                if (err) {
                    console.error('Error updating fundraiser amount:', err);
                    return res.status(500).json({ message: 'Donation saved, but failed to update total.' });
                }

                res.json({ message: 'Donation successful.' });
            });
        });
    });
});

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


app.listen(3000, () => {
    console.log('Server running on port 3000');
});
