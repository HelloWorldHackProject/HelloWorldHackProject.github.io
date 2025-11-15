// script.js (vanilla JS Reading Corner with Gemini TTS + Gemini Live Coach)

// --- Firebase imports (modular SDK, via CDN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Global Setup (matches your React code) ---
const appId = typeof window.__app_id !== "undefined" ? window.__app_id : "default-app-id";
const firebaseConfig = typeof window.__firebase_config !== "undefined"
  ? JSON.parse(window.__firebase_config)
  : {};
const initialAuthToken = typeof window.__initial_auth_token !== "undefined"
  ? window.__initial_auth_token
  : null;

// 🔑 Gemini API (for TTS NARRATION)
const API_KEY = "AIzaSyBMGUCwBt7oVwWo-728kQ-KyaqaeuvtFsE"; // <-- Put your Gemini API key here
const TTS_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

// 🔌 Flask API (for GEMINI LIVE COACH FEEDBACK)
const FLASK_API_URL = "http://localhost:5000/api/process-audio";

// --- Book metadata ---
const ALL_AVAILABLE_BOOKS = [
  { id: "book1", title: "Why Is It So Hot Today?", filename: "book1.pdf" },
  { id: "book2", title: "Saving the Moon", filename: "book2.pdf" },
  { id: "book3", title: "Dive!", filename: "book3.pdf" },
  { id: "book4", title: "My Dream City", filename: "book4.pdf" }
];


const ALL_BOOK_IDS = ALL_AVAILABLE_BOOKS.map(book => book.id);

// Tailwind color classes for ROYGBIV book icons
const ROYGBIV_COLORS = [
  "bg-red-500 hover:bg-red-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-yellow-500 hover:bg-yellow-600",
  "bg-green-500 hover:bg-green-600",
  "bg-blue-600 hover:bg-blue-700",
  "bg-indigo-600 hover:bg-indigo-700",
  "bg-purple-600 hover:bg-purple-700"
];

const getFileUrl = (fileName) => `${fileName}`;

// --- Global State ---
let db = null;
let auth = null;
let userId = null;
let isAuthReady = false;
let view = "home"; // 'home', 'library', 'add_library', 'reading'
let libraryBooks = [];
let selectedBook = null;

// TTS narration state
let ttsState = {
  isLoading: false,
  message: 'Tap "Start Story Voice" to hear the book being read!',
  audioUrl: null
};

let audioElement = null; // story narration audio element
let libraryUnsubscribe = null;

// Gemini Live coach state
const coachState = {
  isRecording: false,
  isProcessing: false,
  audioUrl: null,
  status: "Tap the purple microphone and read a sentence to your coach!"
};

let coachMediaRecorder = null;
let coachAudioChunks = [];
let coachAudioElement = null; // hidden <audio> element for feedback playback

// --- Firebase Initialization and Auth ---
function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      let currentUserId = user ? user.uid : null;

      if (!user) {
        if (!initialAuthToken) {
          const anonUser = await signInAnonymously(auth);
          currentUserId = anonUser.user.uid;
        }
      }

      userId = currentUserId;
      isAuthReady = true;

      setupLibraryListener();
      renderApp();
    });

    const signIn = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Authentication failed:", e);
        await signInAnonymously(auth);
      }
    };
    signIn();
  } catch (e) {
    console.error("Firebase setup failed:", e);
  }
}

function setupLibraryListener() {
  if (!isAuthReady || !userId || !db) return;

  if (libraryUnsubscribe) {
    libraryUnsubscribe();
    libraryUnsubscribe = null;
  }

const docRef = doc(db, "users", userId, "library", "books");

  libraryUnsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
  setDoc(docRef, { addedBookIds: [] });
}

      const data = docSnap.exists() ? docSnap.data() : {};
      const addedBookIds = data.addedBookIds || [];
      const userLibrary = ALL_AVAILABLE_BOOKS.filter(book =>
        addedBookIds.includes(book.id)
      );
      libraryBooks = userLibrary;

      if (["library", "add_library"].includes(view)) {
        renderApp();
      }
    },
    (e) => {
      console.error("Error listening to library data:", e);
    }
  );
}

