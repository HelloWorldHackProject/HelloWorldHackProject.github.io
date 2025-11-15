// ============================
//  CONFIG: GEMINI API KEY
// ============================
const API_KEY = "AIzaSyBMGUCwBt7oVwWo-728kQ-KyaqaeuvtFsE"; // <-- put your real key here
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;


// ============================
//  GLOBAL STATE
// ============================
const gameState = {
 currentPage: "home",
 lives: 0,
 currentBookId: null,
 currentLineIndex: 0,
 currentQuestionIndex: 0,
 currentWordIndex: 0,
};


const mockBooks = {
 book1: {
   title: "The Little Red Fox",
   lines: [
     "The little red fox was very quick.",
     "He saw a small bird on a green branch.",
     "The bird sang a sweet and happy song.",
     "The fox wanted to be friends with the bird.",
   ],
   comprehension: [
     {
       q: "What color was the fox?",
       options: ["Red", "Brown", "Green", "Blue"],
       answer: "Red",
     },
     {
       q: "What did the fox see?",
       options: ["A squirrel", "A fish", "A small bird", "A cat"],
       answer: "A small bird",
     },
     {
       q: "What did the fox want?",
       options: ["To eat the bird", "To be friends", "To sleep", "To sing a song"],
       answer: "To be friends",
     },
   ],
 },
 book2: {
   title: "Tim's Big Trip",
   lines: [
     "Tim packed a bag for a big trip.",
     "He put in a map, a snack, and a red ball.",
     "The trip was to the tall mountains.",
     "He hoped to see a bear.",
   ],
   comprehension: [
     {
       q: "What did Tim pack?",
       options: ["A book", "A red ball", "A boat", "A doll"],
       answer: "A red ball",
     },
     {
       q: "Where was his trip?",
       options: ["The beach", "The city", "The tall mountains", "The store"],
       answer: "The tall mountains",
     },
   ],
 },
 book3: {
   title: "The Lost Kite",
   lines: [
     "Ana had a bright yellow kite.",
     "She flew it high in the park.",
     "The wind was strong and the string broke.",
     "The kite flew away and was lost.",
     "Ana was sad but her dad gave her a hug.",
   ],
   comprehension: [
     {
       q: "What color was the kite?",
       options: ["Red", "Blue", "Green", "Yellow"],
       answer: "Yellow",
     },
     {
       q: "Why was the kite lost?",
       options: ["It rained", "A dog took it", "The string broke", "Ana let go"],
       answer: "The string broke",
     },
     {
       q: "How did Ana feel?",
       options: ["Happy", "Sad", "Angry", "Tired"],
       answer: "Sad",
     },
   ],
 },
};


// DOM references & game objects will be set in initApp
let pages;
let dom;
let ctx;
let game;
let gameLoopId = null;


// ============================
//  PAGE + UI HELPERS
// ============================
function showPage(pageId) {
 Object.values(pages).forEach((page) => page.classList.remove("active"));
 pages[pageId].classList.add("active");
 gameState.currentPage = pageId;


 if (pageId === "game") {
   startGame();
 } else {
   stopGame();
 }
}


function updateLivesDisplay() {
 dom.livesCounter.textContent = gameState.lives;
}


function setupLibrary() {
 dom.libraryGrid.innerHTML = "";
 Object.keys(mockBooks).forEach((bookId) => {
   const book = mockBooks[bookId];
   const button = document.createElement("button");
   button.className =
     "bg-white hover:bg-amber-100 text-sky-700 text-2xl font-bold py-10 px-6 rounded-lg shadow-lg transition duration-300 transform hover:scale-105";
   button.textContent = book.title;
   button.onclick = () => startBook(bookId);
   dom.libraryGrid.appendChild(button);
 });
}


function startBook(bookId) {
 gameState.currentBookId = bookId;
 gameState.currentLineIndex = 0;
 gameState.currentWordIndex = 0;


 dom.readerTitle.textContent = mockBooks[bookId].title;
 loadReaderLine();
 showPage("reader");
}


function loadReaderLine() {
 const book = mockBooks[gameState.currentBookId];
 if (gameState.currentLineIndex >= book.lines.length) {
   startQuiz();
   return;
 }


 const line = book.lines[gameState.currentLineIndex];
 gameState.currentWordIndex = 0;
 displayStyledLine(line);
}


