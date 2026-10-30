/* ==========================================================================
   من أكثر واحد؟!  —  ألعاب جماعية أونلاين لحظية
   Firebase Firestore (onSnapshot) + Vercel

   هيكل البيانات:
   rooms/{CODE}                    -> حالة الغرفة واللعبة
   rooms/{CODE}/players/{playerId} -> اللاعبين
   rooms/{CODE}/votes/{round_playerId} -> الأصوات (صوت واحد لكل لاعب في كل جولة)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, onSnapshot, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ---------------------------- إعدادات Firebase ---------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDbV-kOrhPqZ031qbQkLxbPnv9YUCF4nvQ",
  authDomain: "party-game-b85f0.firebaseapp.com",
  projectId: "party-game-b85f0",
  storageBucket: "party-game-b85f0.firebasestorage.app",
  messagingSenderId: "534887387963",
  appId: "1:534887387963:web:404ad144effbefb2001d1e",
  measurementId: "G-0NJ1KH83S2"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------------------- الإعدادات ------------------------------- */
const MAX_PLAYERS = 12;
const MIN_PLAYERS = 2;
const ROUNDS = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون أحرف متشابهة (O/0 و I/1)

const QUESTIONS = [
  "من أكثر واحد يتأخر عن المواعيد؟",
  "من أكثر واحد ينسى؟",
  "من أكثر واحد ينام في أي مكان؟",
  "من أكثر واحد يضيّع أغراضه؟",
  "من أكثر واحد يسولف بدون توقف؟",
  "من أكثر واحد يصرف فلوسه على أشياء ما يحتاجها؟",
  "من أكثر واحد يكذب كذبة بيضاء؟",
  "من أكثر واحد يتأخر في الرد على الرسائل؟",
  "من أكثر واحد يسوق بسرعة؟",
  "من أكثر واحد يضحك على أي شي؟",
  "من أكثر واحد يطلب أكل من برا كل يوم؟",
  "من أكثر واحد بيصير مشهور؟",
  "من أكثر واحد يحب النوم؟",
  "من أكثر واحد يعطيك نصيحة وهو أول من يخالفها؟",
  "من أكثر واحد يتحمّس لفكرة ويتركها بعد يومين؟",
  "من أكثر واحد عنده جواله مليان تطبيقات ما يستخدمها؟",
  "من أكثر واحد يستحي؟",
  "من أكثر واحد يتعصب بسرعة؟",
  "من أكثر واحد يقدر يعيش على القهوة؟",
  "من أكثر واحد يسهر للفجر؟",
  "من أكثر واحد ما يعرف يخبي سر؟",
  "من أكثر واحد يتأنق في لبسه؟",
  "من أكثر واحد يضيع في الطريق حتى مع الخريطة؟",
  "من أكثر واحد ما يغيّر رأيه أبداً؟",
  "من أكثر واحد يصوّر كل شي ويرفعه ستوري؟",
  "من أكثر واحد يخاف من الحشرات؟",
  "من أكثر واحد يقدر يفوز بمسابقة أكل؟",
  "من أكثر واحد يصير مضحك لما يتوتر؟",
  "من أكثر واحد يعتمدون عليه وقت الشدة؟",
  "من أكثر واحد يقول «أنا جاي» وهو للحين في البيت؟",
  "من أكثر واحد يشتري أغراض بس عشان العرض؟",
  "من أكثر واحد يتأخر في دفع حسابه؟",
  "من أكثر واحد لو دخل سباق طبخ يحرق الأكل؟",
  "من أكثر واحد يعرف كل أخبار الناس؟",
  "من أكثر واحد يفتح الثلاجة كل خمس دقايق؟",
  "من أكثر واحد يتغيّر مزاجه فجأة؟",
  "من أكثر واحد يقدر يكمل يوم كامل بدون جواله؟",
  "من أكثر واحد يحب يقود الشلة؟",
  "من أكثر واحد يعلّق على كل شي؟",
  "من أكثر واحد لو انحبس في مصعد بيهدّي الباقين؟"
];

