const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "../data/users.json");

// โหลดข้อมูล users
function loadUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch (err) {
        return { users: [] };
    }
}

// บันทึกข้อมูล users
function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ---------------------
// REGISTER
// ---------------------
router.post("/register", (req, res) => {
    const { username, password, fullname } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Missing username or password" });
    }

    let usersData = loadUsers();

    // เช็คว่ามี username นี้แล้วหรือยัง
    const exists = usersData.users.find(u => u.username === username);
    if (exists) {
        return res.status(400).json({ message: "Username already exists" });
    }

    // บันทึกผู้ใช้ใหม่
    const newUser = {
        username,
        password, // *Note: production ต้อง hash password!
        fullname: fullname || "",
        createdAt: new Date()
    };

    usersData.users.push(newUser);
    saveUsers(usersData);

    res.json({ message: "User registered", user: newUser });
});

// ---------------------
// LOGIN
// ---------------------
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    const usersData = loadUsers();
    const user = usersData.users.find(u => u.username === username);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (user.password !== password) {
        return res.status(401).json({ message: "Incorrect password" });
    }

    // เก็บข้อมูล user ลง session
    req.session.user = {
        username: user.username,
        fullname: user.fullname
    };

    res.json({ message: "Login successful", user: req.session.user });
});

// ---------------------
// LOGOUT
// ---------------------
router.post("/logout", (req, res) => {
    req.session.destroy();
    res.json({ message: "Logged out" });
});

module.exports = router;