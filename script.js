// // ============================
// //  CONFIG: GEMINI API KEY
// // ============================
// const API_KEY = "AIzaSyBMGUCwBt7oVwWo-728kQ-KyaqaeuvtFsE"; // <-- put your real key here
// const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;


// // ============================
// //  GLOBAL STATE
// // ============================
// const gameState = {
//  currentPage: "home",
//  lives: 0,
//  currentBookId: null,
//  currentLineIndex: 0,
//  currentQuestionIndex: 0,
//  currentWordIndex: 0,
// };


// const mockBooks = {
//  book1: {
//    title: "The Little Red Fox",
//    lines: [
//      "The little red fox was very quick.",
//      "He saw a small bird on a green branch.",
//      "The bird sang a sweet and happy song.",
//      "The fox wanted to be friends with the bird.",
//    ],
//    comprehension: [
//      {
//        q: "What color was the fox?",
//        options: ["Red", "Brown", "Green", "Blue"],
//        answer: "Red",
//      },
//      {
//        q: "What did the fox see?",
//        options: ["A squirrel", "A fish", "A small bird", "A cat"],
//        answer: "A small bird",
//      },
//      {
//        q: "What did the fox want?",
//        options: ["To eat the bird", "To be friends", "To sleep", "To sing a song"],
//        answer: "To be friends",
//      },
//    ],
//  },
//  book2: {
//    title: "Tim's Big Trip",
//    lines: [
//      "Tim packed a bag for a big trip.",
//      "He put in a map, a snack, and a red ball.",
//      "The trip was to the tall mountains.",
//      "He hoped to see a bear.",
//    ],
//    comprehension: [
//      {
//        q: "What did Tim pack?",
//        options: ["A book", "A red ball", "A boat", "A doll"],
//        answer: "A red ball",
//      },
//      {
//        q: "Where was his trip?",
//        options: ["The beach", "The city", "The tall mountains", "The store"],
//        answer: "The tall mountains",
//      },
//    ],
//  },
//  book3: {
//    title: "The Lost Kite",
//    lines: [
//      "Ana had a bright yellow kite.",
//      "She flew it high in the park.",
//      "The wind was strong and the string broke.",
//      "The kite flew away and was lost.",
//      "Ana was sad but her dad gave her a hug.",
//    ],
//    comprehension: [
//      {
//        q: "What color was the kite?",
//        options: ["Red", "Blue", "Green", "Yellow"],
//        answer: "Yellow",
//      },
//      {
//        q: "Why was the kite lost?",
//        options: ["It rained", "A dog took it", "The string broke", "Ana let go"],
//        answer: "The string broke",
//      },
//      {
//        q: "How did Ana feel?",
//        options: ["Happy", "Sad", "Angry", "Tired"],
//        answer: "Sad",
//      },
//    ],
//  },
// };


// // DOM references & game objects will be set in initApp
// let pages;
// let dom;
// let ctx;
// let game;
// let gameLoopId = null;


// // ============================
// //  PAGE + UI HELPERS
// // ============================
// function showPage(pageId) {
//  Object.values(pages).forEach((page) => page.classList.remove("active"));
//  pages[pageId].classList.add("active");
//  gameState.currentPage = pageId;


//  if (pageId === "game") {
//    startGame();
//  } else {
//    stopGame();
//  }
// }


// function updateLivesDisplay() {
//  dom.livesCounter.textContent = gameState.lives;
// }


// function setupLibrary() {
//  dom.libraryGrid.innerHTML = "";
//  Object.keys(mockBooks).forEach((bookId) => {
//    const book = mockBooks[bookId];
//    const button = document.createElement("button");
//    button.className =
//      "bg-white hover:bg-amber-100 text-sky-700 text-2xl font-bold py-10 px-6 rounded-lg shadow-lg transition duration-300 transform hover:scale-105";
//    button.textContent = book.title;
//    button.onclick = () => startBook(bookId);
//    dom.libraryGrid.appendChild(button);
//  });
// }


// function startBook(bookId) {
//  gameState.currentBookId = bookId;
//  gameState.currentLineIndex = 0;
//  gameState.currentWordIndex = 0;


//  dom.readerTitle.textContent = mockBooks[bookId].title;
//  loadReaderLine();
//  showPage("reader");
// }


