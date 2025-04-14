require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

        // console.log("User query results:", results);

        const hashedPassword = results[0].password_hash;

        // console.log(hashedPassword);

        if(!hashedPassword){
            return res.status(500).json({ message: 'Password not found in database' });
        }

        // console.log("Comparing provided password:", password, "with hashed password:", hashedPassword);

        bcrypt.compare(password, hashedPassword, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        });
    });
});

// START SERVER
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
