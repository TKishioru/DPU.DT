const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "../data/users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return { users: [] };
  }
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// REGISTER
router.post("/register", (req, res) => {
  const { email, password, fullname } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Missing fields" });

  let usersData = loadUsers();

  if (usersData.users.find((u) => u.email === email)) {
    return res.status(400).json({ message: "email already exists" });
  }

  const newUser = {
    email,
    password,
    fullname,
    username: email, // ใช้ email เป็น username
    createdAt: new Date().toISOString(),
  };

  usersData.users.push(newUser);
  saveUsers(usersData);

  res.json({ message: "User registered", user: newUser });
});

// LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const usersData = loadUsers();
  const user = usersData.users.find((u) => u.email === email);

  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.password !== password)
    return res.status(401).json({ message: "Incorrect password" });

  // เก็บข้อมูล user ลง session
    req.session.user = {
        email: user.email,
        fullname: user.fullname
    };
    
  res.json({
    message: "Login successful",
    user: {
      email: user.email,
      fullname: user.fullname,
      username: user.username,
    },
  });
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }
  console.log(req.session.user);
  res.json({
    loggedIn: true,
    user: req.session.user,
  });
  console.log(user);
});

module.exports = router;