// function loadReaderLine() {
//  const book = mockBooks[gameState.currentBookId];
//  if (gameState.currentLineIndex >= book.lines.length) {
//    startQuiz();
//    return;
//  }


//  const line = book.lines[gameState.currentLineIndex];
//  gameState.currentWordIndex = 0;
//  displayStyledLine(line);
// }


// function displayStyledLine(lineText) {
//  const words = lineText.split(" ");


//  const html = words
//    .map((word, index) => {
//      let className = "word-unread";
//      if (index < gameState.currentWordIndex) {
//        className = "word-read";
//      } else if (index === gameState.currentWordIndex) {
//        className = "word-current";
//      }
//      return `<span class="${className}">${word}</span>`;
//    })
//    .join(" ");


//  dom.readerLineDisplay.innerHTML = html;


//  const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];
//  dom.readerContent.textContent = line;
// }


// // ============================
// //  GEMINI MISCUE ANALYSIS
// // ============================
// async function callGeminiForMiscueAnalysis(spokenText, correctText) {
//  const prompt = `
// System: You are an expert reading tutor AI based on the "Science of Reading".
// Analyze the student's oral reading attempt against the correct text.


// The student read: "${spokenText}"
// The correct text is: "${correctText}"


// Identify the first significant miscue (e.g., substitution, omission, insertion, mispronunciation).


// If there is NO miscue, respond with:
// {"isCorrect": true}


// If there IS a miscue:
// 1. Identify the incorrect word ("miscue") and the correct "word".
// 2. Provide a simple phonetic breakdown ("phonemes") for the correct word.
// 3. Provide a brief, encouraging feedback "script".


// Respond ONLY with a valid JSON object.


// Example (miscue):
// {
//  "isCorrect": false,
//  "word": "wait",
//  "miscue": "want",
//  "phonemes": "/w/ /ai/ /t/",
//  "script": "Close! You said 'want'. This word is 'wait'. Let's sound it out: /w/ /ai/ /t/. Wait. You try!"
// }


// Example (correct):
// {"isCorrect": true}
// `.trim();


//  const payload = {
//    contents: [{ parts: [{ text: prompt }] }],
//  };


//  try {
//    const response = await fetch(API_URL, {
//      method: "POST",
//      headers: { "Content-Type": "application/json" },
//      body: JSON.stringify(payload),
//    });


//    if (!response.ok) {
//      throw new Error(`API Error: ${response.status} ${response.statusText}`);
//    }


//    const result = await response.json();


//    if (!result.candidates || !result.candidates.length) {
//      throw new Error("No candidates in Gemini response");
//    }


//    const candidate = result.candidates[0];
//    let textPart = null;


//    if (
//      candidate.content &&
//      candidate.content.parts &&
//      candidate.content.parts.length &&
//      candidate.content.parts[0].text
//    ) {
//      textPart = candidate.content.parts[0].text;
//    } else if (candidate.output_text) {
//      textPart = candidate.output_text;
//    } else {
//      throw new Error("Unexpected Gemini response structure");
//    }


//    const jsonString = textPart
//      .replace(/```json/g, "")
//      .replace(/```/g, "")
//      .trim();


//    return JSON.parse(jsonString);
//  } catch (error) {
//    console.error("Gemini API call failed, using mock fallback:", error);
//    return mockGeminiResponse(spokenText, correctText);
//  }
// }


// function mockGeminiResponse(spokenText, correctText) {
//  const correctWords = correctText.split(" ");


//  if (spokenText === "simulate_error") {
//    const word = correctWords[Math.floor(Math.random() * correctWords.length)];
//    let miscue = "want";
//    if (word === "quick") miscue = "quack";
//    if (word === "bird") miscue = "beard";
//    if (word === "strong") miscue = "string";


//    return {
//      isCorrect: false,
//      word: word,
//      miscue: miscue,
//      phonemes: "/.../",
//      script: `Close! You said '${miscue}'. This word is '${word}'. Let's try that word again: ${word}.`,
//    };
//  }


//  return { isCorrect: true };
// }


// // ============================
// //  READER BUTTON HANDLERS
// // ============================
// async function handleCorrectRead() {
//  const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


//  dom.btnReadCorrectly.disabled = true;
//  dom.btnReadCorrectly.textContent = "Checking...";


//  const analysis = await callGeminiForMiscueAnalysis(line, line);


