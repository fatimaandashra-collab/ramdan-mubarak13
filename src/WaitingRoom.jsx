import React, { useState, useEffect, useRef } from "react";
import { socket } from "./socket";

export default function WaitingRoom({ name, bgRef }) {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [puzzleComponent, setPuzzleComponent] = useState(null);
  
  const joinedRef = useRef(false);
  const hasPlayedMusic = useRef(false);

  // ملفات الصوت
  const joinSound = useRef(new Audio("/sounds/join.mp3"));
  const readySound = useRef(new Audio("/sounds/ready.mp3"));
  const unreadySound = useRef(new Audio("/sounds/unready.mp3"));
  const startSound = useRef(new Audio("/sounds/start.mp3"));

  const bgMusic = bgRef?.current;

  useEffect(() => {
    if (!joinedRef.current) {
      socket.emit("join", name);
      joinedRef.current = true;
      joinSound.current.play().catch(() => {});

      if (!hasPlayedMusic.current && bgMusic) {
        bgMusic.loop = false;
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
        hasPlayedMusic.current = true; 

        bgMusic.onended = () => {
          bgMusic.pause();
          bgMusic.currentTime = 0;
        };
      }
    }

    socket.on("updatePlayers", (list) => {
      setPlayers(list);
    });

    socket.on("startCountdown", (value) => {
      setCountdown(value);
      if (value === 3) {
        if (bgMusic) {
          bgMusic.pause();
          bgMusic.currentTime = 0; 
        }
        startSound.current.currentTime = 0;
        startSound.current.play().catch(() => {});
      }
    });

    socket.on("cancelCountdown", () => {
      setCountdown(null);
    });

    socket.on("gameStarted", async (images) => {
      const mod = await import("./Puzzle.jsx");
      const Puzzle = mod.default;
      setPuzzleComponent(<Puzzle images={images} playerName={name} />);
    });

    socket.on("adminError", (p) => {
      alert(p?.msg || "مش كل اللاعبين جاهزين");
    });

    return () => {
      socket.off("updatePlayers");
      socket.off("startCountdown");
      socket.off("cancelCountdown");
      socket.off("gameStarted");
      socket.off("adminError");
    };
  }, [bgMusic, name]);

  const toggleReady = () => {
    socket.emit("toggleReady");
    if (!ready) readySound.current.play().catch(() => {});
    else unreadySound.current.play().catch(() => {});
    setReady(!ready);
  };

  if (puzzleComponent) return puzzleComponent;

  return (
    <div style={styles.page}>
      {/* تأثير النجوم المتلألئة */}
      <div className="stars"></div>
      
      {/* أيقونات رمضانية طائرة */}
      <div style={styles.lanternLeft}>✨🌙</div>
      <div style={styles.lanternRight}>✨🌙</div>

      <h3 style={styles.username}>👤 {name}</h3>
      
      <div style={styles.headerBox}>
        <h1 style={styles.title}>غرفة الانتظار 🌙</h1>
        <p style={styles.subtitle}>بانتظار تجمع الأبطال لبدء التحدي</p>
      </div>

      {countdown !== null && (
        <div style={styles.countdownContainer}>
          <h1 style={styles.countdownText}>{countdown}</h1>
          <p style={{color: '#fbbf24', fontWeight: 'bold'}}>استعدوا!</p>
        </div>
      )}

      <div style={styles.playersBox}>
        {players.map((p, index) => (
          <div key={p.id} style={{
            ...styles.playerCard,
            border: p.ready ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
            background: p.ready ? "rgba(34, 197, 94, 0.1)" : "rgba(255,255,255,0.05)"
          }}>
            <span style={styles.playerNumber}>{index + 1}</span>
            <div style={styles.playerInfo}>
              <span style={styles.playerName}>{p.name} {p.name === name ? "(أنت)" : ""}</span>
              <span style={{
                ...styles.status,
                color: p.ready ? "#22c55e" : "#ef4444",
              }}>
                {p.ready ? "✓ جاهز الآن" : "⏳ في انتظار الاستعداد"}
              </span>
            </div>
            {p.ready && <span style={{fontSize: 24}}>✨</span>}
          </div>
        ))}
      </div>

      <button
        onClick={toggleReady}
        style={{
          ...styles.readyButton,
          backgroundColor: ready ? "#ef4444" : "#fbbf24",
          color: ready ? "white" : "#1e1b4b",
        }}
      >
        {ready ? "إلغاء الاستعداد ✖" : "أنا جاهز للتحدي! 🌙"}
      </button>

      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        .stars {
          position: absolute; width: 100%; height: 100%; top:0; left:0;
          background: url('https://www.transparenttextures.com/patterns/stardust.png');
          animation: twinkle 4s infinite; pointer-events: none;
        }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: { 
    height: "100vh", width: "100vw", padding: 20, 
    background: "radial-gradient(circle, #1e1b4b 0%, #020617 100%)", 
    color: "white", display: "flex", flexDirection: "column", 
    alignItems: "center", position: "relative", fontFamily: "'Cairo', sans-serif",
    overflowY: 'auto'
  },
  username: { position: "absolute", top: 20, left: 20, fontSize: 16, fontWeight: "bold", color: "#fbbf24", background: 'rgba(251,191,36,0.1)', padding: '5px 15px', borderRadius: 20 },
  headerBox: { textAlign: 'center', marginTop: 40, zIndex: 5 },
  title: { fontSize: 40, fontWeight: "bold", color: "#fbbf24", textShadow: "0 0 15px rgba(251,191,36,0.4)" },
  subtitle: { color: "#cbd5e1", marginTop: 5, fontSize: 16 },
  
  lanternLeft: { position: "absolute", top: "10%", left: "5%", fontSize: "50px", animation: "float 4s infinite ease-in-out" },
  lanternRight: { position: "absolute", top: "15%", right: "5%", fontSize: "50px", animation: "float 5s infinite ease-in-out" },

  countdownContainer: { 
    position: 'absolute', top: '40%', zIndex: 100, textAlign: 'center', 
    background: 'rgba(0,0,0,0.8)', padding: '20px 40px', borderRadius: 30,
    boxShadow: '0 0 30px #fbbf24'
  },
  countdownText: { fontSize: 100, margin: 0, color: '#fbbf24' },

  playersBox: { width: "90%", maxWidth: 600, marginTop: 40, display: "flex", flexDirection: "column", gap: 12, zIndex: 5 },
  playerCard: { 
    backdropFilter: "blur(10px)", padding: "15px 25px", borderRadius: 18, 
    display: "flex", alignItems: "center", transition: "0.3s" 
  },
  playerNumber: { fontSize: 20, marginRight: 20, color: "#fbbf24", fontWeight: "bold", width: 30 },
  playerInfo: { display: "flex", flexDirection: "column", flex: 1 },
  playerName: { fontSize: 18, fontWeight: "bold", color: "#f8fafc" },
  status: { fontSize: 14, marginTop: 4, fontWeight: "600" },
  
  readyButton: { 
    marginTop: 40, marginBottom: 40, padding: "18px 50px", fontSize: 20, 
    borderRadius: 50, border: "none", cursor: "pointer", fontWeight: "bold", 
    zIndex: 5, boxShadow: "0 10px 25px rgba(0,0,0,0.3)", transition: "0.2s active" 
  },
};