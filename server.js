const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// التأكد من وجود مجلد الرفع
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
    console.log("Created uploads directory");
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
        const name = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
        cb(null, name);
    },
});
const upload = multer({ storage });
app.use("/uploads", express.static(UPLOAD_DIR));

// Game State
let savedChallenges = []; // تشمل الصور والأسئلة النصية
let players = [];
let questionProgress = {}; 
let countdownTimer = null;
let countdownValue = 3;
let hints = {}; 

const emitPlayers = () => io.emit("updatePlayers", players);

const emitScores = (targetSocketId = null) => {
    const sorted = [...players]
        .sort((a, b) => b.score - a.score)
        .map(p => ({ name: p.name, score: p.score }));

    const data = {
        scores: sorted,
        leader: sorted[0]?.name || null
    };

    if (targetSocketId) {
        io.to(targetSocketId).emit("updateScores", data);
    } else {
        io.emit("updateScores", data);
    }
};

const allReady = () => players.length > 0 && players.every(p => p.ready);

const startCountdown = () => {
    if (countdownTimer) return;
    countdownValue = 3;
    io.emit("startCountdown", countdownValue);
    countdownTimer = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            io.emit("startCountdown", countdownValue);
        } else {
            clearInterval(countdownTimer);
            countdownTimer = null;
            io.emit("startCountdown", 0);
            io.emit("gameStarted", savedChallenges);
            
            // تصفير البيانات للدورة القادمة
            setTimeout(() => {
                savedChallenges = []; 
                hints = {}; // تصفير التلميحات أيضاً عند البدء
                console.log("تم تنظيف البيانات استعداداً للدورة القادمة");
            }, 2000); 
        }
    }, 1000);
};

const cancelCountdown = () => {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        io.emit("cancelCountdown");
    }
};

io.on("connection", (socket) => {
    socket.on("join", (name) => {
        if (players.find(p => p.id === socket.id)) return;
        players.push({ id: socket.id, name: name, ready: false, score: 0 });
        emitPlayers();
    });

    socket.on("requestScores", () => {
        emitScores(socket.id);
    });

    socket.on("toggleReady", () => {
        const p = players.find(x => x.id === socket.id);
        if (!p) return;
        p.ready = !p.ready;
        emitPlayers();
        if (!p.ready) cancelCountdown();
    });

    socket.on("adminTriggerStart", () => {
        if (!allReady()) return socket.emit("adminError", { msg: "مش كل اللاعبين جاهزين" });
        questionProgress = {}; 
        startCountdown();
    });

    socket.on("sendHint", ({ index, text }) => {
        hints[index] = text; 
        io.emit("receiveHint", { index, text });
    });

    socket.on("requestHint", (index) => {
        if (hints[index]) {
            socket.emit("receiveHint", { index, text: hints[index] });
        }
    });

    socket.on("checkSkipStatus", ({ index }) => {
        if (questionProgress[index] && questionProgress[index].answered) {
            socket.emit("globalSkipEnable", { index });
        }
    });

    socket.on("playerAnswer", ({ isCorrect, index }) => {
        const p = players.find(x => x.id === socket.id);
        if (!p || !isCorrect) return;

        if (!questionProgress[index]) {
            questionProgress[index] = { answered: true, winners: [socket.id] };
            p.score += 2;
            io.emit("globalSkipEnable", { index });
        } else {
            if (!questionProgress[index].winners.includes(socket.id)) {
                questionProgress[index].winners.push(socket.id);
                p.score += 1;
            }
        }
        emitScores();
    });

    socket.on("disconnect", () => {
        if (countdownTimer === null) {
            // تصفير لو لسه اللعبة مبدأتش والكل خرج
            if (players.length <= 1) savedChallenges = [];
        }
        players = players.filter(p => p.id !== socket.id);
        emitPlayers();
        cancelCountdown();
    });



    
});

// استقبال الصورة
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

// حفظ التحدي (سواء صورة أو سؤال نصي)
app.post("/save-image", (req, res) => {
    const { type, filename, duration, answer, question, options } = req.body;
    
    let challengeData = {
        type: type || "image",
        duration: Number(duration || 1),
        answer: answer || "",
    };

    if (challengeData.type === "image") {
        challengeData.url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
        challengeData.filename = filename;
    } else {
        challengeData.question = question;
        challengeData.options = options; // مصفوفة الـ 4 اختيارات
    }

    savedChallenges.push(challengeData);
    res.json({ ok: true });
});

app.get("/images", (_, res) => res.json(savedChallenges));

const PORT = process.env.PORT || 5000; 
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});