//  dom.btnReadCorrectly.disabled = false;
//  dom.btnReadCorrectly.textContent = "I read it! (Next)";


//  if (analysis.isCorrect) {
//    gameState.currentLineIndex++;
//    loadReaderLine();
//  } else {
//    showFeedbackModal(analysis);
//  }
// }


// async function handleSimulateMiscue() {
//  const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


//  dom.btnSimulateMiscue.disabled = true;
//  dom.btnSimulateMiscue.textContent = "Analyzing...";


//  const analysis = await callGeminiForMiscueAnalysis("simulate_error", line);


//  dom.btnSimulateMiscue.disabled = false;
//  dom.btnSimulateMiscue.textContent = "Simulate Mistake (Gemini)";


//  if (!analysis.isCorrect) {
//    showFeedbackModal(analysis);
//  }
// }


// // ============================
// //  FEEDBACK MODAL
// // ============================
// function showFeedbackModal(analysis) {
//  const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


//  // Highlight the correct target word
//  const highlightedLine = line.replace(
//    analysis.word,
//    `<span class="word-error">${analysis.word}</span>`
//  );
//  dom.readerContent.innerHTML = highlightedLine;


//  dom.feedbackContent.innerHTML = `
//    <p class="mb-4">${analysis.script}</p>
//    <p>You read: <span class="font-semibold text-rose-500">${analysis.miscue}</span></p>
//    <p>The word is: <span class="font-semibold text-green-600">${analysis.word}</span></p>
//  `;
//  dom.feedbackModal.style.display = "flex";
// }


// function hideFeedbackModal() {
//  dom.feedbackModal.style.display = "none";
//  gameState.currentLineIndex++;
//  loadReaderLine();
// }


// // ============================
// //  QUIZ / COMPREHENSION
// // ============================
// function startQuiz() {
//  gameState.currentQuestionIndex = 0;
//  loadQuestion();
//  showPage("quiz");
// }


// function loadQuestion() {
//  const book = mockBooks[gameState.currentBookId];


//  if (gameState.currentQuestionIndex >= book.comprehension.length) {
//    completeBook();
//    return;
//  }


//  const qData = book.comprehension[gameState.currentQuestionIndex];


//  dom.quizQuestion.textContent = qData.q;
//  dom.quizOptions.innerHTML = "";
//  dom.quizFeedback.textContent = "";


//  qData.options.forEach((option) => {
//    const button = document.createElement("button");
//    button.className =
//      "w-full bg-sky-100 hover:bg-sky-200 text-sky-800 text-xl font-semibold py-4 px-6 rounded-lg shadow-md transition duration-300";
//    button.textContent = option;
//    button.onclick = () => handleQuizAnswer(option, qData.answer);
//    dom.quizOptions.appendChild(button);
//  });
// }


// function handleQuizAnswer(selectedOption, correctAnswer) {
//  if (selectedOption === correctAnswer) {
//    dom.quizFeedback.textContent = "Great job! That's correct!";
//    dom.quizFeedback.className =
//      "text-xl font-semibold min-h-[30px] text-green-600";
//  } else {
//    dom.quizFeedback.textContent = `Not quite. The correct answer was "${correctAnswer}".`;
//    dom.quizFeedback.className =
//      "text-xl font-semibold min-h-[30px] text-red-500";
//  }


//  Array.from(dom.quizOptions.children).forEach((button) => {
//    button.disabled = true;
//  });


//  setTimeout(() => {
//    gameState.currentQuestionIndex++;
//    loadQuestion();
//  }, 2000);
// }


// function completeBook() {
//  gameState.lives += 2;
//  updateLivesDisplay();
//  showPage("game");
// }


// // ============================
// //  PLATFORMER GAME
// // ============================
// function initGame() {
//  ctx = dom.gameCanvas.getContext("2d");


//  game = {
//    player: {
//      x: 50,
//      y: 50,
//      width: 30,
//      height: 30,
//      dx: 0,
//      dy: 0,
//      speed: 5,
//      jumpPower: 12,
//      onGround: false,
//    },
//    platforms: [
//      { x: 0, y: 480, width: 800, height: 20 },
//      { x: 150, y: 410, width: 100, height: 20 },
//      { x: 300, y: 340, width: 100, height: 20 },
//      { x: 450, y: 270, width: 100, height: 20 },
//      { x: 300, y: 180, width: 100, height: 20 },
//      { x: 150, y: 110, width: 100, height: 20 },
//    ],
//    keys: {},
//    gravity: 0.6,
//    friction: 0.8,
//  };


