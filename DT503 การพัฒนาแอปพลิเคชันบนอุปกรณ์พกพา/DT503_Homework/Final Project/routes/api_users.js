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
    const {email, password, fullname } = req.body;
    console.log(req.body);

    if (!email || !password) {
        console.log(email, password);
        return res.status(400).json({ message: "Missing email or password" });
    }

    let usersData = loadUsers();

    // เช็คว่ามี email นี้แล้วหรือยัง
    const exists = usersData.users.find(u => u.email === email);
    if (exists) {
        return res.status(400).json({ message: "email already exists" });
    }

    // บันทึกผู้ใช้ใหม่
    const newUser = {
        email,
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
    const { email, password } = req.body;

    const usersData = loadUsers();
    const user = usersData.users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (user.password !== password) {
        return res.status(401).json({ message: "Incorrect password" });
    }

    // เก็บข้อมูล user ลง session
    req.session.user = {
        email: user.email,
        fullname: user.fullname
    };

    res.json({ message: "Login successful", user: req.session.user });
});

router.get("/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Not logged in" });
    }
console.log(req.session.user);
    res.json({
        loggedIn: true,
        user: req.session.user
    });
    console.log(user);
});

module.exports = router;