// --- Library Management Actions ---
async function addBookToLibrary(bookId) {
  if (!db || !userId) return;
const docRef = doc(db, "users", userId, "library", "books");


  try {
    const currentIds = libraryBooks.map(b => b.id);
    if (!currentIds.includes(bookId)) {
      const newIds = [...currentIds, bookId];
      await setDoc(docRef, { addedBookIds: newIds }, { merge: true });
    }
  } catch (e) {
    console.error("Failed to add book to library:", e);
  }
}

async function removeBookFromLibrary(bookId) {
  if (!db || !userId) return;
const docRef = doc(db, "users", userId, "library", "books");

  try {
    const currentIds = libraryBooks.map(b => b.id);
    const newIds = currentIds.filter(id => id !== bookId);
    await setDoc(docRef, { addedBookIds: newIds }, { merge: true });
  } catch (e) {
    console.error("Failed to remove book from library:", e);
  }
}

// --- Shared Utility: Blob → Base64 ---
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- TTS Utilities (Story Voice) ---
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function pcmToWav(pcm16, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  // RIFF
  view.setUint32(offset, 0x52494646, false); offset += 4; // "RIFF"
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  view.setUint32(offset, 0x57415645, false); offset += 4; // "WAVE"

  // fmt
  view.setUint32(offset, 0x666d7420, false); offset += 4; // "fmt "
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2; // PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // data
  view.setUint32(offset, 0x64617461, false); offset += 4; // "data"
  view.setUint32(offset, dataSize, true); offset += 4;

  const pcmBytes = new Uint8Array(pcm16.buffer);
  for (let i = 0; i < pcmBytes.length; i++) {
    view.setUint8(offset + i, pcmBytes[i]);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// --- TTS Handlers (Story Voice) ---
async function handleListenToBook(retries = 3, delay = 1000) {
  if (!selectedBook) return;

  // If coach feedback is playing, stop it so we don't record the TTS
  stopCoachPlaybackOnly();

  const ttsPrompt = `Say cheerfully: Welcome to the book, ${selectedBook.title}! I'm your reading coach. Let's start reading!`;

  ttsState.isLoading = true;
  ttsState.message = "Getting ready to read your story...";
  updateTtsUI();

  if (audioElement) {
    audioElement.pause();
    audioElement.src = "";
  }

  const payload = {
    contents: [{ parts: [{ text: ttsPrompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Puck"
          }
        }
      }
    },
    model: "gemini-2.5-flash-preview-tts"
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${TTS_API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const result = await response.json();
      const part = result.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        const pcmData = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmData);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        if (audioElement) {
          audioElement.src = audioUrl;
          audioElement.play();
        }

        if (ttsState.audioUrl) {
          URL.revokeObjectURL(ttsState.audioUrl);
        }

        ttsState.isLoading = false;
        ttsState.message = `The story voice is reading "${selectedBook.title}"! Follow along on the page.`;
        ttsState.audioUrl = audioUrl;
        updateTtsUI();
        return;
      } else {
        throw new Error("Invalid TTS response structure or mime type.");
      }
    } catch (e) {
      console.error("TTS error:", e);
      if (i === retries - 1) {
        ttsState.isLoading = false;
        ttsState.message = "Uh oh! The story voice is taking a nap. Try again!";
        ttsState.audioUrl = null;
        updateTtsUI();
      } else {
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      }
    }
  }
}

function handleStopListening() {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = "";
  }
  if (ttsState.audioUrl) {
    URL.revokeObjectURL(ttsState.audioUrl);
  }
  ttsState.isLoading = false;
  ttsState.message = 'Reading stopped. Tap "Start Story Voice" to listen again.';
  ttsState.audioUrl = null;
  updateTtsUI();
}

