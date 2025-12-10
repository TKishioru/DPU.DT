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

/*


// -----------------------------
// ADD New Book
// -----------------------------
router.post("/books", (req, res) => {
    let { title, detail, image, author, rating, price, stock } = req.body;

    // Validate required fields
    if (!title || !detail || !author || !rating || !price) {
        return res.status(400).send("Missing required fields");
    }

    // Set default values
    stock = stock ?? 1;  
    image = image ?? "image/book-placeholder.png";

    // Generate new ID
    const newId = books.length > 0 ? books[books.length - 1].id + 1 : 1;

    const newBook = {
        id: newId,
        title,
        detail,
        image,
        author,
        rating,
        price,
        stock,
    };

    books.push(newBook);

    res.status(201).json({
        message: "Book added successfully",
        book: newBook,
    });
});

// -----------------------------
// UPDATE Book by ID
// -----------------------------
router.put("/books/:id", (req, res) => {
    const index = books.findIndex((element) => element.id === parseInt(req.params.id));

    // index = -1 means not found
    if (index === -1) {
        return res.status(404).send("Book not found");
    }

    const book = books[index];

    // Update only provided fields
    books[index] = {
        ...book,
        title: req.body.title ?? book.title,
        detail: req.body.detail ?? book.detail,
        author: req.body.author ?? book.author,
        rating: req.body.rating ?? book.rating,
        price: req.body.price ?? book.price,
        stock: req.body.stock ?? book.stock,
    };

    res.json({
        message: "Book updated successfully",
        book: books[index],
    });
});

// -----------------------------
// DELETE Book by ID
// -----------------------------
router.delete("/books/:id", (req, res) => {
    const index = books.findIndex((element) => element.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).send("Book not found");
    }

    books.splice(index, 1);

    res.json({
        message: "Book deleted successfully",
        books,
    });
});

// -----------------------------
// BUY 1 BOOK
// -----------------------------
router.post("/books/:id/buy", (req, res) => {
    const book = books.find((element) => element.id === parseInt(req.params.id));

    if (!book) {
        return res.status(404).send("Book not found");
    }

    if (book.stock <= 0) {
        return res.status(400).send("Book is out of stock");
    }

    book.stock -= 1;

    res.json({
        message: "Purchase successful",
        book,
    });
});

// -----------------------------
// BUY MULTIPLE BOOKS
// -----------------------------
router.post("/books/:id/buy/:quantity", (req, res) => {
    const book = books.find((element) => element.id === parseInt(req.params.id));
    const quantity = parseInt(req.params.quantity);

    if (!book) {
        return res.status(404).send("Book not found");
    }

    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).send("Invalid quantity");
    }

    if (book.stock < quantity) {
        return res.status(400).send("Insufficient stock");
    }

    book.stock -= quantity;

    res.json({
        message: `Purchase of ${quantity} copies successful`,
        book,
    });
});*/

// Export router
module.exports = router;