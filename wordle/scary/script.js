const WORD_LENGTH = 5;
const Secret_Length = 3;
const NUMBER_OF_GUESSES = 6;
let currentRow = 0;
let currentGuess = [];
let wordOfTheDay = "MUNGE";
let isGameOver = false;
guessedWordsHistory = [];
let messageTimeout;
let acceptableWords = new Set();
let messageTimeoutId; 
let messageboxtime = 5000;
let isbuttonVisible = false; // Track if the button is visible



// Dummy word list for now. In a real app, fetch from an API or a larger file.
 WORD_LIST = [
"SCARY"
];

const messageContainer = document.getElementById('message-container');
const gameBoard = document.getElementById('game-board');
const keyboard = document.getElementById('keyboard');
const button = document.getElementById('nextButton');

async function loadWordList(filePath) {
    try {
        const response = await fetch(filePath); // Fetch the file
        if (!response.ok) { // Check if the request was successful
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text(); // Get the file content as text
        // Split the text into an array of words, trim whitespace, and filter out empty lines
        // Assuming one word per line in your txt file
        const words = text.split('\n').map(word => word.trim().toUpperCase()).filter(word => word.length > 0);
        return new Set(words); // Use a Set for very fast lookups
    } catch (error) {
        console.error("Error loading word list:", error);
        return new Set(); // Return an empty Set on error
    }
}
let fullscreen = false; // Track fullscreen state
async function initializeGame() {


    acceptableWords = await loadWordList('../wordlist.txt');
    currentRow = 0;
    currentGuess = [];
    isGameOver = false;
    messageContainer.textContent = '';
    wordOfTheDay = pickRandomWord().toUpperCase(); // Pick a random word from the list
    console.log("Word of the day (for testing):", wordOfTheDay); // For debugging
    createGameBoard();
    createKeyboard();
    document.addEventListener('keydown', handleKeyDown);


    //showButton("Start Game");


    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { // Firefox
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
        document.documentElement.msRequestFullscreen();
    }



    setTimeout(() => {

        if (document.fullscreenElement == null) {


            const overlay = document.createElement('div');
            overlay.id = 'fullscreen-overlay';
            overlay.innerHTML = `
        <p>Press 'ENTER' to go full screen.</p>
    `;
            document.body.appendChild(overlay);

            // Add an event listener to the document for the 'Enter' key
            document.addEventListener('keydown', blackImage);


        }
        else {
            fullscreen = true;
        }

    }, 100); 
  
}

function blackImage(event) {
    if (event.key === 'Enter') {

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { // Firefox
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
            document.documentElement.msRequestFullscreen();
        }


        // Remove the overlay and the event listener
        const overlay = document.getElementById('fullscreen-overlay');
        if (overlay) {
            overlay.remove();
        }
        document.removeEventListener('keydown', blackImage);

    }
}

function pickRandomWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

function createGameBoard() {
    console.log("creating");
    gameBoard.innerHTML = ''; // Clear previous board
    for (let i = 0; i < NUMBER_OF_GUESSES; i++) {
        const row = document.createElement('div');
        row.classList.add('word-row');


        const unusedleftContainer = document.createElement('div');
        unusedleftContainer.classList.add('unusedleft'); // Give it a class for styling

        for (let j = 0; j < Secret_Length; j++) {
            const box = document.createElement('div');
            box.classList.add('secretLetterBox');
            unusedleftContainer.appendChild(box); // Append to the new container
        }
        row.appendChild(unusedleftContainer);


        const mainBoxesContainer = document.createElement('div');
        mainBoxesContainer.classList.add('main-boxes-container'); // Give it a class for styling

        for (let j = 0; j < WORD_LENGTH; j++) {
            const box = document.createElement('div');
            box.classList.add('letter-box');
            mainBoxesContainer.appendChild(box); // Append to the new container
        }
        row.appendChild(mainBoxesContainer);


        const secretBoxesContainer = document.createElement('div');
        secretBoxesContainer.classList.add('secret-boxes-container'); // Give it a class for styling

        for (let j = 0; j < Secret_Length; j++) {
            const box = document.createElement('div');
            box.classList.add('secretLetterBox');
            secretBoxesContainer.appendChild(box); // Append to the new container
        }
        row.appendChild(secretBoxesContainer);

      
       
       
        
        gameBoard.appendChild(row);
    }

    
}

function createKeyboard() {
    keyboard.innerHTML = ''; // Clear previous keyboard
    const keys = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace']
    ];

    keys.forEach(row => {
        const keyboardRow = document.createElement('div');
        keyboardRow.classList.add('keyboard-row');
        row.forEach(key => {
            const button = document.createElement('button');
            button.classList.add('key');
            button.textContent = key.toUpperCase();
            button.dataset.key = key;
            if (key === 'enter' || key === 'backspace') {
                button.classList.add('large');
            }
            button.addEventListener('click', () => handleKeyPress(key));
            keyboardRow.appendChild(button);
        });
        keyboard.appendChild(keyboardRow);
    });
}