function displayStyledLine(lineText) {
 const words = lineText.split(" ");


 const html = words
   .map((word, index) => {
     let className = "word-unread";
     if (index < gameState.currentWordIndex) {
       className = "word-read";
     } else if (index === gameState.currentWordIndex) {
       className = "word-current";
     }
     return `<span class="${className}">${word}</span>`;
   })
   .join(" ");


 dom.readerLineDisplay.innerHTML = html;


 const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];
 dom.readerContent.textContent = line;
}


// ============================
//  GEMINI MISCUE ANALYSIS
// ============================
async function callGeminiForMiscueAnalysis(spokenText, correctText) {
 const prompt = `
System: You are an expert reading tutor AI based on the "Science of Reading".
Analyze the student's oral reading attempt against the correct text.


The student read: "${spokenText}"
The correct text is: "${correctText}"


Identify the first significant miscue (e.g., substitution, omission, insertion, mispronunciation).


If there is NO miscue, respond with:
{"isCorrect": true}


If there IS a miscue:
1. Identify the incorrect word ("miscue") and the correct "word".
2. Provide a simple phonetic breakdown ("phonemes") for the correct word.
3. Provide a brief, encouraging feedback "script".


Respond ONLY with a valid JSON object.


Example (miscue):
{
 "isCorrect": false,
 "word": "wait",
 "miscue": "want",
 "phonemes": "/w/ /ai/ /t/",
 "script": "Close! You said 'want'. This word is 'wait'. Let's sound it out: /w/ /ai/ /t/. Wait. You try!"
}


Example (correct):
{"isCorrect": true}
`.trim();


 const payload = {
   contents: [{ parts: [{ text: prompt }] }],
 };


 try {
   const response = await fetch(API_URL, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(payload),
   });


   if (!response.ok) {
     throw new Error(`API Error: ${response.status} ${response.statusText}`);
   }


   const result = await response.json();


   if (!result.candidates || !result.candidates.length) {
     throw new Error("No candidates in Gemini response");
   }


   const candidate = result.candidates[0];
   let textPart = null;


   if (
     candidate.content &&
     candidate.content.parts &&
     candidate.content.parts.length &&
     candidate.content.parts[0].text
   ) {
     textPart = candidate.content.parts[0].text;
   } else if (candidate.output_text) {
     textPart = candidate.output_text;
   } else {
     throw new Error("Unexpected Gemini response structure");
   }


   const jsonString = textPart
     .replace(/```json/g, "")
     .replace(/```/g, "")
     .trim();


   return JSON.parse(jsonString);
 } catch (error) {
   console.error("Gemini API call failed, using mock fallback:", error);
   return mockGeminiResponse(spokenText, correctText);
 }
}


function mockGeminiResponse(spokenText, correctText) {
 const correctWords = correctText.split(" ");


 if (spokenText === "simulate_error") {
   const word = correctWords[Math.floor(Math.random() * correctWords.length)];
   let miscue = "want";
   if (word === "quick") miscue = "quack";
   if (word === "bird") miscue = "beard";
   if (word === "strong") miscue = "string";


   return {
     isCorrect: false,
     word: word,
     miscue: miscue,
     phonemes: "/.../",
     script: `Close! You said '${miscue}'. This word is '${word}'. Let's try that word again: ${word}.`,
   };
 }


 return { isCorrect: true };
}


// ============================
//  READER BUTTON HANDLERS
// ============================
async function handleCorrectRead() {
 const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


 dom.btnReadCorrectly.disabled = true;
 dom.btnReadCorrectly.textContent = "Checking...";


 const analysis = await callGeminiForMiscueAnalysis(line, line);


 dom.btnReadCorrectly.disabled = false;
 dom.btnReadCorrectly.textContent = "I read it! (Next)";


 if (analysis.isCorrect) {
   gameState.currentLineIndex++;
   loadReaderLine();
 } else {
   showFeedbackModal(analysis);
 }
}


async function handleSimulateMiscue() {
 const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


 dom.btnSimulateMiscue.disabled = true;
 dom.btnSimulateMiscue.textContent = "Analyzing...";


 const analysis = await callGeminiForMiscueAnalysis("simulate_error", line);


 dom.btnSimulateMiscue.disabled = false;
 dom.btnSimulateMiscue.textContent = "Simulate Mistake (Gemini)";


 if (!analysis.isCorrect) {
   showFeedbackModal(analysis);
 }
}