function updateTtsUI() {
  const msgEl = document.getElementById("tts-message");
  const startBtn = document.getElementById("btn-start-reading");

  if (!msgEl || !startBtn) return;

  msgEl.textContent = ttsState.message;

  if (ttsState.isLoading) {
    startBtn.disabled = true;
    startBtn.classList.add("bg-gray-400", "cursor-wait");
    startBtn.classList.remove("bg-pink-600", "hover:bg-pink-700");
    startBtn.innerHTML = `
      <i data-lucide="loader-2" class="w-5 h-5 mr-2 animate-spin"></i>
      Thinking...
    `;
  } else {
    startBtn.disabled = false;
    startBtn.classList.remove("bg-gray-400", "cursor-wait");
    startBtn.classList.add("bg-pink-600", "hover:bg-pink-700");
    startBtn.innerHTML = `
      <i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>
      Start Story Voice
    `;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// --- Gemini Live Coach (Flask bridge) ---
function updateCoachUI() {
  const statusEl = document.getElementById("coach-status");
  const recordBtn = document.getElementById("btn-coach-record");
  const stopBtn = document.getElementById("btn-coach-stop");
  const playBtn = document.getElementById("btn-coach-play-feedback");
  const resetBtn = document.getElementById("btn-coach-reset");

  if (statusEl) {
    statusEl.textContent = coachState.status;
  }

  if (recordBtn) {
    const disabled = coachState.isRecording || coachState.isProcessing;
    recordBtn.disabled = disabled;
    recordBtn.classList.toggle("opacity-50", disabled);
    recordBtn.classList.toggle("cursor-not-allowed", disabled);
  }

  if (stopBtn) {
    const disabled = !coachState.isRecording;
    stopBtn.disabled = disabled;
    stopBtn.classList.toggle("opacity-50", disabled);
    stopBtn.classList.toggle("cursor-not-allowed", disabled);
  }

  if (playBtn) {
    const disabled = !coachState.audioUrl || coachState.isRecording || coachState.isProcessing;
    playBtn.disabled = disabled;
    playBtn.classList.toggle("opacity-50", disabled);
    playBtn.classList.toggle("cursor-not-allowed", disabled);
  }

  if (resetBtn) {
    const disabled = coachState.isRecording || coachState.isProcessing;
    resetBtn.disabled = disabled;
    resetBtn.classList.toggle("opacity-50", disabled);
    resetBtn.classList.toggle("cursor-not-allowed", disabled);
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function startCoachRecording() {
  if (coachState.isRecording || coachState.isProcessing) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    coachState.status = "Microphone not available on this device.";
    updateCoachUI();
    return;
  }

  // Stop story narration so the mic doesn't pick it up
  handleStopListening();

  // Stop any feedback playback currently running
  stopCoachPlaybackOnly();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    coachMediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    coachAudioChunks = [];

    coachMediaRecorder.ondataavailable = (event) => {
      coachAudioChunks.push(event.data);
    };

    coachMediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      sendCoachRecordingToFlask();
    };

    coachMediaRecorder.start();
    coachState.isRecording = true;
    coachState.status = "Listening... Read the sentence to your coach!";
    updateCoachUI();
  } catch (error) {
    console.error("Error starting recording:", error);
    coachState.status = `Error accessing microphone: ${error.message}`;
    coachState.isRecording = false;
    coachState.isProcessing = false;
    updateCoachUI();
  }
}

function stopCoachRecording() {
  if (!coachState.isRecording || !coachMediaRecorder) return;

  coachMediaRecorder.stop();
  coachState.isRecording = false;
  coachState.isProcessing = true;
  coachState.status = "Great job! Your coach is thinking about your reading...";
  updateCoachUI();
}

async function sendCoachRecordingToFlask() {
  // Recorded as WEBM audio from MediaRecorder
  const audioBlob = new Blob(coachAudioChunks, { type: "audio/webm" });

  try {
    const recordedBase64 = await blobToBase64(audioBlob);
    coachState.status = "Sending your reading to your coach...";
    updateCoachUI();

    const response = await fetch(FLASK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: recordedBase64 })
    });

    if (!response.ok) {
      let errorMsg = `Server responded with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMsg = errorData.error;
        }
      } catch {}
      throw new Error(errorMsg);
    }

    coachState.status = "Your coach is getting your feedback ready...";
    updateCoachUI();

    const finalAudioBlob = await response.blob();
    const playableBlob =
      finalAudioBlob.type && finalAudioBlob.type.startsWith("audio")
        ? finalAudioBlob
        : new Blob([finalAudioBlob], { type: "audio/wav" });

    if (coachState.audioUrl) {
      try {
        URL.revokeObjectURL(coachState.audioUrl);
      } catch {}
    }

    const url = URL.createObjectURL(playableBlob);
    coachState.audioUrl = url;
    coachState.isProcessing = false;
    coachState.status = "Feedback ready! Tap play to hear what your coach says.";
    updateCoachUI();
  } catch (error) {
    console.error("Flask/Processing Error:", error);
    coachState.isProcessing = false;
    coachState.status = `Error from coach server: ${error.message}. Is Flask running?`;
    updateCoachUI();
  }
}

function ensureCoachAudioElement() {
  if (!coachAudioElement) {
    const el = document.createElement("audio");
    el.style.display = "none";
    el.controls = false;
    document.body.appendChild(el);
    coachAudioElement = el;
  }
}

function playCoachFeedback() {
  if (!coachState.audioUrl || coachState.isRecording || coachState.isProcessing) return;

  ensureCoachAudioElement();

  try {
    coachAudioElement.src = coachState.audioUrl;
    coachAudioElement.currentTime = 0;
    const playPromise = coachAudioElement.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          coachState.status = "Playing your coach's feedback...";
          updateCoachUI();
        })
        .catch((err) => {
          console.warn("Playback failed:", err);
          coachState.status = `Playback failed: ${err.message}`;
          updateCoachUI();
        });
    } else {
      coachState.status = "Playing your coach's feedback...";
      updateCoachUI();
    }

    coachAudioElement.onended = () => {
      coachState.status = "Feedback played. Great work! You can try another sentence.";
      updateCoachUI();
    };
  } catch (err) {
    console.error("Play error:", err);
    coachState.status = `Playback error: ${err.message}`;
    updateCoachUI();
  }
}

function stopCoachPlaybackOnly() {
  if (coachAudioElement) {
    try {
      coachAudioElement.pause();
    } catch {}
  }
}

function resetCoachState() {
  // Stop recording if still going
  try {
    if (coachMediaRecorder && coachState.isRecording) {
      coachMediaRecorder.stop();
    }
  } catch {}

  coachState.isRecording = false;
  coachState.isProcessing = false;

  // Stop and release feedback audio
  if (coachAudioElement) {
    try {
      coachAudioElement.pause();
      coachAudioElement.currentTime = 0;
    } catch {}
  }
  if (coachState.audioUrl) {
    try {
      URL.revokeObjectURL(coachState.audioUrl);
    } catch {}
  }
  coachState.audioUrl = null;

  coachState.status = "Tap the purple microphone and read a sentence to your coach!";
  updateCoachUI();
}

// --- View Renderers ---
function renderHomeView() {
  return `
    <div class="relative flex flex-col items-center justify-center min-h-[70vh] p-4 bg-yellow-100 rounded-[3rem] shadow-2xl border-8 border-yellow-300">
      <h1 class="text-5xl sm:text-7xl font-black text-pink-600 mb-12 text-center drop-shadow-lg [text-shadow:_5px_5px_rgb(255_255_255_/_80%)]">
        Welcome to Our Learning Corner!
      </h1>
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-12 max-w-5xl w-full px-4">
        <!-- Read a Book -->
        <button
          id="btn-read-book"
          class="flex flex-col items-center justify-center flex-1 p-8 sm:p-16 rounded-3xl text-white font-black text-center
                 transition duration-300 transform shadow-xl border-8 border-white/50
                 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] hover:scale-[1.02]
                 focus:ring-8 focus:ring-offset-4 focus:ring-opacity-70 focus:ring-white"
          style="min-height: 200px;"
        >
          <i data-lucide="book-open" class="w-16 h-16 sm:w-24 sm:h-24 mb-4 drop-shadow-md"></i>
          <span class="text-3xl sm:text-4xl drop-shadow-md">Read a Book</span>
        </button>

        <!-- Play a Game (disabled) -->
        <button
          id="btn-play-game"
          disabled
          class="flex flex-col items-center justify-center flex-1 p-8 sm:p-16 rounded-3xl text-white font-black text-center
                 transition duration-300 transform shadow-xl border-8 border-white/50
                 opacity-70 cursor-not-allowed bg-gray-400"
          style="min-height: 200px;"
        >
          <i data-lucide="gamepad-2" class="w-16 h-16 sm:w-24 sm:h-24 mb-4 drop-shadow-md"></i>
          <span class="text-3xl sm:text-4xl drop-shadow-md">Play a Game</span>
          <span class="text-xl mt-2">(Coming Soon!)</span>
        </button>
      </div>

      <!-- For Grown Up's -->
      <button
        id="btn-grownups"
        class="mt-8 flex items-center p-3 sm:p-4 rounded-full text-white font-bold
               bg-purple-600 hover:bg-purple-700 active:scale-[0.98]
               transition duration-300 shadow-xl border-4 border-white/50
               focus:ring-4 focus:ring-purple-300"
      >
        <i data-lucide="settings" class="w-5 h-5 sm:w-6 sm:h-6 mr-2"></i>
        <span class="text-lg sm:text-xl">For Grown Up's</span>
      </button>
    </div>
  `;
}

function renderLibraryManagementView() {
  const currentIds = libraryBooks.map(b => b.id);
  const availableToAdd = ALL_AVAILABLE_BOOKS.filter(
    book => !currentIds.includes(book.id)
  );

  const addListHtml = availableToAdd.length
    ? availableToAdd
        .map(
          book => `
        <div class="flex justify-between items-center p-3 bg-white border border-blue-200 rounded-xl shadow-md">
          <span class="font-medium text-gray-800 truncate">${book.title}</span>
          <button
            data-add-book-id="${book.id}"
            class="py-1 px-3 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition shadow-lg"
          >
            Add Book
          </button>
        </div>
      `
        )
        .join("")
    : `
      <p class="col-span-2 text-center text-green-600 p-4 border-4 border-green-300 bg-green-100 rounded-xl font-bold">
        All available books are in the library!
      </p>
    `;

  const libraryHtml = libraryBooks.length
    ? libraryBooks
        .map(
          book => `
        <div class="flex justify-between items-center p-3 bg-white border border-pink-300 rounded-xl shadow-md">
          <span class="font-medium text-pink-800 truncate">${book.title}</span>
          <button
            data-remove-book-id="${book.id}"
            class="py-1 px-3 text-sm bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
          >
            Remove
          </button>
        </div>
      `
        )
        .join("")
    : `
      <p class="col-span-2 text-center text-gray-500 p-4 border rounded-xl">
        Your library is empty.
      </p>
    `;

  return `
    <div class="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-2xl">
      <button
        id="btn-back-home-from-manager"
        class="flex items-center text-pink-700 hover:text-pink-900 font-semibold transition duration-150 mb-6 bg-pink-100 p-2 rounded-lg shadow-md"
      >
        <i data-lucide="arrow-left" class="w-5 h-5 mr-2"></i>
        Back
      </button>

      <h2 class="text-3xl font-bold text-pink-700 mb-8 border-b-4 border-pink-300 pb-2">
        Grown Up's Library Manager
      </h2>

      <div class="mb-8 p-6 bg-blue-50 rounded-xl shadow-inner border-4 border-blue-200">
        <h3 class="text-2xl font-semibold text-blue-700 mb-4 flex items-center">
          <i data-lucide="folder-plus" class="w-6 h-6 mr-2 text-blue-500"></i>
          Books to Add (Simulated Upload)
        </h3>
        <p class="text-gray-600 mb-4">
          Click 'Add Book' to make it available for the reader. This simulates the file upload process.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${addListHtml}
        </div>
      </div>

      <div class="mt-10 p-6 bg-pink-50 rounded-xl shadow-inner border-4 border-pink-200">
        <h3 class="text-2xl font-semibold text-pink-700 mb-4 border-t-0 pt-0">
          Current Library Books
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${libraryHtml}
        </div>
      </div>
    </div>
  `;
}

function renderLibraryView() {
  const booksHtml = libraryBooks
    .map((book, index) => {
      const colorClass = ROYGBIV_COLORS[index % ROYGBIV_COLORS.length];
      return `
        <button
          class="book-card flex flex-col items-center p-4 rounded-xl text-white font-black transition duration-200 transform hover:scale-[1.05] shadow-xl ${colorClass}"
          style="min-height: 180px;"
          data-book-id="${book.id}"
        >
          <i data-lucide="book-open" class="w-10 h-10 mb-3"></i>
          <span class="text-center text-lg">${book.title}</span>
        </button>
      `;
    })
    .join("");

  const emptyHtml = `
    <div class="text-center p-12 bg-yellow-50 border-4 border-dashed border-yellow-300 rounded-xl">
      <p class="text-2xl text-gray-600 font-bold mb-6">
        No books yet! Ask a grown up to add some.
      </p>
      <button
        id="btn-back-home-from-library-empty"
        class="bg-pink-600 text-white py-3 px-8 rounded-full shadow-lg hover:bg-pink-700 transition font-semibold"
      >
        Go Back Home
      </button>
    </div>
  `;

  return `
    <div class="max-w-7xl mx-auto p-8 bg-white rounded-3xl shadow-2xl">
      <button
        id="btn-back-home-from-library"
        class="flex items-center text-pink-700 hover:text-pink-900 font-semibold transition duration-150 mb-6 bg-pink-100 p-2 rounded-lg shadow-md"
      >
        <i data-lucide="arrow-left" class="w-5 h-5 mr-2"></i>
        Back
      </button>

      <h2 class="text-4xl font-black text-indigo-700 mb-8 border-b-4 border-indigo-300 pb-2 text-center">
        Pick a Story!
      </h2>

      ${
        libraryBooks.length === 0
          ? emptyHtml
          : `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          ${booksHtml}
        </div>
      `
      }
    </div>
  `;
}

function renderReadingView() {
  if (!selectedBook) {
    return `
      <div class="max-w-4xl mx-auto p-8 bg-white rounded-3xl shadow-2xl">
        <p class="text-center text-gray-700">No book selected. Go back to the library.</p>
      </div>
    `;
  }

  return `
    <div class="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 p-4">
      <!-- PDF Viewer -->
      <div class="lg:w-2/3 bg-white shadow-2xl rounded-2xl p-4 flex flex-col">
        <div class="flex justify-between items-center mb-4 border-b-4 border-pink-200 pb-2">
          <button
            id="btn-back-library-from-reading"
            class="flex items-center text-indigo-700 hover:text-indigo-900 font-bold transition duration-150 bg-indigo-100 p-2 rounded-xl"
          >
            <i data-lucide="arrow-left" class="w-5 h-5 mr-2"></i>
            Library
          </button>
          <h2 class="text-2xl font-black text-indigo-800 truncate" title="${selectedBook.title}">
            ${selectedBook.title}
          </h2>
        </div>

        <div class="flex-1 min-h-[400px] border-4 border-indigo-500 rounded-xl overflow-hidden shadow-inner">
          <iframe
            src="${getFileUrl(selectedBook.filename)}"
            title="PDF Viewer for ${selectedBook.title}"
            class="w-full h-full"
            style="border: none;"
          ></iframe>
        </div>
      </div>

      <!-- Reading Coach -->
      <div class="lg:w-1/3 flex flex-col gap-6 bg-white shadow-2xl rounded-2xl p-6 border-4 border-green-500">
        <h3 class="text-3xl font-black text-green-700 border-b-4 border-green-300 pb-2 mb-2">
          Reading Coach
        </h3>

        <!-- Coach bubble -->
        <div class="flex-1 bg-green-100 p-6 rounded-3xl border-4 border-green-400 flex flex-col justify-center text-center shadow-lg speech-bubble">
          <p class="text-sm font-semibold text-green-800 uppercase tracking-wide mb-2">
            Story Voice
          </p>
          <p id="tts-message" class="text-lg font-semibold text-gray-800">
            ${ttsState.message}
          </p>

          <hr class="my-4 border-green-300" />

          <p class="text-sm font-semibold text-green-800 uppercase tracking-wide mb-2">
            Your Turn
          </p>
          <p id="coach-status" class="text-base font-medium text-green-900">
            ${coachState.status}
          </p>

          <audio id="reading-audio"></audio>
        </div>

        <!-- Controls -->
        <div class="flex flex-col space-y-5">
          <!-- Story Voice Controls -->
          <div class="space-y-2">
            <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Story Voice (Gemini TTS)
            </p>
            <div class="flex flex-row gap-3">
              <button
                id="btn-start-reading"
                class="flex-1 py-3 px-4 rounded-full text-white font-bold transition duration-300 shadow-xl transform hover:scale-[1.01] bg-pink-600 hover:bg-pink-700 active:bg-pink-800 flex items-center justify-center"
              >
                <i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>
                Start Story Voice
              </button>
              <button
                id="btn-stop-reading"
                class="flex-1 py-3 px-4 rounded-full text-white font-bold transition duration-300 shadow-lg transform hover:scale-[1.01] bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center"
              >
                <i data-lucide="square" class="w-5 h-5 mr-2"></i>
                Stop Story
              </button>
            </div>
          </div>

          <!-- Your Turn Controls -->
          <div class="space-y-2">
            <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Your Turn (Gemini Live Coach)
            </p>
            <div class="flex flex-wrap gap-3">
              <button
                id="btn-coach-record"
                class="flex-1 min-w-[120px] py-3 px-4 rounded-full text-white font-bold transition duration-200 shadow-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 flex items-center justify-center"
              >
                <i data-lucide="mic" class="w-5 h-5 mr-2"></i>
                Record
              </button>
              <button
                id="btn-coach-stop"
                class="flex-1 min-w-[120px] py-3 px-4 rounded-full text-white font-bold transition duration-200 shadow-xl bg-red-600 hover:bg-red-700 active:bg-red-800 flex items-center justify-center opacity-50 cursor-not-allowed"
                disabled
              >
                <i data-lucide="stop-circle" class="w-5 h-5 mr-2"></i>
                Stop
              </button>
              <button
                id="btn-coach-play-feedback"
                class="flex-1 min-w-[140px] py-3 px-4 rounded-full text-white font-bold transition duration-200 shadow-xl bg-green-600 hover:bg-green-700 active:bg-green-800 flex items-center justify-center opacity-50 cursor-not-allowed"
                disabled
              >
                <i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>
                Play Feedback
              </button>
              <button
                id="btn-coach-reset"
                class="flex-1 min-w-[110px] py-3 px-4 rounded-full text-gray-700 font-semibold transition duration-200 shadow bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center opacity-50 cursor-not-allowed"
                disabled
              >
                <i data-lucide="refresh-cw" class="w-5 h-5 mr-2"></i>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Main App Renderer ---