/* -------------------------------- أدوات ---------------------------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Number(n).toLocaleString("ar-EG");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* ignore */ } };

const GRADS = [
  "from-violet-500 to-fuchsia-500", "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500",
  "from-orange-500 to-rose-500", "from-pink-500 to-purple-500", "from-amber-500 to-orange-500",
  "from-cyan-500 to-blue-500", "from-lime-500 to-green-500", "from-rose-500 to-red-500",
  "from-fuchsia-500 to-pink-500", "from-teal-500 to-cyan-500", "from-indigo-500 to-violet-500"
];
const gradOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return GRADS[h % GRADS.length]; };
const avatar = (p, size = "w-12 h-12 text-xl") =>
  `<span class="inline-grid place-items-center shrink-0 rounded-full bg-gradient-to-br ${gradOf(p.id)} text-white font-black shadow-md ${size}">${esc(Array.from(p.name)[0] || "؟")}</span>`;

/* ------------------------------- الحالة ---------------------------------- */
let playerId = store.get("pg_pid");
if (!playerId) { playerId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 20); store.set("pg_pid", playerId); }

const state = {
  code: null,
  room: null,
  players: [],
  votes: [],
  gotPlayers: false,
  gotRoom: false,
  unsubs: [],
  viewKey: "",
  advancing: ""
};
const me = () => ({ id: playerId, name: store.get("pg_name", "") });
const isHost = () => !!state.room && state.room.hostId === playerId;
const roomRef = (code = state.code) => doc(db, "rooms", code);
const playerRef = (code = state.code, id = playerId) => doc(db, "rooms", code, "players", id);
const voteRef = (round, id = playerId) => doc(db, "rooms", state.code, "votes", `${round}_${id}`);