//  window.addEventListener("keydown", (e) => {
//    game.keys[e.key] = true;
//  });
//  window.addEventListener("keyup", (e) => {
//    game.keys[e.key] = false;
//  });
// }


// function startGame() {
//  if (!game) {
//    initGame();
//  }
//  resetPlayer();


//  if (!gameLoopId) {
//    gameLoopId = requestAnimationFrame(gameLoop);
//  }
// }


// function stopGame() {
//  if (gameLoopId) {
//    cancelAnimationFrame(gameLoopId);
//    gameLoopId = null;
//  }
// }


// function resetPlayer() {
//  game.player.x = 50;
//  game.player.y = 50;
//  game.player.dy = 0;
// }


// function gameLoop() {
//  updatePlayer();
//  draw();
//  checkDeath();


//  if (gameLoopId) {
//    gameLoopId = requestAnimationFrame(gameLoop);
//  }
// }


// function updatePlayer() {
//  const p = game.player;


//  // Horizontal movement
//  if (game.keys["a"] || game.keys["ArrowLeft"]) {
//    p.dx = -p.speed;
//  } else if (game.keys["d"] || game.keys["ArrowRight"]) {
//    p.dx = p.speed;
//  } else {
//    p.dx = 0;
//  }


//  // Jump
//  if ((game.keys["w"] || game.keys["ArrowUp"] || game.keys[" "]) && p.onGround) {
//    p.dy = -p.jumpPower;
//    p.onGround = false;
//  }


//  // Gravity
//  p.dy += game.gravity;


//  // Apply velocity
//  p.x += p.dx;
//  p.y += p.dy;


//  p.onGround = false;


//  // Platform collisions
//  game.platforms.forEach((platform) => {
//    if (
//      p.x < platform.x + platform.width &&
//      p.x + p.width > platform.x &&
//      p.y < platform.y + platform.height &&
//      p.y + p.height > platform.y
//    ) {
//      // Coming down onto platform
//      if (p.dy > 0 && p.y + p.height - p.dy <= platform.y) {
//        p.y = platform.y - p.height;
//        p.dy = 0;
//        p.onGround = true;
//      }
//    }
//  });


//  // Horizontal bounds
//  if (p.x < 0) p.x = 0;
//  if (p.x + p.width > dom.gameCanvas.width) {
//    p.x = dom.gameCanvas.width - p.width;
//  }
// }


// function draw() {
//  ctx.clearRect(0, 0, dom.gameCanvas.width, dom.gameCanvas.height);


//  // Player
//  ctx.fillStyle = "#0284c7";
//  const p = game.player;
//  ctx.fillRect(p.x, p.y, p.width, p.height);


//  // Platforms
//  ctx.fillStyle = "#4ade80";
//  game.platforms.forEach((platform) => {
//    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
//  });
// }


// function checkDeath() {
//  if (game.player.y > dom.gameCanvas.height) {
//    gameState.lives--;
//    updateLivesDisplay();


//    if (gameState.lives <= 0) {
//      stopGame();
//      showPage("home");
//    } else {
//      resetPlayer();
//    }
//  }
// }


// // ============================
// //  APP INITIALIZATION
// // ============================
// function initApp() {
//  // Cache DOM elements
//  pages = {
//    home: document.getElementById("page-home"),
//    library: document.getElementById("page-library"),
//    reader: document.getElementById("page-reader"),
//    quiz: document.getElementById("page-quiz"),
//    game: document.getElementById("page-game"),
//  };


//  dom = {
//    livesCounter: document.getElementById("lives-counter"),


//    btnGotoLibrary: document.getElementById("btn-goto-library"),
//    btnLibraryBack: document.getElementById("btn-library-back"),


//    libraryGrid: document.getElementById("library-grid"),


//    readerTitle: document.getElementById("reader-title"),
//    readerContent: document.getElementById("reader-content"),
//    readerLineDisplay: document.getElementById("reader-line-display"),
//    btnReadCorrectly: document.getElementById("btn-read-correctly"),
//    btnSimulateMiscue: document.getElementById("btn-simulate-miscue"),