// --- Game Logic ---
function updateBoard() {
    if (!gameBoard) {
        console.error("Error: 'gameBoard' element not found in the DOM.");
        return;
    }

    const currentRowDiv = gameBoard.children[currentRow];

    if (!currentRowDiv) {
        console.error(`Error: 'word-row' element not found at index ${currentRow}. Check if createGameBoard() ran.`);
        return;
    }

    const mainBoxesContainer = currentRowDiv.querySelector('.main-boxes-container');

    if (!mainBoxesContainer) {
        console.error("Error: 'main-boxes-container' not found for the current row.");
        return;
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
        const box = mainBoxesContainer.children[i];
        box.textContent = currentGuess[i] || '';
    }
}

function handleKeyPress(key) {
    if (isGameOver) return;

    if (key === 'Enter') {
        if (isbuttonVisible === true) {
            onNextButtonPressed();
        }
        else {
            checkGuess();
        }


    } else if (key === 'Backspace') { 
        currentGuess.pop();
        updateBoard();
    } else if (key.length === 1 && /^[a-z]$/i.test(key)) {
        if (currentGuess.length < WORD_LENGTH) {
            currentGuess.push(key.toUpperCase());
            updateBoard();
        }
    }
   
}

function handleKeyDown(event) {
    handleKeyPress(event.key);
}



 function checkGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
        showMessage("Not enough letters!");
        return;
    }

    const guessString = currentGuess.join('');
 

    if (!acceptableWords.has(guessString))
    {
        showMessage("Not a word in the list !");
        return;
    }


    guessedWordsHistory.push(guessString); 

     secretWord = wordOfTheDay;
    const currentRowDiv = gameBoard.children[currentRow];
    const mainBoxesContainer = currentRowDiv.querySelector('.main-boxes-container');
   

    const letterCounts = {}; // To handle duplicate letters in the secret word
    for (const char of secretWord) {
        letterCounts[char] = (letterCounts[char] || 0) + 1;
    }

    // First pass: mark correct letters (green)
    for (let i = 0; i < WORD_LENGTH; i++) {
        const guessedLetter = currentGuess[i];
        const box = mainBoxesContainer.children[i];
        const keyButton = document.querySelector(`.key[data-key="${guessedLetter.toLowerCase()}"]`);

        if (secretWord[i] === guessedLetter) {
            box.classList.add('correct');
            keyButton.classList.add('correct');
            letterCounts[guessedLetter]--; // Decrement count for exact matches
        }
    }

    // Second pass: mark present and absent letters
    for (let i = 0; i < WORD_LENGTH; i++) {
        const guessedLetter = currentGuess[i];
        const box = mainBoxesContainer.children[i];
        const keyButton = document.querySelector(`.key[data-key="${guessedLetter.toLowerCase()}"]`);

        if (box.classList.contains('correct')) {
            continue; // Already handled
        }

        if (secretWord.includes(guessedLetter) && letterCounts[guessedLetter] > 0) {
            box.classList.add('present');
            // Only add 'present' if 'correct' isn't already there
            if (!keyButton.classList.contains('correct')) {
                keyButton.classList.add('present');
            }
            letterCounts[guessedLetter]--;
        } else {
            box.classList.add('absent');
            // Only add 'absent' if not 'correct' or 'present'
            if (!keyButton.classList.contains('correct') && !keyButton.classList.contains('present')) {
                keyButton.classList.add('absent');
            }
        }
    }

     if (guessString === secretWord) {

            newGame();
        


        isGameOver = true;

        
        
      
      
    } else if (currentRow === NUMBER_OF_GUESSES - 1) {
        showMessage(`Game Over! try again `);
        showButton("Try again");
        isGameOver = true;
      
    } else {
        currentRow++;
        currentGuess = [];
    }
}