function renderApp() {
  const root = document.getElementById("app-root");
  if (!root) return;

  let contentHTML = "";

  switch (view) {
    case "library":
      contentHTML = renderLibraryView();
      break;
    case "add_library":
      contentHTML = renderLibraryManagementView();
      break;
    case "reading":
      contentHTML = renderReadingView();
      break;
    case "home":
    default:
      contentHTML = renderHomeView();
      break;
  }

  const userIdDisplay =
    isAuthReady && userId
      ? `<div class="mt-8 text-center text-xs text-gray-500">User ID: ${userId}</div>`
      : "";

  root.innerHTML = `
  <div class="max-w-7xl mx-auto">
    ${contentHTML}
    ${userIdDisplay}
  </div>
`;


  // Turn all <i data-lucide> into SVG icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Attach events for the current view
  attachEventHandlers();

  // Prepare audio + UI if in reading view
  if (view === "reading") {
    audioElement = document.getElementById("reading-audio");
    if (audioElement) {
      audioElement.addEventListener("ended", () => {
        ttsState.message = 'The story voice finished. Tap "Start Story Voice" to hear it again.';
        updateTtsUI();
      });
    }
    updateTtsUI();
    updateCoachUI();
  }
}

// --- Event Wiring ---
function attachEventHandlers() {
  if (view === "home") {
    const btnRead = document.getElementById("btn-read-book");
    const btnGrownups = document.getElementById("btn-grownups");

    if (btnRead) {
      btnRead.addEventListener("click", () => {
        view = "library";
        renderApp();
      });
    }

    if (btnGrownups) {
      btnGrownups.addEventListener("click", () => {
        view = "add_library";
        renderApp();
      });
    }
  }

  if (view === "library") {
    const backHome = document.getElementById("btn-back-home-from-library");
    const backHomeEmpty = document.getElementById("btn-back-home-from-library-empty");

    if (backHome) {
      backHome.addEventListener("click", () => {
        view = "home";
        renderApp();
      });
    }
    if (backHomeEmpty) {
      backHomeEmpty.addEventListener("click", () => {
        view = "home";
        renderApp();
      });
    }

    const bookButtons = document.querySelectorAll(".book-card");
    bookButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const bookId = btn.getAttribute("data-book-id");
        selectedBook = libraryBooks.find(b => b.id === bookId) || null;
        handleStopListening();
        resetCoachState();
        view = "reading";
        renderApp();
      });
    });
  }

  if (view === "add_library") {
    const backBtn = document.getElementById("btn-back-home-from-manager");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        view = "home";
        renderApp();
      });
    }

    const addButtons = document.querySelectorAll("[data-add-book-id]");
    addButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const bookId = btn.getAttribute("data-add-book-id");
        addBookToLibrary(bookId);
      });
    });

    const removeButtons = document.querySelectorAll("[data-remove-book-id]");
    removeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const bookId = btn.getAttribute("data-remove-book-id");
        removeBookFromLibrary(bookId);
      });
    });
  }

  if (view === "reading") {
    const backLibraryBtn = document.getElementById("btn-back-library-from-reading");
    const startBtn = document.getElementById("btn-start-reading");
    const stopBtn = document.getElementById("btn-stop-reading");

    const coachRecordBtn = document.getElementById("btn-coach-record");
    const coachStopBtn = document.getElementById("btn-coach-stop");
    const coachPlayBtn = document.getElementById("btn-coach-play-feedback");
    const coachResetBtn = document.getElementById("btn-coach-reset");

    if (backLibraryBtn) {
      backLibraryBtn.addEventListener("click", () => {
        handleStopListening();
        resetCoachState();
        view = "library";
        renderApp();
      });
    }

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        // If coach recording is active, ignore
        if (coachState.isRecording || coachState.isProcessing) return;
        handleListenToBook();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        handleStopListening();
      });
    }

    if (coachRecordBtn) {
      coachRecordBtn.addEventListener("click", () => {
        startCoachRecording();
      });
    }

    if (coachStopBtn) {
      coachStopBtn.addEventListener("click", () => {
        stopCoachRecording();
      });
    }

    if (coachPlayBtn) {
      coachPlayBtn.addEventListener("click", () => {
        playCoachFeedback();
      });
    }

    if (coachResetBtn) {
      coachResetBtn.addEventListener("click", () => {
        resetCoachState();
      });
    }
  }
}

// --- Bootstrapping ---
initFirebase();
renderApp();
