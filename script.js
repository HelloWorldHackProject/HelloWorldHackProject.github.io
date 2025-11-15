// script.js — CLEAN VERSION (NO FIREBASE)

// -----------------------
//  BOOKS DATA
// -----------------------

const ALL_AVAILABLE_BOOKS = [
  { id: "book1", title: "Why Is It So Hot Today?", filename: "book1.pdf" },
  { id: "book2", title: "Saving the Moon", filename: "book2.pdf" },
  { id: "book3", title: "Dive!", filename: "book3.pdf" },
  { id: "book4", title: "My Dream City", filename: "book4.pdf" }
];

const ROYGBIV_COLORS = [
  "bg-red-500 hover:bg-red-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-yellow-500 hover:bg-yellow-600",
  "bg-green-500 hover:bg-green-600",
  "bg-blue-600 hover:bg-blue-700",
  "bg-indigo-600 hover:bg-indigo-700",
  "bg-purple-600 hover:bg-purple-700"
];

const getFileUrl = (fileName) => fileName;

// -----------------------
//  GLOBAL STATE
// -----------------------

let view = "home";
let selectedBook = null;

let ttsState = {
  isLoading: false,
  message: `Tap "Start Story Voice" to hear the book being read!`,
  audioUrl: null
};

let coachState = {
  isRecording: false,
  isProcessing: false,
  audioUrl: null,
  status: "Tap the purple microphone and read a sentence to your coach!"
};

let audioElement = null;
let coachAudioElement = null;
let coachMediaRecorder = null;
let coachAudioChunks = [];

// -----------------------
//  GEMINI TTS
// -----------------------

const API_KEY = "YOUR_GEMINI_KEY_HERE";
const TTS_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function pcmToWav(pcm16, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16.byteLength;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  // RIFF
  view.setUint32(offset, 0x52494646, false); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  view.setUint32(offset, 0x57415645, false); offset += 4;

  // fmt 
  view.setUint32(offset, 0x666d7420, false); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // data
  view.setUint32(offset, 0x64617461, false); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  const pcmBytes = new Uint8Array(pcm16.buffer);
  pcmBytes.forEach((b, i) => view.setUint8(offset + i, b));
  return new Blob([buffer], { type: "audio/wav" });
}