/* ------------------------------ الواجهة --------------------------------- */
const VIEWS = ["home", "lobby", "game", "results", "final"];
let currentView = "";
function showView(name) {
  if (currentView === name) return;
  currentView = name;
  VIEWS.forEach((v) => $(`view-${v}`).classList.toggle("hidden", v !== name));
  const el = $(`view-${name}`);
  el.classList.remove("view-enter"); void el.offsetWidth; el.classList.add("view-enter");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg, type = "info") {
  const el = document.createElement("div");
  const color = type === "error" ? "bg-rose-600 text-white" : type === "ok" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
  el.className = `toast pointer-events-auto px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-center ${color}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 3200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    t.remove(); return ok;
  }
}

function confetti(n = 40) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#8b5cf6", "#d946ef", "#f97316", "#facc15", "#22c55e", "#38bdf8"];
  for (let i = 0; i < n; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    c.style.animationDelay = Math.random() * 0.5 + "s";
    c.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } finally { btn.disabled = false; }
}

function explain(err) {
  console.error(err);
  const c = err && err.code;
  if (c === "permission-denied") return "ما عندك صلاحية: عدّل قواعد Firestore (Rules) من لوحة Firebase.";
  if (c === "unavailable") return "ما فيه اتصال بالإنترنت، جرّب مرة ثانية.";
  if (err && err.userMessage) return err.userMessage;
  return "صار خطأ غير متوقع، جرّب مرة ثانية.";
}
const userError = (m) => Object.assign(new Error(m), { userMessage: m });

/* ------------------------------ الثيم (ليلي) ------------------------------ */
function applyTheme(t) {
  document.documentElement.classList.toggle("dark", t === "dark");
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "dark" ? "#0b0b17" : "#f5f3ff");
  store.set("pg_theme", t);
}
$("btn-theme").addEventListener("click", () => {
  applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  vibrate(10);
});

/* ---------------------------- الشاشة الرئيسية ---------------------------- */
function homeError(msg) {
  const el = $("home-error");
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function readName() {
  const name = $("inp-name").value.replace(/\s+/g, " ").trim();
  if (name.length < 2) { homeError("اكتب اسمك (حرفين على الأقل)."); $("inp-name").focus(); return null; }
  homeError("");
  store.set("pg_name", name);
  return name;
}

function makeCode() {
  let c = "";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (const n of buf) c += CODE_ALPHABET[n % CODE_ALPHABET.length];
  return c;
}

async function createRoom() {
  const name = readName(); if (!name) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef(code));
        if (snap.exists()) throw Object.assign(new Error("exists"), { exists: true });
        tx.set(roomRef(code), { code, hostId: playerId, status: "lobby", round: 0, totalRounds: 0, questions: [], createdAt: Date.now() });
        tx.set(playerRef(code), { name, joinedAt: Date.now() });
      });
      enterRoom(code);
      toast("تم إنشاء الغرفة 🎉 شارك الرمز مع أصحابك", "ok");
      return;
    } catch (e) {
      if (e.exists) continue;
      throw e;
    }
  }
  throw userError("ما قدرنا ننشئ غرفة، جرّب مرة ثانية.");
}

async function joinRoom() {
  const name = readName(); if (!name) return;
  const code = $("inp-code").value.trim().toUpperCase();
  if (code.length !== 4) { homeError("رمز الغرفة مكوّن من ٤ خانات."); $("inp-code").focus(); return; }
  homeError("");

  const rs = await getDoc(roomRef(code));
  if (!rs.exists()) throw userError("ما لقينا غرفة بهالرمز، تأكد منه.");
  const room = rs.data();

  const ps = await getDocs(collection(db, "rooms", code, "players"));
  const list = ps.docs.map((d) => ({ id: d.id, ...d.data() }));
  const already = list.some((p) => p.id === playerId);
  if (!already) {
    if (room.status !== "lobby") throw userError("اللعبة بدأت بالفعل، انتظر الجولة الجاية.");
    if (list.length >= MAX_PLAYERS) throw userError("الغرفة ممتلئة (" + num(MAX_PLAYERS) + " لاعبين).");
    if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw userError("الاسم مستخدم في الغرفة، اختر اسم ثاني.");
  }
  await setDoc(playerRef(code), { name, joinedAt: already ? (list.find((p) => p.id === playerId).joinedAt) : Date.now() }, { merge: true });
  enterRoom(code);
  toast("انضممت للغرفة 👋", "ok");
}

/* ------------------------- الاشتراك اللحظي (onSnapshot) ------------------------- */
function enterRoom(code) {
  stopListening();
  state.code = code;
  state.room = null; state.players = []; state.votes = [];
  state.gotPlayers = false; state.gotRoom = false; state.viewKey = ""; state.advancing = "";
  store.set("pg_room", code);

  const onErr = (e) => { toast(explain(e), "error"); };

  state.unsubs.push(onSnapshot(roomRef(code), (snap) => {
    if (!snap.exists()) {
      if (state.gotRoom || !snap.metadata.fromCache) { toast("أُغلقت الغرفة", "error"); resetLocal(); }
      return;
    }
    state.room = snap.data(); state.gotRoom = true; onData();
  }, onErr));

  state.unsubs.push(onSnapshot(collection(db, "rooms", code, "players"), (snap) => {
    if (snap.metadata.fromCache && snap.empty) return;
    state.players = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.joinedAt - b.joinedAt);
    state.gotPlayers = true; onData();
  }, onErr));

  state.unsubs.push(onSnapshot(collection(db, "rooms", code, "votes"), (snap) => {
    state.votes = snap.docs.map((d) => d.data());
    onData();
  }, onErr));
}

function stopListening() {
  state.unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
  state.unsubs = [];
}

function resetLocal() {
  stopListening();
  state.code = null; state.room = null; state.players = []; state.votes = [];
  state.gotPlayers = false; state.gotRoom = false; state.viewKey = "";
  store.del("pg_room");
  $("chip-room").classList.add("hidden"); $("chip-room").classList.remove("inline-flex");
  history.replaceState(null, "", location.pathname);
  showView("home");
}

function onData() {
  const { room, players } = state;
  if (!room || !state.gotPlayers) return;

  // أُزيل اللاعب من الغرفة
  if (!players.some((p) => p.id === playerId)) {
    toast("تمت إزالتك من الغرفة", "error"); resetLocal(); return;
  }
  // إذا غاب المسؤول (غادر)، أول لاعب يصير مسؤول
  if (!players.some((p) => p.id === room.hostId) && players[0].id === playerId) {
    updateDoc(roomRef(), { hostId: playerId }).catch(() => {});
  }

  $("chip-room").classList.remove("hidden"); $("chip-room").classList.add("inline-flex");
  $("chip-code").textContent = state.code;
  if (room.status !== "question") state.advancing = "";

  switch (room.status) {
    case "question": renderGame(); break;
    case "results": renderResults(); break;
    case "finished": renderFinal(); break;
    default: renderLobby();
  }
  maybeAdvance();
}

/* ------------------------------- غرفة الانتظار ------------------------------- */
function renderLobby() {
  showView("lobby");
  const { players, room } = state;
  $("lobby-code").textContent = state.code;
  $("lobby-count").textContent = num(players.length);

  const key = "l:" + players.map((p) => p.id + p.name).join("|") + "|" + room.hostId;
  if (key !== state.viewKey) {
    state.viewKey = key;
    $("lobby-players").innerHTML = players.map((p) => `
      <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-100 dark:bg-black/25 ${p.id === playerId ? "ring-2 ring-violet-500/70" : ""}">
        ${avatar(p)}
        <div class="min-w-0">
          <div class="font-black truncate">${esc(p.name)}</div>
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400">${p.id === room.hostId ? "👑 المسؤول" : p.id === playerId ? "أنت" : "لاعب"}</div>
        </div>
      </div>`).join("");
  }

  const host = isHost();
  $("lobby-host-box").classList.toggle("hidden", !host);
  $("lobby-wait-box").classList.toggle("hidden", host);
  if (host) {
    const enough = players.length >= MIN_PLAYERS;
    $("btn-start").disabled = !enough;
    $("lobby-hint").textContent = enough ? `جاهزين؟ ${num(ROUNDS)} جولات من الأسئلة العشوائية.` : `تحتاج ${num(MIN_PLAYERS)} لاعبين على الأقل، شارك الرمز مع أصحابك.`;
  } else {
    const h = players.find((p) => p.id === room.hostId);
    $("lobby-host-name").textContent = h ? h.name : "المسؤول";
  }
}

async function startGame() {
  if (!isHost() || state.players.length < MIN_PLAYERS) return;
  const questions = shuffle(QUESTIONS).slice(0, ROUNDS);
  await updateDoc(roomRef(), { status: "question", round: 0, totalRounds: questions.length, questions, startedAt: Date.now() });
  vibrate(30);
}

/* ---------------------------------- التصويت ---------------------------------- */
const votesOfRound = (round) => state.votes.filter((v) => v.round === round);
const myVote = () => votesOfRound(state.room.round).find((v) => v.voterId === playerId);

function renderGame() {
  showView("game");
  const { room, players } = state;
  const key = `q:${room.round}:` + players.map((p) => p.id + p.name).join("|");

  if (key !== state.viewKey) {
    state.viewKey = key;
    $("g-question").textContent = room.questions[room.round];
    $("g-round").textContent = `${num(room.round + 1)} / ${num(room.totalRounds)}`;
    $("g-grid").className = "stagger grid grid-cols-2 sm:grid-cols-3 gap-3";
    $("g-grid").innerHTML = players.map((p) => `
      <button data-pid="${esc(p.id)}" class="vote-card group relative flex flex-col items-center gap-2 p-4 rounded-3xl border-2 border-transparent bg-white/80 dark:bg-white/5 shadow-sm hover:scale-[1.03] active:scale-95 transition">
        ${avatar(p, "w-16 h-16 text-3xl")}
        <span class="font-black text-base truncate max-w-full">${esc(p.name)}${p.id === playerId ? " <span class='text-xs font-bold text-slate-400'>(أنت)</span>" : ""}</span>
        <span class="check absolute top-2 left-2 hidden w-7 h-7 rounded-full bg-violet-600 text-white text-sm font-black place-items-center pop-in">✓</span>
      </button>`).join("");
  }
  updateVoteUI();
}

const SEL = ["border-violet-500", "bg-violet-500/10", "dark:bg-violet-500/20", "shadow-lg", "shadow-violet-500/20"];
function updateVoteUI() {
  const { room, players } = state;
  const mv = myVote();
  $("g-grid").querySelectorAll(".vote-card").forEach((b) => {
    const on = !!mv && mv.targetId === b.dataset.pid;
    SEL.forEach((c) => b.classList.toggle(c, on));
    const ck = b.querySelector(".check");
    ck.classList.toggle("hidden", !on); ck.classList.toggle("grid", on);
  });
  const ids = new Set(players.map((p) => p.id));
  const done = votesOfRound(room.round).filter((v) => ids.has(v.voterId)).length;
  $("g-voted").textContent = `صوّت ${num(done)} من ${num(players.length)}`;
  $("g-bar").style.width = (players.length ? (done / players.length) * 100 : 0) + "%";
  $("g-status").textContent = mv ? "تم تسجيل صوتك ✅ تقدر تغيّره قبل ما يخلص الباقين" : "اضغط على اللاعب اللي تشوفه الأنسب 👇";

  const fb = $("btn-force-results");
  fb.classList.toggle("hidden", !(isHost() && done > 0 && done < players.length));
}

$("g-grid").addEventListener("click", async (e) => {
  const btn = e.target.closest(".vote-card");
  if (!btn || !state.room || state.room.status !== "question") return;
  const round = state.room.round, targetId = btn.dataset.pid;
  const cur = myVote();
  if (cur && cur.targetId === targetId) return;
  vibrate(15);
  try { await setDoc(voteRef(round), { round, voterId: playerId, targetId, at: Date.now() }); }
  catch (err) { toast(explain(err), "error"); }
});

/* المسؤول ينقل اللعبة لشاشة النتائج لما الكل يصوّت */
function maybeAdvance() {
  const { room, players } = state;
  if (!room || room.status !== "question" || !isHost()) return;
  const ids = new Set(players.map((p) => p.id));
  const done = new Set(votesOfRound(room.round).filter((v) => ids.has(v.voterId)).map((v) => v.voterId));
  if (players.length && done.size >= players.length) {
    const k = "r" + room.round;
    if (state.advancing === k) return;
    state.advancing = k;
    setTimeout(() => updateDoc(roomRef(), { status: "results" }).catch((e) => { state.advancing = ""; toast(explain(e), "error"); }), 450);
  }
}
$("btn-force-results").addEventListener("click", (e) => busy(e.currentTarget, () => updateDoc(roomRef(), { status: "results" }).catch((er) => toast(explain(er), "error"))));

/* --------------------------------- النتائج --------------------------------- */
function tally(round) {
  const ids = new Set(state.players.map((p) => p.id));
  const counts = {};
  state.players.forEach((p) => (counts[p.id] = 0));
  votesOfRound(round).forEach((v) => { if (ids.has(v.targetId)) counts[v.targetId]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = state.players.map((p) => ({ p, n: counts[p.id] })).sort((a, b) => b.n - a.n);
  const max = rows.length ? rows[0].n : 0;
  const winners = max > 0 ? rows.filter((r) => r.n === max).map((r) => r.p) : [];
  return { rows, total, max, winners };
}

function renderResults() {
  showView("results");
  const { room } = state;
  const key = `r:${room.round}:${votesOfRound(room.round).length}`;
  if (key !== state.viewKey) {
    state.viewKey = key;
    const { rows, total, max, winners } = tally(room.round);
    $("r-round").textContent = `${num(room.round + 1)} / ${num(room.totalRounds)}`;
    $("r-question").textContent = room.questions[room.round];

    $("r-winner").innerHTML = winners.length
      ? `<div class="pop-in inline-flex flex-col items-center gap-1 px-8 py-4 rounded-3xl bg-gradient-to-br from-amber-400/25 to-orange-500/20 border border-amber-400/40">
           <span class="text-4xl">👑</span>
           <span class="text-sm font-bold text-amber-700 dark:text-amber-300">${winners.length > 1 ? "تعادل بين" : "الأكثر اختياراً"}</span>
           <span class="text-2xl sm:text-3xl font-black">${winners.map((w) => esc(w.name)).join(" و ")}</span>
         </div>`
      : `<div class="pop-in inline-block px-6 py-3 rounded-3xl bg-slate-200/70 dark:bg-white/10 font-bold">ما صوّت أحد هالجولة 😅</div>`;

    $("r-bars").className = "mt-6 space-y-3 stagger";
    $("r-bars").innerHTML = rows.map(({ p, n }) => {
      const isW = max > 0 && n === max;
      const pct = total ? Math.round((n / total) * 100) : 0;
      return `<div class="flex items-center gap-3 p-3 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 ${isW ? "winner-glow" : ""}">
          ${avatar(p, "w-11 h-11 text-lg")}
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="font-black truncate">${esc(p.name)}${isW ? " 👑" : ""}</span>
              <span class="text-sm font-black tabnum"><span class="cnt" data-to="${n}">${num(0)}</span> <span class="text-slate-400 font-bold">صوت</span></span>
            </div>
            <div class="h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div class="bar-fill h-full rounded-full bg-gradient-to-l ${isW ? "from-amber-400 to-orange-500" : "from-violet-500 to-fuchsia-500"}" data-w="${pct}"></div>
            </div>
          </div>
        </div>`;
    }).join("");

    requestAnimationFrame(() => requestAnimationFrame(() => {
      $("r-bars").querySelectorAll(".bar-fill").forEach((b) => { b.style.width = Math.max(+b.dataset.w, +b.dataset.w ? 3 : 0) + "%"; });
    }));
    $("r-bars").querySelectorAll(".cnt").forEach((c) => {
      const to = +c.dataset.to; if (!to) return;
      let i = 0; const step = () => { i++; c.textContent = num(i); if (i < to) setTimeout(step, 600 / to + 60); };
      setTimeout(step, 250);
    });
    if (winners.length) { confetti(winners.some((w) => w.id === playerId) ? 70 : 30); vibrate(winners.some((w) => w.id === playerId) ? [40, 30, 40] : 20); }
  }

  const last = room.round + 1 >= room.totalRounds;
  const host = isHost();
  const next = $("btn-next");
  next.textContent = last ? "عرض النتيجة النهائية 🏆" : "السؤال التالي ➜";
  next.classList.toggle("hidden", !host);
  $("r-wait").classList.toggle("hidden", host);
  $("r-wait").textContent = "ننتظر المسؤول ينتقل للجولة التالية...";
}

$("btn-next").addEventListener("click", (e) => busy(e.currentTarget, async () => {
  const { room } = state;
  if (!isHost() || room.status !== "results") return;
  const patch = room.round + 1 >= room.totalRounds ? { status: "finished" } : { status: "question", round: room.round + 1 };
  state.advancing = "";
  try { await updateDoc(roomRef(), patch); } catch (err) { toast(explain(err), "error"); }
}));

/* ------------------------------- النتيجة النهائية ------------------------------- */
function finalStats() {
  const wins = {}; state.players.forEach((p) => (wins[p.id] = 0));
  const recap = [];
  for (let r = 0; r < state.room.totalRounds; r++) {
    const t = tally(r);
    t.winners.forEach((w) => wins[w.id]++);
    recap.push({ q: state.room.questions[r], winners: t.winners, max: t.max });
  }
  const rows = state.players.map((p) => ({ p, w: wins[p.id] })).sort((a, b) => b.w - a.w);
  return { rows, recap };
}

function renderFinal() {
  showView("final");
  const key = "f:" + state.players.map((p) => p.id).join("|") + ":" + state.votes.length;
  if (key !== state.viewKey) {
    state.viewKey = key;
    const { rows, recap } = finalStats();
    const medals = ["🥇", "🥈", "🥉"];
    const heights = ["h-44", "h-32", "h-24"];
    const order = rows.length >= 3 ? [1, 0, 2] : rows.length === 2 ? [1, 0] : [0];
    $("f-podium").className = `mt-8 grid gap-3 items-end ${order.length === 3 ? "grid-cols-3" : order.length === 2 ? "grid-cols-2 max-w-sm mx-auto" : "grid-cols-1 max-w-[10rem] mx-auto"}`;
    $("f-podium").innerHTML = order.map((i) => {
      const { p, w } = rows[i];
      return `<div class="pop-in flex flex-col items-center" style="animation-delay:${i === 0 ? 0.35 : i === 1 ? 0.15 : 0.05}s">
          <div class="text-3xl mb-1">${medals[i]}</div>
          ${avatar(p, i === 0 ? "w-20 h-20 text-4xl" : "w-14 h-14 text-2xl")}
          <div class="mt-2 mb-2 font-black text-sm sm:text-base truncate max-w-full">${esc(p.name)}</div>
          <div class="${heights[i]} w-full rounded-t-3xl bg-gradient-to-t ${i === 0 ? "from-amber-500 to-yellow-300 text-amber-950" : i === 1 ? "from-slate-400 to-slate-200 text-slate-900" : "from-orange-700 to-orange-400 text-orange-950"} grid place-items-center font-black text-2xl tabnum">${num(w)}</div>
        </div>`;
    }).join("");

    $("f-list").className = "mt-5 space-y-2 stagger";
    $("f-list").innerHTML = rows.slice(3).map(({ p, w }, i) => `
      <div class="flex items-center gap-3 p-3 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <span class="w-7 text-center font-black text-slate-400 tabnum">${num(i + 4)}</span>
        ${avatar(p, "w-10 h-10 text-lg")}
        <span class="flex-1 font-black truncate">${esc(p.name)}</span>
        <span class="font-black tabnum">${num(w)} <span class="text-xs text-slate-400 font-bold">جولة</span></span>
      </div>`).join("");

    $("f-recap").innerHTML = recap.map((r, i) => `
      <li class="flex gap-3">
        <span class="shrink-0 w-6 h-6 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 grid place-items-center text-xs font-black">${num(i + 1)}</span>
        <div><div class="font-bold">${esc(r.q)}</div>
        <div class="text-slate-500 dark:text-slate-400">${r.winners.length ? "👑 " + r.winners.map((w) => esc(w.name)).join(" و ") + " (" + num(r.max) + " صوت)" : "بدون أصوات"}</div></div>
      </li>`).join("");

    if (rows[0] && rows[0].w > 0) { confetti(90); vibrate([60, 40, 60, 40, 100]); }
  }
  const host = isHost();
  $("btn-again").classList.toggle("hidden", !host);
  $("f-wait").classList.toggle("hidden", host);
}

$("btn-again").addEventListener("click", (e) => busy(e.currentTarget, async () => {
  if (!isHost()) return;
  try {
    const vs = await getDocs(collection(db, "rooms", state.code, "votes"));
    const batch = writeBatch(db);
    vs.docs.forEach((d) => batch.delete(d.ref));
    batch.update(roomRef(), { status: "lobby", round: 0, totalRounds: 0, questions: [] });
    await batch.commit();
  } catch (err) { toast(explain(err), "error"); }
}));

/* ---------------------------------- المغادرة ---------------------------------- */
async function leaveRoom() {
  const code = state.code; if (!code) return;
  const others = state.players.filter((p) => p.id !== playerId);
  const wasHost = isHost();
  stopListening();
  try {
    if (!others.length) {
      const batch = writeBatch(db);
      const [vs, ps] = await Promise.all([getDocs(collection(db, "rooms", code, "votes")), getDocs(collection(db, "rooms", code, "players"))]);
      vs.docs.forEach((d) => batch.delete(d.ref));
      ps.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(roomRef(code));
      await batch.commit();
    } else {
      if (wasHost) await updateDoc(roomRef(code), { hostId: others[0].id });
      await deleteDoc(playerRef(code));
    }
  } catch (e) { console.error(e); }
  resetLocal();
}
["btn-leave-lobby", "btn-leave-final"].forEach((id) => $(id).addEventListener("click", (e) => busy(e.currentTarget, async () => {
  if (confirm("تبي تغادر الغرفة؟")) await leaveRoom();
})));

/* ------------------------------ نسخ ومشاركة ------------------------------ */
const roomLink = () => `${location.origin}${location.pathname}?room=${state.code}`;
async function copyCode() { toast((await copyText(state.code)) ? "تم نسخ رمز الغرفة ✅" : "رمز الغرفة: " + state.code, "ok"); vibrate(10); }
$("chip-room").addEventListener("click", copyCode);
$("btn-copy-code").addEventListener("click", copyCode);
$("btn-copy-link").addEventListener("click", async () => toast((await copyText(roomLink())) ? "تم نسخ رابط الغرفة ✅" : roomLink(), "ok"));
$("btn-share").addEventListener("click", async () => {
  const data = { title: "من أكثر واحد؟!", text: `تعال العب معنا! رمز الغرفة: ${state.code}`, url: roomLink() };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  toast((await copyText(roomLink())) ? "تم نسخ رابط الغرفة ✅" : roomLink(), "ok");
});

/* ------------------------------ ربط الأزرار ------------------------------ */
$("btn-create").addEventListener("click", (e) => busy(e.currentTarget, () => createRoom().catch((er) => homeError(explain(er)))));
$("btn-join").addEventListener("click", (e) => busy(e.currentTarget, () => joinRoom().catch((er) => homeError(explain(er)))));
$("btn-start").addEventListener("click", (e) => busy(e.currentTarget, () => startGame().catch((er) => toast(explain(er), "error"))));
$("btn-logo").addEventListener("click", () => { if (!state.code) showView("home"); });
$("inp-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); homeError(""); });
$("inp-name").addEventListener("input", () => homeError(""));
$("inp-name").addEventListener("keydown", (e) => { if (e.key !== "Enter") return; if ($("inp-code").value) $("btn-join").click(); else $("inp-code").focus(); });
$("inp-code").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btn-join").click(); });

/* ----------------------------------- بداية ----------------------------------- */
(async function boot() {
  $("inp-name").value = store.get("pg_name", "");
  const params = new URLSearchParams(location.search);
  const urlCode = (params.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

  // استرجاع الجلسة بعد تحديث الصفحة
  const saved = store.get("pg_room");
  if (saved && (!urlCode || urlCode === saved)) {
    try {
      const [rs, ps] = await Promise.all([getDoc(roomRef(saved)), getDoc(playerRef(saved))]);
      if (rs.exists() && ps.exists()) { showView("lobby"); enterRoom(saved); return; }
    } catch (e) { console.error(e); }
    store.del("pg_room");
  }

  showView("home");
  if (urlCode) {
    $("inp-code").value = urlCode;
    if (!$("inp-name").value) $("inp-name").focus();
    toast("اكتب اسمك واضغط انضمام للدخول للغرفة " + urlCode);
  }
})();