function newGame() {
    WORD_LIST = WORD_LIST.filter(word => word !== wordOfTheDay);
    
      
        showButton("next");
    
    console.log("New game started, remaining words:", WORD_LIST.length);
}

function showMessage(message, duration = 5000) {
    // 1. Clear any existing timeout to prevent multiple messages from conflicting
    clearTimeout(messageTimeoutId);

    // 2. Set the message text and reset its initial state (off-screen, invisible)
    messageContainer.textContent = message;
    messageContainer.style.opacity = '0';
    messageContainer.style.top = '100%'; // Ensure it starts from the 'off-screen' position

    // 3. Trigger the fade-in and slide-up animation
    // Use a tiny setTimeout to allow the browser to apply the initial styles (opacity 0, top 95%)
    // before applying the final styles (opacity 1, top 90%). This makes the transition smooth.
    setTimeout(() => {
        messageContainer.style.opacity = '1'; // Fade in
        messageContainer.style.top = '90%';   // Animate up to its target position
    }, 500); // A small delay (e.g., 50ms) to ensure smooth transition start

    // 4. Set a timeout to fade out the message after the specified duration
    messageTimeoutId = setTimeout(() => {
        messageContainer.style.opacity = '0'; // Start fading out

        // Optional: Animate it slightly down as it fades out for a "disappear" effect
        // messageContainer.style.top = '95%';

        // After the fade-out transition completes, clear the text content
        // and reset its position to be ready for the next message.
        // This timeout duration should match the CSS transition duration (0.3s = 300ms)
        setTimeout(() => {
            messageContainer.textContent = '';
            // Reset top to initial 'hidden' state so next message always animates up
            messageContainer.style.top = '90%';
        }, 500); // Matches the transition duration for opacity/top
    }, duration);
}

function showButton(message) {
    isbuttonVisible = true; // Set the visibility flag to true
    // 1. Set the button's text and its initial hidden/off-screen state
    button.textContent = message;
    button.style.opacity = '0';  // Start invisible
    button.style.top = '80%';    // Start below its target position (50%)

    // 2. Animate the button IN (fade in and slide up)
    // Use a small setTimeout to allow the browser to register the initial state
    // (opacity 0, top 80%) BEFORE applying the transition to the final state.
    setTimeout(() => {
        button.style.opacity = '1'; // Fade in to full visibility
        button.style.top = '50%';
        button.style.pointerEvents = 'auto';
    }, 50); // A short delay (e.g., 50ms)

    // *** Removed the automatic fade-out timeout here ***
}

// Add the click event listener ONCE when your script loads.
// This will handle hiding the button and triggering the next action.
button.addEventListener('click', () => {
    // Hide the button instantly when clicked
    button.style.opacity = '0';
    button.style.top = '80%'; // Move it back to its starting hidden position
    button.style.pointerEvents = 'none';

    // Trigger your function to handle the next game action
    onNextButtonPressed();
});    

function onNextButtonPressed() {

    if (WORD_LIST.length  > 0) {

        console.log("Next button pressed, resetting game...");
        currentRow = 0;
        currentGuess = [];
        guessedWordsHistory = [];

        isGameOver = false;
        messageContainer.textContent = '';
        wordOfTheDay = pickRandomWord().toUpperCase(); // Pick a random word from the list
        console.log("Word of the day (for testing):", wordOfTheDay); // For debugging
        createGameBoard();
        createKeyboard();
      
    }
    else
    {
        fadeAndRedirect();
    }

    isbuttonVisible = false; // Reset the visibility flag
}

function fadeAndRedirect() {
    const overlay = document.getElementById('fade-overlay');

    // Check if the overlay element exists before trying to manipulate it
    if (overlay) {
        // Add the animation class
        overlay.style.animation = "fade-out-down 5s forwards"; // 1s is the duration of the animation

        // Wait for the animation to finish (1000ms = 1 second)
        setTimeout(() => {
            window.location.href = '../../evil/index.html';
        }, 5000); // This delay should match the animation duration
    } else {
        // If the overlay doesn't exist, just redirect immediately
        window.location.href = '../../evil/index.html';
    }
}

function extraMessage(message, duration = 4000) { // Added duration parameter, default 3 seconds
    const messagebox = document.getElementById('message-box');

    messagebox.innerHTML = message; // Set the message text

    // Set a timeout to clear the message after the specified duration
    setTimeout(() => {
        messagebox.innerHTML = ""; // Clear the message text
    }, duration); // Use the passed 'duration' here
}
// Initial call to start the game
initializeGame();