//    feedbackModal: document.getElementById("feedback-modal"),
//    feedbackContent: document.getElementById("feedback-content"),
//    btnModalContinue: document.getElementById("btn-modal-continue"),


//    quizQuestion: document.getElementById("quiz-question"),
//    quizOptions: document.getElementById("quiz-options"),
//    quizFeedback: document.getElementById("quiz-feedback"),


//    gameCanvas: document.getElementById("game-canvas"),
//    btnQuitGame: document.getElementById("btn-quit-game"),
//  };


//  // Wire up buttons
//  dom.btnGotoLibrary.onclick = () => showPage("library");
//  dom.btnLibraryBack.onclick = () => showPage("home");


//  dom.btnReadCorrectly.onclick = handleCorrectRead;
//  dom.btnSimulateMiscue.onclick = handleSimulateMiscue;


//  dom.btnModalContinue.onclick = hideFeedbackModal;


//  dom.btnQuitGame.onclick = () => {
//    stopGame();
//    showPage("home");
//  };


//  // Initial state
//  updateLivesDisplay();
//  setupLibrary();
//  showPage("home");
// }


// // Start when DOM is ready (script loaded with defer)
// window.addEventListener("load", initApp);
// --- Global Variables provided by the Canvas Environment ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase CDN Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Gemini API Call Setup ---
const API_KEY = ""; // Canvas will inject the key at runtime
const MODEL_TTS = "gemini-2.5-flash-preview-tts";
const API_URL_TTS = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TTS}:generateContent?key=${API_KEY}`;

// --- DOM Elements ---
const headerTitle = document.getElementById('header-title');
const backButton = document.getElementById('back-button');
const viewContainer = document.getElementById('view-container');
const ttsControls = document.getElementById('tts-controls');
const ttsButton = document.getElementById('tts-button');
const ttsButtonText = document.getElementById('tts-button-text');
const messageBox = document.getElementById('message-box');
const loadingSpinner = document.getElementById('loading-spinner');

// --- State Variables ---
let db;
let auth;
let currentView = 'library'; 
let selectedBookFile = null;
let currentBookTitle = '';
let currentBookContent = []; // Array of sentences
let currentAudio = null;
let isPlaying = false;
let currentSentenceIndex = 0;
let maxRetries = 3;

// Map of available books 
const availableBooks = {
    "book 1.pdf": { title: "Why Is It So Hot Today?", theme: "Animals & Weather", color: 'bg-yellow-400' },
    "book 2.pdf": { title: "Saving the Moon", theme: "Adventure & Friendship", color: 'bg-blue-400' },
    "book3.pdf": { title: "Dive!", theme: "Ocean & Science", color: 'bg-green-400' },
    "book 4.pdf": { title: "My Dream City", theme: "Community & Planning", color: 'bg-pink-400' }
};

// ----------------------------------------------------------------------
// --- Utility Functions (WAV Conversion) ---
// ----------------------------------------------------------------------

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/** Converts raw 16-bit PCM audio data into a standard WAV file format Blob. */
function pcmToWav(pcm16, sampleRate = 24000) {
    const buffer = new ArrayBuffer(44 + pcm16.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16.length * 2, true);
    writeString(view, 8, 'WAVE');
    
    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    
    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcm16.length * 2, true);

    // Write the PCM data
    for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(44 + i * 2, pcm16[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

// ----------------------------------------------------------------------
// --- UI Feedback Functions ---
// ----------------------------------------------------------------------

function showMessage(message, isError = true) {
    messageBox.textContent = message;
    messageBox.className = isError 
        ? "mt-4 p-3 bg-red-200 text-red-800 rounded-xl" 
        : "mt-4 p-3 bg-secondary/30 text-primary rounded-xl font-medium";
    messageBox.classList.remove('hidden');
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

function setLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove('hidden');
        ttsButton.disabled = true;
    } else {
        loadingSpinner.classList.add('hidden');
        // Only enable TTS button in reader view if content is loaded
        if (currentBookContent.length > 0 && currentView === 'reader') {
            ttsButton.disabled = false;
        }
    }
}

// ----------------------------------------------------------------------
// --- View Rendering ---
// ----------------------------------------------------------------------

function renderLibraryView() {
    headerTitle.textContent = 'Welcome to the Story Hub!';
    backButton.classList.add('hidden');
    ttsControls.classList.add('hidden');
    
    let html = `
        <div class="p-4">
            <h2 class="text-3xl font-display text-primary mb-6 text-center tracking-wide">Choose Your Adventure!</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
    `;
    
    Object.keys(availableBooks).forEach(file => {
        const book = availableBooks[file];
        const bgClass = book.color;

        // Use window.handleBookSelection for click handler
        html += `
            <div class="book-card p-2 rounded-2xl border-4 border-black ${bgClass} shadow-xl transform hover:scale-[1.05] active:scale-100" 
                 onclick="window.handleBookSelection('${file}')">
                <div class="w-full aspect-[3/4] rounded-lg shadow-inner flex flex-col items-center justify-center p-4 bg-white/70">
                    <span class="text-4xl font-extrabold font-display text-primary leading-none text-center">${book.title.split(' ').map(w => w[0]).join('')}</span>
                    <p class="text-xs mt-2 text-gray-700 font-semibold uppercase">${book.theme}</p>
                </div>
                <h3 class="text-lg font-bold text-gray-800 leading-tight mt-3 mb-1 text-center">${book.title}</h3>
                <p class="text-sm text-gray-600 font-medium text-center">${book.theme}</p>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    viewContainer.innerHTML = html;
}