async function handleListenToBook() {
  if (!selectedBook) return;

  const ttsPrompt =
    `Say cheerfully: Welcome to the book, ${selectedBook.title}! Let's read together!`;

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
          prebuiltVoiceConfig: { voiceName: "Puck" }
        }
      }
    }
  };

  try {
    const res = await fetch(`${TTS_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    const part = result.candidates?.[0]?.content?.parts?.[0];

    const audioData = part.inlineData.data;
    const mimeType = part.inlineData.mimeType;
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

    const pcmData = base64ToArrayBuffer(audioData);
    const pcm16 = new Int16Array(pcmData);
    const wavBlob = pcmToWav(pcm16, sampleRate);
    const audioUrl = URL.createObjectURL(wavBlob);

    audioElement.src = audioUrl;
    audioElement.play();

    ttsState.isLoading = false;
    ttsState.message = `Reading "${selectedBook.title}" aloud!`;
    ttsState.audioUrl = audioUrl;
    updateTtsUI();
  } catch (err) {
    console.error(err);
    ttsState.isLoading = false;
    ttsState.message = "Oops! The story voice had trouble. Try again!";
    updateTtsUI();
  }
}

function handleStopListening() {
  if (audioElement) audioElement.pause();
  if (ttsState.audioUrl) URL.revokeObjectURL(ttsState.audioUrl);

  ttsState.isLoading = false;
  ttsState.message = `Reading stopped. Tap "Start Story Voice" to listen again.`;
  updateTtsUI();
}

function updateTtsUI() {
  const msgEl = document.getElementById("tts-message");
  const startBtn = document.getElementById("btn-start-reading");

  if (!msgEl || !startBtn) return;

  msgEl.textContent = ttsState.message;

  if (ttsState.isLoading) {
    startBtn.disabled = true;
    startBtn.innerHTML =
      `<i data-lucide="loader-2" class="w-5 h-5 mr-2 animate-spin"></i>Thinking...`;
    startBtn.classList.add("bg-gray-400");
  } else {
    startBtn.disabled = false;
    startBtn.innerHTML =
      `<i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>Start Story Voice`;
    startBtn.classList.remove("bg-gray-400");
  }

  if (window.lucide) window.lucide.createIcons();
}

// -----------------------
//  COACH
// -----------------------

const FLASK_API_URL = "http://localhost:5000/api/process-audio";

function ensureCoachAudioElement() {
  if (!coachAudioElement) {
    coachAudioElement = document.createElement("audio");
    coachAudioElement.style.display = "none";
    document.body.appendChild(coachAudioElement);
  }
}

async function blobToBase64(blob) {
  const reader = new FileReader();
  return new Promise((res) => {
    reader.onloadend = () =>
      res(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

async function startCoachRecording() {
  if (!navigator.mediaDevices) {
    coachState.status = "Microphone not available.";
    updateCoachUI();
    return;
  }

  handleStopListening();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  coachMediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  coachAudioChunks = [];

  coachMediaRecorder.ondataavailable = (e) => coachAudioChunks.push(e.data);

  coachMediaRecorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    sendCoachAudio();
  };

  coachMediaRecorder.start();
  coachState.isRecording = true;
  coachState.status = "Listening… read aloud!";
  updateCoachUI();
}

function stopCoachRecording() {
  if (coachState.isRecording) {
    coachMediaRecorder.stop();
    coachState.isRecording = false;
    coachState.isProcessing = true;
    coachState.status = "Thinking...";
    updateCoachUI();
  }
}

async function sendCoachAudio() {
  const audioBlob = new Blob(coachAudioChunks, { type: "audio/webm" });
  const base64Audio = await blobToBase64(audioBlob);

  try {
    const response = await fetch(FLASK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64Audio })
    });

    const audioFile = await response.blob();
    const url = URL.createObjectURL(audioFile);

    coachState.audioUrl = url;
    coachState.isProcessing = false;
    coachState.status = "Feedback ready!";
    updateCoachUI();
  } catch (err) {
    coachState.status = "Error contacting coach.";
    coachState.isProcessing = false;
    updateCoachUI();
  }
}

function playCoachFeedback() {
  ensureCoachAudioElement();
  coachAudioElement.src = coachState.audioUrl;
  coachAudioElement.play();

  coachState.status = "Playing feedback…";
  updateCoachUI();

  coachAudioElement.onended = () => {
    coachState.status = "Try reading another sentence!";
    updateCoachUI();
  };
}

function resetCoachState() {
  coachState.isRecording = false;
  coachState.isProcessing = false;
  coachState.audioUrl = null;
  coachState.status =
    "Tap the purple microphone and read a sentence to your coach!";
  updateCoachUI();
}

function updateCoachUI() {
  const statusEl = document.getElementById("coach-status");
  const recordBtn = document.getElementById("btn-coach-record");
  const stopBtn = document.getElementById("btn-coach-stop");
  const playBtn = document.getElementById("btn-coach-play-feedback");
  const resetBtn = document.getElementById("btn-coach-reset");

  statusEl.textContent = coachState.status;

  recordBtn.disabled =
    coachState.isRecording || coachState.isProcessing;

  stopBtn.disabled = !coachState.isRecording;

  playBtn.disabled =
    !coachState.audioUrl || coachState.isRecording || coachState.isProcessing;

  resetBtn.disabled =
    coachState.isRecording || coachState.isProcessing;

  if (window.lucide) window.lucide.createIcons();
}

// -----------------------
//  RENDER VIEWS
// -----------------------

function renderHomeView() {
  return `
    <div class="relative flex flex-col items-center justify-center min-h-[70vh] p-4 bg-yellow-100 rounded-[3rem] shadow-2xl border-8 border-yellow-300">
      <h1 class="text-5xl sm:text-7xl font-black text-pink-600 mb-12 text-center drop-shadow-lg">
        Welcome to Our Learning Corner!
      </h1>

      <button
        id="btn-read-book"
        class="p-10 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl text-4xl font-black shadow-xl"
      >
        📚 Read a Book
      </button>
    </div>
  `;
}

function renderLibraryView() {
  const booksHtml = ALL_AVAILABLE_BOOKS.map((book, i) => {
    const color = ROYGBIV_COLORS[i % ROYGBIV_COLORS.length];
    return `
      <button
        data-book-id="${book.id}"
        class="book-card flex flex-col items-center p-4 rounded-xl text-white font-black ${color} hover:scale-[1.05] shadow-xl"
      >
        <i data-lucide="book-open" class="w-10 h-10 mb-2"></i>
        <span>${book.title}</span>
      </button>
    `;
  }).join("");

  return `
    <div class="max-w-5xl mx-auto bg-white p-8 rounded-3xl shadow-2xl">
      <button id="btn-back-home" class="flex items-center text-pink-700 mb-6">
        <i data-lucide="arrow-left" class="w-6 h-6 mr-2"></i> Back
      </button>
      <h2 class="text-4xl font-black text-indigo-700 mb-8 text-center">
        Pick a Story!
      </h2>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        ${booksHtml}
      </div>
    </div>
  `;
}

function renderReadingView() {
  return `
    <div class="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      <!-- PDF -->
      <div class="lg:w-2/3 bg-white rounded-2xl p-4 shadow-xl">
        <div class="flex items-center mb-4">
          <button id="btn-back-library" class="flex items-center text-indigo-700">
            <i data-lucide="arrow-left" class="w-6 h-6 mr-2"></i> Library
          </button>
          <h2 class="ml-4 text-2xl font-black text-indigo-800">${selectedBook.title}</h2>
        </div>

        <iframe
          src="${getFileUrl(selectedBook.filename)}"
          class="w-full h-full border-4 border-indigo-500 rounded-xl"
        ></iframe>
      </div>

      <!-- Coach -->
      <div class="lg:w-1/3 bg-white rounded-2xl p-6 shadow-xl border-4 border-green-500 flex flex-col">
        <h3 class="text-3xl font-black text-green-700 border-b-4 border-green-300 pb-2">
          Reading Coach
        </h3>

        <div class="flex-1 bg-green-100 p-6 rounded-3xl border-4 border-green-400 text-center mt-4">
          <p id="tts-message" class="font-semibold text-xl">${ttsState.message}</p>
          <hr class="my-4 border-green-300" />
          <p id="coach-status" class="font-semibold text-green-900">
            ${coachState.status}
          </p>

          <audio id="reading-audio"></audio>
        </div>

        <div class="mt-6 space-y-4">
          <button id="btn-start-reading" class="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-full font-bold">
            <i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>
            Start Story Voice
          </button>

          <button id="btn-stop-reading" class="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold">
            Stop Story
          </button>

          <div class="flex flex-wrap gap-3">
            <button id="btn-coach-record" class="flex-1 py-3 bg-purple-600 text-white rounded-full font-bold">
              <i data-lucide="mic" class="w-5 h-5 mr-2"></i>Record
            </button>
            <button id="btn-coach-stop" disabled class="flex-1 py-3 bg-red-600 text-white rounded-full font-bold opacity-50">
              <i data-lucide="stop-circle" class="w-5 h-5 mr-2"></i>Stop
            </button>
            <button id="btn-coach-play-feedback" disabled class="flex-1 py-3 bg-green-600 text-white rounded-full font-bold opacity-50">
              <i data-lucide="volume-2" class="w-5 h-5 mr-2"></i>Play Feedback
            </button>
            <button id="btn-coach-reset" disabled class="flex-1 py-3 bg-gray-200 rounded-full font-bold opacity-50">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -----------------------
//  MAIN RENDER FUNCTION
// -----------------------

function renderApp() {
  const root = document.getElementById("app-root");
  let html = "";

  if (view === "home") html = renderHomeView();
  if (view === "library") html = renderLibraryView();
  if (view === "reading") html = renderReadingView();

  root.innerHTML = `<div class="max-w-7xl mx-auto">${html}</div>`;
  attachHandlers();
  if (window.lucide) window.lucide.createIcons();

  if (view === "reading") {
    audioElement = document.getElementById("reading-audio");
    updateTtsUI();
    updateCoachUI();
  }
}

// -----------------------
//  EVENT HANDLERS
// -----------------------

function attachHandlers() {
  if (view === "home") {
    document.getElementById("btn-read-book").onclick = () => {
      view = "library";
      renderApp();
    };
  }

  if (view === "library") {
    document.getElementById("btn-back-home").onclick = () => {
      view = "home";
      renderApp();
    };

    document.querySelectorAll("[data-book-id]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-book-id");
        selectedBook = ALL_AVAILABLE_BOOKS.find(b => b.id === id);
        view = "reading";
        renderApp();
      };
    });
  }

  if (view === "reading") {
    document.getElementById("btn-back-library").onclick = () => {
      handleStopListening();
      resetCoachState();
      view = "library";
      renderApp();
    };

    document.getElementById("btn-start-reading").onclick = handleListenToBook;
    document.getElementById("btn-stop-reading").onclick = handleStopListening;

    document.getElementById("btn-coach-record").onclick = startCoachRecording;
    document.getElementById("btn-coach-stop").onclick = stopCoachRecording;
    document.getElementById("btn-coach-play-feedback").onclick = playCoachFeedback;
    document.getElementById("btn-coach-reset").onclick = resetCoachState;
  }
}

// -----------------------
//  GO!
// -----------------------

renderApp();
