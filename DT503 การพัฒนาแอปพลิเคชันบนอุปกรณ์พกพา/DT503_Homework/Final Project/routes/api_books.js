const express = require("express");
const router = express.Router();

// import data
let books = require("../data/books"); 

// ดึงหนังสือทั้งหมด
router.get("/", (req, res) => {
    res.json(books);
});

// ดึงหนังสือรายตัว
router.get("/:id", (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
});