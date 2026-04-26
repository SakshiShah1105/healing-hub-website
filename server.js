const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const habitRoutes = require("./routes/habbitRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { pool, testDatabaseConnection } = require("./config/db");

const app = express();

const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use("/uploads", express.static(uploadsPath));

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Healing Hub backend is running"
    });
});

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS ok");

        return res.status(200).json({
            success: true,
            message: "Server and database are working",
            db: rows?.[0]?.ok === 1
        });
    } catch (error) {
        console.error("Health check failed:", error);
        return res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/chat", chatRoutes);

app.use((err, req, res, next) => {
    console.error("Global server error:", err);

    return res.status(500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await testDatabaseConnection();

        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Server startup failed:", error);
        process.exit(1);
    }
}

startServer();