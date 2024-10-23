const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

// PostgreSQL connection settings
const pool = new Pool({
  user: 'postgres',       // PostgreSQL username
  host: 'tcdb.c54micc800ju.us-east-1.rds.amazonaws.com', // AWS RDS endpoint (hostname)
  database: 'tcdb',      // Database name
  password: 'rohan123',  // PostgreSQL password
  port: 5432,
  ssl: {
    rejectUnauthorized: false,  // Optional: for self-signed certificates
  },              // Default PostgreSQL port
});

// Function to execute queries
const query = (text, params) => pool.query(text, params);

// Initialize Express app
const app = express();
const port = 4000;

// Middleware
app.use(cors()); // This will allow all origins by default
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve the HTML page on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

// Create users table route
app.post('/create-table', async (req, res) => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      mobile VARCHAR(15),
      password VARCHAR(255) NOT NULL
    );
  `;

  try {
    await query(createTableQuery);
    res.status(200).json({ message: 'Users table created successfully!' });
  } catch (error) {
    console.error('Error creating users table:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Register Route
app.post('/register', async (req, res) => {
  const { name, email, mobile, password } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if email already exists
    const emailCheckQuery = 'SELECT * FROM users WHERE email = $1';
    const emailCheckResult = await query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user data into the database
    const insertUserQuery = `
      INSERT INTO users (name, email, mobile, password)
      VALUES ($1, $2, $3, $4) RETURNING id, name, email, mobile
    `;
    const newUser = await query(insertUserQuery, [name, email, mobile, hashedPassword]);

    res.status(201).json({ message: 'User registered successfully!', user: newUser.rows[0] });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find user by email
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Successful login
    res.status(200).json({ message: 'Login successful!', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
// Get all users route
app.get('/users', async (req, res) => {
    try {
        const getUsersQuery = 'SELECT id, name, email, mobile FROM users';
        const result = await query(getUsersQuery);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
