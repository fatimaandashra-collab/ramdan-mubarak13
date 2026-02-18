import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const encouragementNames = [
  "أسطوري", "خارق", "مميز", "مذهل", "رائع", "فريد", "لا يُقهر",
  "ممتاز", "رائع جدًا", "فائق", "مبهر", "مذهل", "متألق",
  "ممتاز جدًا", "لا يُضاهى", "بطل", "ممتاز للغاية",
  "متفوق", "خارق", "مذهل جدًا", "عبقري", "أسطوري جدًا"





  









  
];

const socket = io("https://asset-manager--bdallahashrf110.replit.app");

// مكون الخلفية الرمضانية الجديد
const RamadanWrapper = ({ children }) => (
  <div style={styles.container}>
    {/* خلفية النجوم المتلألئة */}
    <div className="stars"></div>
    
    {/* هلال ذهبي متوهج في الزاوية */}
    <div className="royal-moon">🌙</div>
    
    {/* نجوم متحركة في أركان الشاشة */}
    <div className="star-top-right">✨</div>
    <div className="star-bottom-left">✨</div>

    <div style={styles.glassCard}>
      {children}
    </div>

    <style>{`
      @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
      @keyframes moonFloat { 0%, 100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 0 10px #fbbf24); } 50% { transform: translateY(-20px) rotate(5deg); filter: drop-shadow(0 0 30px #fbbf24); } }
      
      .stars { position: absolute; inset: 0; background: url('https://www.transparenttextures.com/patterns/stardust.png'); opacity: 0.5; }
      .royal-moon { position: absolute; top: 5%; left: 5%; font-size: 80px; animation: moonFloat 5s infinite ease-in-out; z-index: 1; }
      .star-top-right { position: absolute; top: 10%; right: 10%; font-size: 40px; animation: twinkle 3s infinite; }
      .star-bottom-left { position: absolute; bottom: 10%; left: 10%; font-size: 30px; animation: twinkle 4s infinite; }
      
      /* إطار ذهبي متحرك للكارت */
      .glass-card-border { border: 2px solid #fbbf24; box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); }
    `}</style>
  </div>
);
export default function Puzzle({ images = [], playerName = "Player" }) {
  const [gameImages, setGameImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [currentHint, setCurrentHint] = useState("");
  const isAdminView = playerName === "Admin";
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("neutral");
  const [time, setTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [scores, setScores] = useState([]);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [finalResults, setFinalResults] = useState(false);
  const [skipAvailable, setSkipAvailable] = useState(false);
  const [leader, setLeader] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const timerRef = useRef(null);
  const readySound = useRef(new Audio("/sounds/ready.mp3"));
  const unreadySound = useRef(new Audio("/sounds/unready.mp3"));
  const audioCtx = useRef(null);

  const playTick = () => {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.type = "square"; osc.frequency.value = 900; gain.gain.value = 0.05;
    osc.connect(gain); gain.connect(audioCtx.current.destination);
    osc.start(); osc.stop(audioCtx.current.currentTime + 0.1);
  };

  const imgs = gameImages.length ? gameImages : images;
  const img = imgs[index];

  useEffect(() => {
    socket.emit("join", playerName);
    socket.on("updateScores", (data) => {
      if (isFinished) return;
      if (!showResults && !showEncouragement && !finalResults) {
        setScores(data.scores);
        setLeader(data.leader);
      }
    });
    socket.on("globalSkipEnable", (data) => {
      if (isFinished) return;
      if (data.index === index) setSkipAvailable(true);
    });
    return () => {
      socket.off("updateScores");
      socket.off("globalSkipEnable");
    };
  }, [index, showResults, finalResults, showEncouragement, isFinished]);

  useEffect(() => {
    if (!img || isFinished) return;
    setCurrentHint("");
    socket.emit("requestHint", index);
    socket.on("receiveHint", (data) => {
      if (data.index === index) setCurrentHint(data.text);
    });
    setAnswer("");
    setStatus("neutral");
    setTime(img.duration * 60);
    setShowResults(false);
    setSkipAvailable(false);
    socket.emit("checkSkipStatus", { index });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => {
        if (t <= 1) { clearInterval(timerRef.current); skip(); return 0; }
        if (t <= 3 && !isFinished) playTick();
        return t - 1;
      });
    }, 1000);
    return () => {
      socket.off("receiveHint");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index, img, isFinished]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const submit = () => {
    const isCorrect = answer.trim().toLowerCase() === img.answer.toLowerCase();
    socket.emit("playerAnswer", { isCorrect, index });
    setStatus(isCorrect ? "correct" : "wrong");
    isCorrect ? readySound.current.play().catch(() => {}) : unreadySound.current.play().catch(() => {});
  };

  const skip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    socket.emit("requestScores");
    setSkipAvailable(false);
    if (index + 1 >= imgs.length) {
      setIsFinished(true);
      if (leader === playerName) setShowEncouragement(true);
      else { setShowResults(true); setFinalResults(true); }
    } else {
      setShowResults(true);
      setFinalResults(false);
    }
  };

  const nextQuestion = () => {
    if (index + 1 >= imgs.length) { setShowResults(true); setFinalResults(true); return; }
    setShowResults(false); setFinalResults(false); setIndex(i => i + 1);
  };

  const refreshScores = () => {
    socket.emit("requestScores");
    socket.once("updateScores", (data) => setScores(data.scores));
  };

  if (!imgs.length) return <RamadanWrapper><div style={{ color: "white", fontSize: 24 }}>في انتظار بدء اللعبة... 🌙</div></RamadanWrapper>;

  // شاشة التهنئة للفائز
  if (showEncouragement) {
    return (
      <RamadanWrapper>
        <div style={styles.resultsCard}>
          <button style={styles.next} onClick={() => { setShowEncouragement(false); setFinalResults(true); setShowResults(true); }}>Skip</button>
          <h2 style={{ color: "#fbbf24" }}>🎉 ألف مبروك يا بطل! 🎉</h2>
          <h2 style={{ marginBottom: 20 }}>{playerName} — {scores.find(p=>p.name===playerName)?.score || 0} ⭐</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", fontSize: 18, color: "#fff" }}>
            {encouragementNames.map((n, i) => (<span key={i} style={styles.badge}>{n}</span>))}
          </div>
        </div>
      </RamadanWrapper>
    );
  }

  // شاشة النتائج النهائية
  if (showResults || finalResults) {
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <RamadanWrapper>
        <div style={styles.resultsCard}>
          {!finalResults && (<div style={styles.arrow} onClick={nextQuestion}>⬅️ السؤال التالي</div>)}
          <h2 style={{ color: "#fbbf24", marginBottom: 20 }}>📊 ترتيب الأبطال</h2>
          <ul style={{ width: "100%", padding: 0 }}>
            {scores.filter(p => p.score > 0).map((p, i) => (
              <li key={p.name} style={styles.scoreItem}>
                <span style={{color: '#1e1b4b'}}>{medals[i] || ""} {p.name}</span>
                <strong style={{color: '#1e1b4b'}}>{p.score} نقطة</strong>
              </li>
            ))}
          </ul>
          {finalResults && (
            <div style={{marginTop: 20}}>
              <button onClick={refreshScores} style={styles.refreshBtn}>🔄 تحديث النهائي</button>
              <h3 style={{color: "#fbbf24", marginTop: 20}}>رمضان كريم وكل عام وأنتم بخير 🌙</h3>
              <p style={{opacity: 0.8}}>مع تحيات الأدمن وكل فريق العمل</p>
            </div>
          )}
        </div>
      </RamadanWrapper>
    );
  }

  return (
    <RamadanWrapper>
      <div style={styles.card}>
        <div style={styles.imageBox}>
          <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={styles.side}>
          <div style={styles.timer}>⏰ {formatTime(time)}</div>
          
          {isAdminView && (
            <div style={styles.adminPanel}>
              <input id="hintInput" placeholder="اكتب تلميحاً..." style={styles.adminInput} />
              <button onClick={() => {
                const val = document.getElementById('hintInput').value;
                if(val) socket.emit("sendHint", { index, text: val });
                document.getElementById('hintInput').value = "";
              }} style={styles.adminBtn}>إرسال 💡</button>
            </div>
          )}

          {currentHint && <div style={styles.hintBox}>💡 تلميح: {currentHint}</div>}

          <input 
            value={answer} 
            onChange={e => setAnswer(e.target.value)} 
            placeholder="اكتب الإجابة هنا..." 
            style={{ ...styles.input, background: status === "correct" ? "#22c55e" : status === "wrong" ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#fff" }} 
          />

          {!isAdminView && <button onClick={submit} style={styles.submit}>إرسال الإجابة ✅</button>}
          {skipAvailable && (<button onClick={skip} style={styles.next}>تخطي السؤال ⏭️</button>)}
        </div>
      </div>
    </RamadanWrapper>
  );
}

const styles = {
  ramadanContainer: {
    height: "100vh", width: "100vw",
    background: "radial-gradient(circle, #1e1b4b 0%, #020617 100%)",
    display: "flex", justifyContent: "center", alignItems: "center",
    position: "relative", overflow: "hidden", fontFamily: 'Cairo, sans-serif'
  },
  contentWrapper: { zIndex: 10, width: "100%", display: "flex", justifyContent: "center" },
  crescentLeft: { position: "absolute", top: "40px", left: "40px", fontSize: "70px", filter: "drop-shadow(0 0 15px #fbbf24)", animation: "float 4s infinite" },
  lanternRight: { position: "absolute", top: "40px", right: "60px", fontSize: "60px", filter: "drop-shadow(0 0 15px #fbbf24)", animation: "float 5s infinite" },
  crescentRight: { position: "absolute", bottom: "40px", right: "40px", fontSize: "70px", transform: "rotate(-20deg)", opacity: 0.5 },
  card: { 
    width: "90%", height: "80%", background: "rgba(255, 255, 255, 0.05)", 
    backdropFilter: "blur(15px)", borderRadius: 24, display: "flex", gap: 30, padding: 30, 
    border: "1px solid rgba(251, 191, 36, 0.3)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" 
  },
  imageBox: { flex: 2, background: "rgba(0,0,0,0.2)", borderRadius: 15, padding: 10 },
  side: { flex: 1, display: "flex", flexDirection: "column", gap: 20, justifyContent: "center", color: "white" },
  timer: { fontSize: 35, fontWeight: "bold", textAlign: "center", color: "#fbbf24", textShadow: "0 0 10px rgba(251,191,36,0.5)" },
  input: { padding: 15, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", fontSize: 20, textAlign: "center", outline: "none" },
  submit: { padding: 15, background: "#fbbf24", color: "#1e1b4b", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: "bold", fontSize: 18 },
  next: { padding: 12, background: "#16a34a", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" },
  resultsCard: { 
    width: "60%", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", 
    borderRadius: 24, padding: 40, textAlign: "center", color: "white",
    border: "1px solid rgba(251, 191, 36, 0.4)"
  },




  scoreItem: { listStyle: "none", padding: 15, marginBottom: 12, background: "#fff", borderRadius: 12, display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: "bold" },
  hintBox: { background: "rgba(251, 191, 36, 0.2)", color: "#fbbf24", padding: 15, borderRadius: 12, border: "1px dashed #fbbf24", textAlign: "center", fontSize: 18 },
  adminPanel: { display: 'flex', gap: 10, background: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  adminInput: { flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#fff' },
  adminBtn: { background: '#f59e0b', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 8, cursor: 'pointer' },
  refreshBtn: { padding: '10px 25px', background: '#fbbf24', color: '#1e1b4b', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer' },
  badge: { background: 'rgba(251, 191, 36, 0.1)', padding: '5px 12px', borderRadius: 20, border: '1px solid #fbbf24', fontSize: 14 },
  arrow: { cursor: 'pointer', color: '#fbbf24', fontSize: 20, marginBottom: 15 }
};