// Load environment variables (optional)
require("dotenv").config();

// Import required packages
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bodyParser = require("body-parser");

// Create an Express application
const app = express();

// Enable CORS for cross-origin requests
app.use(cors());

// Middleware to parse JSON request body
app.use(express.json());
app.use(bodyParser.json());

// PostgreSQL Database Connection (Local)
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "hostel_management",
  password: "sem4@Amrita",
  port: 5432,
});

// Test Database Connection
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL locally"))
  .catch(err => console.error("❌ PostgreSQL Connection Error:", err));

// 📌 Login Route
// 📌 Login Route
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Query database for user
    const userQuery = "SELECT * FROM users WHERE username = $1";
    const user = await pool.query(userQuery, [username]);

    // Check if user exists
    if (user.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check password
    const dbUser = user.rows[0];
    if (dbUser.password !== password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // ✅ Return the full ID (e.g., CB.AI.U4AID23026)
    res.status(200).json({ id: dbUser.id });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// 📌 Get Student by Roll Number (Used for Profile Page)
app.get("/student/:rollno", async (req, res) => {
  try {
    const rollno = req.params.rollno;
    const result = await pool.query("SELECT * FROM student WHERE rollno = $1", [rollno]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// 📌 Get Student by Name (Search by first or last name)
app.get("/student/name/:name", async (req, res) => {
  try {
    const name = req.params.name;
    
    // Use the LIKE operator for partial matching, allowing case-insensitive search
    const result = await pool.query(
      "SELECT * FROM student WHERE LOWER(name) LIKE LOWER($1)",
      [`%${name}%`]  // '%' allows partial matching before and after the input string
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No students found with that name" });
    }

    res.json(result.rows);  // Send all matching students, not just one
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/complaints', async (req, res) => {
  const { complaint_source, rollno, block_name, complaint_text } = req.body;

  // Basic validations
  if (!complaint_source || !complaint_text) {
    return res.status(400).json({ error: 'Missing complaint source or text' });
  }

  // Conditional validation for student and block complaints
  if (complaint_source === 'student') {
    if (!rollno || block_name) {
      return res.status(400).json({ error: 'Student complaints must have rollno and no block_name' });
    }
    // Validate that the rollno exists in the student table
    try {
      const studentCheck = await pool.query('SELECT * FROM student WHERE rollno = $1', [rollno]);
      if (studentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid roll number. Student not found.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Error checking student roll number.' });
    }
  } else if (complaint_source === 'block') {
    // Block complaints must have block_name
    if (!block_name) {
      return res.status(400).json({ error: 'Block complaints must have block_name' });
    }

    // Rollno is allowed for block complaints, but validate the rollno exists in the student table
    if (rollno) {
      try {
        const studentCheck = await pool.query('SELECT * FROM student WHERE rollno = $1', [rollno]);
        if (studentCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid roll number. Student not found.' });
        }
      } catch (err) {
        return res.status(500).json({ error: 'Error checking student roll number.' });
      }
    }
  } else {
    return res.status(400).json({ error: 'Invalid complaint source' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO complaints (complaint_source, rollno, block_name, complaint_text) VALUES ($1, $2, $3, $4) RETURNING *',
      [complaint_source, rollno || null, block_name || null, complaint_text]
    );

    res.status(201).json({ message: 'Complaint submitted successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Error inserting complaint:', err);
    if (err.code === '23503') {
      res.status(400).json({ error: 'Invalid block name. Must be one of A, B, C, D' });
    } else if (err.code === '23514') {
      res.status(400).json({ error: 'Constraint failed: Check complaint_source and corresponding fields' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});



// 📌 Get Student by Roll Number (Used for Profile Page)
app.get("/student/:rollno", async (req, res) => {
  try {
    const rollno = req.params.rollno;
    const result = await pool.query("SELECT * FROM student WHERE rollno = $1", [rollno]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const student = result.rows[0];
    const welcomeMessage = `Hi ${student.name}! Welcome to your hostel Hub. Easily manage your hostel life - file a complaint or explore student info with just a click.`;

    res.json({ 
      message: welcomeMessage, 
      student: student 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/room/:roomno/students", async (req, res) => {
  const { roomno } = req.params;
  console.log("Fetching students for room:", roomno);
  
  try {
    const result = await pool.query(
      "SELECT * FROM student WHERE roomno = $1",
      [roomno]
    );

    console.log("Query result:", result.rows);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No students found for this room" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("🔥 Error fetching students by room:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// 📌 Add Announcement
app.post("/announcements", async (req, res) => {
  try {
    const { title, content, student_rollno } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    if (student_rollno) {
      const studentCheck = await pool.query('SELECT * FROM student WHERE rollno = $1', [student_rollno]);
      if (studentCheck.rows.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
    }

    const result = await pool.query(
      'INSERT INTO announcements (title, content, student_rollno) VALUES ($1, $2, $3) RETURNING *',
      [title, content, student_rollno || null]
    );

    res.status(201).json({ message: "Announcement added successfully", data: result.rows[0] });
  } catch (err) {
    console.error("Error adding announcement:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Get All Announcements
app.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(result.rows);  // Send the announcements sorted by the most recent first
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



// Start the Express server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