// ============================
//  FEEDBACK MODAL
// ============================
function showFeedbackModal(analysis) {
 const line = mockBooks[gameState.currentBookId].lines[gameState.currentLineIndex];


 // Highlight the correct target word
 const highlightedLine = line.replace(
   analysis.word,
   `<span class="word-error">${analysis.word}</span>`
 );
 dom.readerContent.innerHTML = highlightedLine;


 dom.feedbackContent.innerHTML = `
   <p class="mb-4">${analysis.script}</p>
   <p>You read: <span class="font-semibold text-rose-500">${analysis.miscue}</span></p>
   <p>The word is: <span class="font-semibold text-green-600">${analysis.word}</span></p>
 `;
 dom.feedbackModal.style.display = "flex";
}


function hideFeedbackModal() {
 dom.feedbackModal.style.display = "none";
 gameState.currentLineIndex++;
 loadReaderLine();
}


// ============================
//  QUIZ / COMPREHENSION
// ============================
function startQuiz() {
 gameState.currentQuestionIndex = 0;
 loadQuestion();
 showPage("quiz");
}


function loadQuestion() {
 const book = mockBooks[gameState.currentBookId];


 if (gameState.currentQuestionIndex >= book.comprehension.length) {
   completeBook();
   return;
 }


 const qData = book.comprehension[gameState.currentQuestionIndex];


 dom.quizQuestion.textContent = qData.q;
 dom.quizOptions.innerHTML = "";
 dom.quizFeedback.textContent = "";


 qData.options.forEach((option) => {
   const button = document.createElement("button");
   button.className =
     "w-full bg-sky-100 hover:bg-sky-200 text-sky-800 text-xl font-semibold py-4 px-6 rounded-lg shadow-md transition duration-300";
   button.textContent = option;
   button.onclick = () => handleQuizAnswer(option, qData.answer);
   dom.quizOptions.appendChild(button);
 });
}


function handleQuizAnswer(selectedOption, correctAnswer) {
 if (selectedOption === correctAnswer) {
   dom.quizFeedback.textContent = "Great job! That's correct!";
   dom.quizFeedback.className =
     "text-xl font-semibold min-h-[30px] text-green-600";
 } else {
   dom.quizFeedback.textContent = `Not quite. The correct answer was "${correctAnswer}".`;
   dom.quizFeedback.className =
     "text-xl font-semibold min-h-[30px] text-red-500";
 }


 Array.from(dom.quizOptions.children).forEach((button) => {
   button.disabled = true;
 });


 setTimeout(() => {
   gameState.currentQuestionIndex++;
   loadQuestion();
 }, 2000);
}


function completeBook() {
 gameState.lives += 2;
 updateLivesDisplay();
 showPage("game");
}


// ============================
//  PLATFORMER GAME
// ============================
function initGame() {
 ctx = dom.gameCanvas.getContext("2d");


 game = {
   player: {
     x: 50,
     y: 50,
     width: 30,
     height: 30,
     dx: 0,
     dy: 0,
     speed: 5,
     jumpPower: 12,
     onGround: false,
   },
   platforms: [
     { x: 0, y: 480, width: 800, height: 20 },
     { x: 150, y: 410, width: 100, height: 20 },
     { x: 300, y: 340, width: 100, height: 20 },
     { x: 450, y: 270, width: 100, height: 20 },
     { x: 300, y: 180, width: 100, height: 20 },
     { x: 150, y: 110, width: 100, height: 20 },
   ],
   keys: {},
   gravity: 0.6,
   friction: 0.8,
 };


 window.addEventListener("keydown", (e) => {
   game.keys[e.key] = true;
 });
 window.addEventListener("keyup", (e) => {
   game.keys[e.key] = false;
 });
}


function startGame() {
 if (!game) {
   initGame();
 }
 resetPlayer();


 if (!gameLoopId) {
   gameLoopId = requestAnimationFrame(gameLoop);
 }
}


function stopGame() {
 if (gameLoopId) {
   cancelAnimationFrame(gameLoopId);
   gameLoopId = null;
 }
}


function resetPlayer() {
 game.player.x = 50;
 game.player.y = 50;
 game.player.dy = 0;
}