function renderReaderView() {
    headerTitle.textContent = currentBookTitle || 'Story Time';
    backButton.classList.remove('hidden');
    ttsControls.classList.remove('hidden');
    
    viewContainer.innerHTML = `
        <div id="reader-content" class="p-4 bg-white rounded-lg shadow-inner">
            ${currentBookContent.length === 0 
                ? '<p class="text-center text-primary italic mt-10 font-bold">Just a moment! Loading the text...</p>'
                : currentBookContent.map((sentence, index) => 
                    `<p id="sentence-${index}" class="py-1 mb-1">${sentence}</p>`
                ).join('')
            }
        </div>
    `;
    
    // Set button to initial "Start Reading" state
    ttsButtonText.textContent = "Start Reading";
    ttsButton.classList.remove('bg-red-500', 'hover:bg-red-600');
    ttsButton.classList.add('bg-accent-green', 'hover:bg-green-600', 'animate-pulse-light');
    ttsButton.disabled = currentBookContent.length === 0;
}

/** Handles view switching and triggers rendering. */
function navigate(newView) {
    if (newView === 'library') {
        stopReading(false); 
        hideMessage();
    }
    currentView = newView;
    updateView();
}
window.navigate = navigate; // EXPOSE globally for index.html button

function updateView() {
    viewContainer.scrollTop = 0; // Scroll to top on view switch
    if (currentView === 'library') {
        renderLibraryView();
    } else {
        renderReaderView();
    }
}


// ----------------------------------------------------------------------
// --- Book Loading and TTS Logic ---
// ----------------------------------------------------------------------

async function handleBookSelection(fileName) {
    navigate('reader');
    selectedBookFile = fileName;
    currentBookTitle = availableBooks[fileName].title;
    currentSentenceIndex = 0;
    currentBookContent = [];

    // Show loading state immediately
    renderReaderView(); 
    hideMessage();
    setLoading(true);

    currentBookContent = await fetchBookContent(selectedBookFile);
    
    if (currentBookContent.length > 0) {
        renderReaderView(); // Final render with content
        showMessage(`Story: ${currentBookTitle} is ready! Tap 'Start Reading' below.`, false);
    } else {
        renderReaderView();
        showMessage("I couldn't find the story content. Please go back and try another book.", true);
    }
    setLoading(false);
}
window.handleBookSelection = handleBookSelection; // EXPOSE globally for book cards

async function fetchBookContent(fileName) {
    const contentFetchId = `uploaded:${fileName}`;
    try {
        const response = await fetch('/api/file_contents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentFetchId: contentFetchId })
        });
        const data = await response.json();
        
        let fullText = data.content;
        // Clean up file markers
        fullText = fullText.replace(/\[Image \d+\]/g, ' ');
        fullText = fullText.replace(/--- PAGE \d+ ---/g, ' ');
        fullText = fullText.replace(/<br\s*\/>/g, ' ');
        fullText = fullText.replace(/(\r\n|\n|\r)/gm, ' ');
        fullText = fullText.replace(/\s+/g, ' ').trim();
        
        // Split into sentences
        const sentences = fullText.match(/[^.!?]+[.!?]|\n/g) || [];
        
        return sentences
            .map(s => s.trim())
            .filter(s => s.length > 1);

    } catch (error) {
        console.error("Error fetching book content:", error);
        showMessage(`Loading Error: ${error.message}`, true);
        return [];
    }
}

