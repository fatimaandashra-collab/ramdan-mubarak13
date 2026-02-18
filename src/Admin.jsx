// src/Admin.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { socket } from "./socket";
import Puzzle from "./Puzzle";

export default function Admin({ logout }) {
  const [mode, setMode] = useState("image"); // 'image' or 'quiz'
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duration, setDuration] = useState(3);
  const [answer, setAnswer] = useState("");
  
  // خاص بالأسئلة النصية
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  
  const [startedImages, setStartedImages] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetchList();
    socket.on("gameStarted", (images) => setStartedImages(images));
    socket.on("adminError", (p) => alert(p?.msg || "مش كل اللاعبين مستعدين"));
    return () => {
      socket.off("adminError");
      socket.off("gameStarted");
    };
  }, []);

  const fetchList = async () => {
    try {
      const r = await axios.get("https://asset-manager--bdallahashrf110.replit.app/images");
      setSavedList(r.data || []);
    } catch (e) { console.error(e); }
  };

  const handleOptionChange = (index, val) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
  };

  const doUpload = async () => {
    if (mode === "image" && !file) return alert("اختار صورة أولاً");
    if (mode === "quiz" && !questionText) return alert("اكتب السؤال أولاً");
    if (!answer.trim()) return alert("لازم تحدد الإجابة الصحيحة");

    setSaving(true);
    try {
      let payload = {
        type: mode,
        duration,
        answer: answer.trim(),
      };

      if (mode === "image") {
        const fd = new FormData();
        fd.append("image", file);
        const r = await axios.post("https://asset-manager--bdallahashrf110.replit.app/upload", fd);
        payload.filename = r.data.filename;
        payload.originalname = r.data.originalname;
      } else {
        payload.question = questionText;
        payload.options = options;
      }

      await axios.post("https://asset-manager--bdallahashrf110.replit.app/save-image", payload);
      
      alert("تمت الإضافة بنجاح! ✨");
      resetForm();
      fetchList();
    } catch (e) {
      alert("خطأ: " + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFile(null);
    setPreviewUrl(null);
    setAnswer("");
    setQuestionText("");
    setOptions(["", "", "", ""]);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (startedImages) return <Puzzle images={startedImages} playerName="Admin" />;

  return (
    <div style={styles.full}>
      <div className="stars-admin"></div>
      <div style={styles.centerBox}>
        <div style={styles.header}>
          <h2 style={{ color: "#fbbf24" }}>لوحة تحكم المسابقة 🌙</h2>
          <div style={styles.modeSwitcher}>
            <button onClick={() => setMode("image")} style={{...styles.modeBtn, background: mode === "image" ? "#fbbf24" : "transparent", color: mode === "image" ? "#1e1b4b" : "#fff"}}>صورة 🖼️</button>
            <button onClick={() => setMode("quiz")} style={{...styles.modeBtn, background: mode === "quiz" ? "#fbbf24" : "transparent", color: mode === "quiz" ? "#1e1b4b" : "#fff"}}>سؤال اختياري 📝</button>
          </div>
        </div>

        <div style={styles.bigBox}>
          {/* الجانب الأيسر: المعاينة أو إدخال السؤال */}
          <div style={styles.previewBox}>
            {mode === "image" ? (
              previewUrl ? <img src={previewUrl} style={styles.previewImg} /> : <div style={{color: "#aaa"}}>معاينة الصورة</div>
            ) : (
              <div style={{width: '100%', padding: 20}}>
                <textarea 
                  value={questionText} 
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="اكتب السؤال هنا..." 
                  style={styles.textArea}
                />
                <div style={styles.optionsGrid}>
                  {options.map((opt, i) => (
                    <input key={i} value={opt} onChange={(e) => handleOptionChange(i, e.target.value)} placeholder={`اختيار ${i+1}`} style={styles.optInput} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* الجانب الأيمن: التحكم */}
          <div style={styles.controls}>
            {mode === "image" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>اختيار صورة:</label>
                <input ref={fileRef} type="file" onChange={(e) => {
                  const f = e.target.files[0];
                  setFile(f);
                  setPreviewUrl(URL.createObjectURL(f));
                }} style={{color: "#fff"}} />
              </div>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>الإجابة الصحيحة:</label>
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="اكتب الحل هنا..." style={styles.textInput} />
              <small style={{color: "#aaa", fontSize: 11}}>* في حالة السؤال، اكتب النص المطابق لأحد الاختيارات تماماً</small>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>الوقت (دقائق):</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={styles.select}>
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <button onClick={doUpload} disabled={saving} style={styles.saveBtn}>
              {saving ? "جارٍ الحفظ..." : "إضافة إلى القائمة ✨"}
            </button>
          </div>
        </div>

        <div style={styles.footerAction}>
          <button onClick={() => socket.emit("adminTriggerStart")} style={styles.startBtn}>إطلاق المسابقة لجميع اللاعبين 🚀</button>
          <button onClick={logout} style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', marginLeft: 20}}>تسجيل خروج</button>
        </div>

        <div style={styles.listContainer}>
          <h4 style={{color: "#fbbf24"}}>المحتوى المضاف ({savedList.length})</h4>
          <div style={styles.scrollList}>
            {savedList.map((s, i) => (
              <div key={i} style={styles.listItem}>
                <span>{s.type === "quiz" ? "📝 سؤال" : "🖼️ صورة"}: {s.question || s.originalname}</span>
                <span style={{color: "#fbbf24"}}>{s.answer}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`.stars-admin { position: absolute; width: 100%; height: 100%; top:0; left:0; background: url('https://www.transparenttextures.com/patterns/stardust.png'); opacity: 0.4; pointer-events: none; }`}</style>
    </div>
  );
}

const styles = {
  full: { height: "100vh", width: "100vw", background: "radial-gradient(circle, #1e1b4b 0%, #020617 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cairo', sans-serif", position: "relative", overflow: "hidden" },
  centerBox: { width: "95%", maxWidth: 1000, zIndex: 10, background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(15px)", padding: 30, borderRadius: 24, border: "1px solid rgba(251, 191, 36, 0.2)", color: "white" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modeSwitcher: { display: "flex", background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 5 },
  modeBtn: { border: "none", padding: "8px 15px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", transition: "0.3s" },
  bigBox: { display: "flex", gap: 20, flexWrap: "wrap" },
  previewBox: { flex: 1.5, minWidth: 350, minHeight: 300, background: "rgba(0,0,0,0.3)", borderRadius: 15, border: "1px solid rgba(251, 191, 36, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  previewImg: { maxWidth: "100%", maxHeight: "300px", objectFit: "contain" },
  textArea: { width: "100%", height: 80, borderRadius: 10, padding: 10, marginBottom: 15, border: "none", fontSize: 16 },
  optionsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  optInput: { padding: 8, borderRadius: 5, border: "none", background: "rgba(255,255,255,0.9)" },
  controls: { flex: 1, display: "flex", flexDirection: "column", gap: 15 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, color: "#fbbf24" },
  textInput: { padding: 12, borderRadius: 8, border: "none", fontSize: 16 },
  select: { padding: 10, borderRadius: 8, background: "#fff" },
  saveBtn: { background: "#fbbf24", color: "#1e1b4b", border: "none", padding: "14px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" },
  footerAction: { marginTop: 20, textAlign: "center" },
  startBtn: { background: "#16a34a", color: "white", border: "none", padding: "12px 30px", borderRadius: 50, cursor: "pointer", fontWeight: "bold", fontSize: 17 },
  listContainer: { marginTop: 20 },
  scrollList: { maxHeight: 120, overflowY: "auto" },
  listItem: { display: "flex", justifyContent: "space-between", padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 5, fontSize: 13 }
};