function gameLoop() {
 updatePlayer();
 draw();
 checkDeath();


 if (gameLoopId) {
   gameLoopId = requestAnimationFrame(gameLoop);
 }
}


function updatePlayer() {
 const p = game.player;


 // Horizontal movement
 if (game.keys["a"] || game.keys["ArrowLeft"]) {
   p.dx = -p.speed;
 } else if (game.keys["d"] || game.keys["ArrowRight"]) {
   p.dx = p.speed;
 } else {
   p.dx = 0;
 }


 // Jump
 if ((game.keys["w"] || game.keys["ArrowUp"] || game.keys[" "]) && p.onGround) {
   p.dy = -p.jumpPower;
   p.onGround = false;
 }


 // Gravity
 p.dy += game.gravity;


 // Apply velocity
 p.x += p.dx;
 p.y += p.dy;


 p.onGround = false;


 // Platform collisions
 game.platforms.forEach((platform) => {
   if (
     p.x < platform.x + platform.width &&
     p.x + p.width > platform.x &&
     p.y < platform.y + platform.height &&
     p.y + p.height > platform.y
   ) {
     // Coming down onto platform
     if (p.dy > 0 && p.y + p.height - p.dy <= platform.y) {
       p.y = platform.y - p.height;
       p.dy = 0;
       p.onGround = true;
     }
   }
 });


 // Horizontal bounds
 if (p.x < 0) p.x = 0;
 if (p.x + p.width > dom.gameCanvas.width) {
   p.x = dom.gameCanvas.width - p.width;
 }
}


function draw() {
 ctx.clearRect(0, 0, dom.gameCanvas.width, dom.gameCanvas.height);


 // Player
 ctx.fillStyle = "#0284c7";
 const p = game.player;
 ctx.fillRect(p.x, p.y, p.width, p.height);


 // Platforms
 ctx.fillStyle = "#4ade80";
 game.platforms.forEach((platform) => {
   ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
 });
}


function checkDeath() {
 if (game.player.y > dom.gameCanvas.height) {
   gameState.lives--;
   updateLivesDisplay();


   if (gameState.lives <= 0) {
     stopGame();
     showPage("home");
   } else {
     resetPlayer();
   }
 }
}


// ============================
//  APP INITIALIZATION
// ============================
function initApp() {
 // Cache DOM elements
 pages = {
   home: document.getElementById("page-home"),
   library: document.getElementById("page-library"),
   reader: document.getElementById("page-reader"),
   quiz: document.getElementById("page-quiz"),
   game: document.getElementById("page-game"),
 };


 dom = {
   livesCounter: document.getElementById("lives-counter"),


   btnGotoLibrary: document.getElementById("btn-goto-library"),
   btnLibraryBack: document.getElementById("btn-library-back"),


   libraryGrid: document.getElementById("library-grid"),


   readerTitle: document.getElementById("reader-title"),
   readerContent: document.getElementById("reader-content"),
   readerLineDisplay: document.getElementById("reader-line-display"),
   btnReadCorrectly: document.getElementById("btn-read-correctly"),
   btnSimulateMiscue: document.getElementById("btn-simulate-miscue"),


   feedbackModal: document.getElementById("feedback-modal"),
   feedbackContent: document.getElementById("feedback-content"),
   btnModalContinue: document.getElementById("btn-modal-continue"),


   quizQuestion: document.getElementById("quiz-question"),
   quizOptions: document.getElementById("quiz-options"),
   quizFeedback: document.getElementById("quiz-feedback"),


   gameCanvas: document.getElementById("game-canvas"),
   btnQuitGame: document.getElementById("btn-quit-game"),
 };


 // Wire up buttons
 dom.btnGotoLibrary.onclick = () => showPage("library");
 dom.btnLibraryBack.onclick = () => showPage("home");


 dom.btnReadCorrectly.onclick = handleCorrectRead;
 dom.btnSimulateMiscue.onclick = handleSimulateMiscue;


 dom.btnModalContinue.onclick = hideFeedbackModal;


 dom.btnQuitGame.onclick = () => {
   stopGame();
   showPage("home");
 };


 // Initial state
 updateLivesDisplay();
 setupLibrary();
 showPage("home");
}


// Start when DOM is ready (script loaded with defer)
window.addEventListener("load", initApp);