/** Recursive function to fetch and play audio for one sentence at a time. */
async function fetchAndPlaySentence(index, retryCount = 0) {
    if (!isPlaying || index >= currentBookContent.length) {
        stopReading(true);
        return;
    }
    
    const sentence = currentBookContent[index];
    const activeSentenceElement = document.getElementById(`sentence-${index}`);

    if (activeSentenceElement) {
        // Highlight the currently reading sentence
        document.querySelectorAll('#reader-content .reading-highlight').forEach(el => el.classList.remove('reading-highlight'));
        activeSentenceElement.classList.add('reading-highlight');
        activeSentenceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const payload = {
        contents: [{ parts: [{ text: sentence }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Achird" } } // Friendly voice
            }
        },
    };

    try {
        const response = await fetch(API_URL_TTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType; 
        
        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
            
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            
            // Clean up old audio before creating new one
            if (currentAudio) {
                currentAudio.pause();
                URL.revokeObjectURL(currentAudio.src); 
            }
            
            currentAudio = new Audio(URL.createObjectURL(wavBlob));
            currentAudio.play();
            
            currentAudio.onended = () => {
                currentSentenceIndex++;
                fetchAndPlaySentence(currentSentenceIndex); // Play next sentence
            };

            currentAudio.onerror = (e) => {
                console.error("Audio playback error, skipping sentence:", e);
                currentSentenceIndex++;
                fetchAndPlaySentence(currentSentenceIndex);
            };

        } else {
            throw new Error("Invalid TTS response or missing audio data.");
        }

    } catch (error) {
        console.error(`TTS API Error for sentence ${index}:`, error);
        if (retryCount < maxRetries) {
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            fetchAndPlaySentence(index, retryCount + 1);
        } else {
            showMessage(`Speech generation failed after multiple tries. Skipping sentence.`, true);
            currentSentenceIndex++;
            fetchAndPlaySentence(currentSentenceIndex); 
        }
    }
}

/** Toggles between starting and stopping the reading process. */
function toggleReading() {
    if (isPlaying) {
        stopReading();
    } else {
        startReading();
    }
}

function startReading() {
    if (currentBookContent.length === 0) {
        showMessage("The story is empty. Try selecting another book.", true);
        return;
    }
    
    isPlaying = true;
    ttsButtonText.textContent = "Stop Reading";
    ttsButton.classList.remove('bg-accent-green', 'animate-pulse-light', 'hover:bg-green-600');
    ttsButton.classList.add('bg-red-500', 'hover:bg-red-600');
    hideMessage();
    
    fetchAndPlaySentence(currentSentenceIndex);
}

function stopReading(isEndOfBook = false) {
    isPlaying = false;
    
    // Clean up audio
    if (currentAudio) {
        currentAudio.pause();
        URL.revokeObjectURL(currentAudio.src);
        currentAudio = null;
    }
    
    // Remove all sentence highlights
    document.querySelectorAll('#reader-content .reading-highlight').forEach(el => el.classList.remove('reading-highlight'));

    if (isEndOfBook) {
        ttsButtonText.textContent = "Read Again";
        currentSentenceIndex = 0;
        showMessage("Great job! You finished the story!", false);
    } else {
        ttsButtonText.textContent = "Resume Reading";
        showMessage("Reading is paused. Tap 'Resume Reading' to continue.", false);
    }

    ttsButton.classList.remove('bg-red-500', 'hover:bg-red-600');
    ttsButton.classList.add('bg-accent-green', 'hover:bg-green-600', 'animate-pulse-light');
}


// ----------------------------------------------------------------------
// --- Initialization ---
// ----------------------------------------------------------------------

async function firebaseInit() {
    setLogLevel('debug');
    if (!firebaseConfig) return;
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User authenticated or anonymous user created
        }
    });
    
    try {
         if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
         } else {
            await signInAnonymously(auth);
         }
    } catch (e) {
        console.error("Initial auth attempt failed.", e);
    }
}

// Attach event listeners
ttsButton.addEventListener('click', toggleReading);

// Start the application after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    firebaseInit();
    updateView(); // Start on the Library View
});


