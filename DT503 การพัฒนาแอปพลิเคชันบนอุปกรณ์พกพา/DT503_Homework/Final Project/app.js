const express = require("express");
const session = require("express-session");
const app = express();
const path = require("path");
const mainRouter = require("./routes/index");
const logger = require("./middleware/logger");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// static files
app.use(express.static(path.join(__dirname, "public")));

// session
app.use(session({
    secret: "NJTK_SECRET",
    resave: false,
    saveUninitialized: true
}));

// logger (ต้องมาก่อน routes)
app.use(logger);

// EJS view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use("/", mainRouter);

const port = 2000;
app.listen(port, () => console.log(`Server running on port ${port}`));