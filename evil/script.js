const doorVideo = document.getElementById('door_video');
const doorWinVideo = document.getElementById('door_win_video');
const doorDeathVideo = document.getElementById('door_death_video');

const loop1video = document.getElementById('loop_1_video');
const loop2video = document.getElementById('loop_2_video');
const loopwinvideo = document.getElementById('loop_win_video');
const loopdeathvideo = document.getElementById('loop_death_video');


const textCanvas = document.getElementById('textCanvas');
const ctx = textCanvas.getContext('2d');
let textColor = 'white';

let hasTextAppeared = false;
let currentRandomLetter = '';
let correctKeyPressed = "notPressed";
let haskeypressed = false;
let keyPressTimeoutId = null;
let lastkill = false;


let line1 = '';
let line2 = '';

// Function to draw text on the canvas
function drawTextOnCanvas() {
    // Set canvas dimensions to match the viewport for proper positioning
    textCanvas.width = window.innerWidth;
    textCanvas.height = window.innerHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);

    // Fade in the canvas
    textCanvas.style.opacity = '1';


    // Text properties
    ctx.font = 'bold 48px Arial, sans-serif'; // Adjust font size and family
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right'; // Align text to the right
    ctx.textBaseline = 'middle'; // Vertically center text

    // Second line of text
    const paddingRight = 500; // Padding from the right edge
    const lineHeight = 60; // Space between lines

    // Calculate X position for right alignment
    const x = textCanvas.width - paddingRight;

    // Calculate Y positions for vertical centering and stacking
    const initialY = textCanvas.height / 2 - lineHeight / 2; // Roughly center

    ctx.fillText(line1, x, initialY);
    ctx.fillText(line2, x, initialY + lineHeight); // Second line

    // You can add more lines as needed
    // ctx.fillText("Line 3", x, initialY + (2 * lineHeight));
}

function getRandomLetter() {
    const minCharCodeLowercase = 97; // ASCII for 'a'
    const maxCharCodeLowercase = 122; // ASCII for 'z'

    // Generate a random number between minCharCodeLowercase and maxCharCodeLowercase (inclusive)
    const randomCharCode = Math.floor(Math.random() * (maxCharCodeLowercase - minCharCodeLowercase + 1)) + minCharCodeLowercase;

    // Convert the ASCII character code to a character
    return String.fromCharCode(randomCharCode);
}

document.addEventListener('keydown', (event) => {
    const pressedKey = event.key.toUpperCase();

    // Condition 1: Key pressed during the active challenge window
    if (hasTextAppeared && !haskeypressed) {
        // A key was pressed within the active window, so clear the "too late" timeout
        if (keyPressTimeoutId) {
            clearTimeout(keyPressTimeoutId);
            keyPressTimeoutId = null;
        }

        haskeypressed = true; // Mark that a key has been processed for this challenge

        if (pressedKey === currentRandomLetter) {
            textColor = 'green';
            console.log(`Correct! You pressed ${pressedKey}.`);
            correctKeyPressed = true;
        } else {
            textColor = 'red';
            console.log(`Incorrect. You pressed ${pressedKey}, but the correct letter was ${currentRandomLetter}.`);
            correctKeyPressed = false;
        }
        drawTextOnCanvas(); // Redraw to show immediate feedback (green/red)
    }
    // Condition 2: Key pressed AFTER the active challenge window (too late for the prompt),
    // but before resetText has occurred, AND in 'lastkill' mode.
    // This specifically handles a *late* physical keypress that should trigger instant death.
    else if (!hasTextAppeared && !haskeypressed && correctKeyPressed === "notPressed" && lastkill === true) {
        console.log(`INSTANT DEATH: Late key (${pressedKey}) pressed when challenge window closed.`);
        haskeypressed = true; // Mark as processed to prevent multiple triggers
        // Ensure any pending timeout is cleared
        if (keyPressTimeoutId) {
            clearTimeout(keyPressTimeoutId);
            keyPressTimeoutId = null;
        }

        // Force a loss state
        textColor = 'red'; // Set for consistency, though text is likely hidden
        correctKeyPressed = false; // Player loses
        haskeypressed = true; // Mark as processed to prevent multiple triggers

        // Immediately stop current loop videos and play death video
        loop1video.style.display = 'none';
        loop1video.pause();
        loop1video.currentTime = 0;

        loop2video.style.display = 'none';
        loop2video.pause();
        loop2video.currentTime = 0;

        loopdeathvideo.style.display = 'block';
        loopdeathvideo.play().catch(e => console.error(`Error playing loop_death_video on instant death:`, e));
        console.log("Playing loop_death.mp4 due to instant death keypress.");

        // Fade out any lingering text canvas and reset state
        textCanvas.style.opacity = '0';
        const handleCanvasTransitionEnd = () => {
            resetText(); // Clean up all flags and canvas
            textCanvas.removeEventListener('transitionend', handleCanvasTransitionEnd);
        };
        textCanvas.addEventListener('transitionend', handleCanvasTransitionEnd);
    }
});
function playDoorVideoOnLoad() {
    // Make sure the video is set to 'block' if you used 'display: none' elsewhere
    // If you're only using opacity for hiding, this might not be strictly needed,
    // but it's good practice for elements you want to become visible.
    doorVideo.style.display = 'block'; // Ensure it's not display: none;

    // Set opacity to 1 to trigger the CSS fade-in transition
    doorVideo.style.opacity = '1';
    currentRandomLetter = getRandomLetter().toUpperCase();
    lastkill = false; // Reset lastkill to false for the new round
    line1 = `Press ${currentRandomLetter}`; // First line of text
    line2 = `To Enter Bush`;

    // Attempt to play the video
    doorVideo.play()
        .catch(error => {
            // This catch block will run if autoplay is blocked (e.g., if not muted)
            // or if there's another playback error.
            console.error("Error playing door_video:", error);
            // You might want to provide a fallback (e.g., a play button) here.
        });
}

doorVideo.addEventListener('ended', () => {
    console.log("Door video ended.");

    doorVideo.style.display = 'none'; // Instantly hide the current video

    // --- NEW LOGIC FOR TEXT COLOR IF NO BUTTON PRESSED ---
    // If no key was pressed, set text color to red before fading out
    if (correctKeyPressed === "notPressed") {
        textColor = 'red';
        drawTextOnCanvas(); // Redraw to make the text red before it starts fading
    }
    // --- END NEW LOGIC ---

    // Determine which video should play next immediately
    let nextVideoToPlay = null;
    if (correctKeyPressed === true) {
        nextVideoToPlay = doorWinVideo;
    } else { // This covers correctKeyPressed === false and correctKeyPressed === "notPressed"
        nextVideoToPlay = doorDeathVideo;
    }

    if (nextVideoToPlay) {
        nextVideoToPlay.style.display = 'block'; // Instantly show the next video
        nextVideoToPlay.play().catch(e => console.error(`Error playing ${nextVideoToPlay.id}:`, e));
        console.log(`Playing ${nextVideoToPlay.id}`);
    } else {
        console.error("No next video element found.");
    }

    // Now, fade out the text canvas concurrently
    textCanvas.style.opacity = '0';

    // Once the text canvas fade-out is complete, reset the text variables
    const handleCanvasTransitionEnd = () => {
        resetText(); // Call resetText ONLY after the fade-out is complete
        textCanvas.removeEventListener('transitionend', handleCanvasTransitionEnd); // Remove listener
    };
    textCanvas.addEventListener('transitionend', handleCanvasTransitionEnd);
});

doorVideo.addEventListener('timeupdate', () => {
    const videoDuration = doorVideo.duration;
    const currentTime = doorVideo.currentTime;
    const timeRemaining = videoDuration - currentTime;
    const triggerTime = 2; // Number of seconds from the end to trigger
    // Check if the video is near its end AND if the text hasn't appeared yet
    if (videoDuration > 0 && timeRemaining <= triggerTime && !hasTextAppeared) {
        drawTextOnCanvas();
        hasTextAppeared = true; // Set flag to prevent repeated drawing
    }
});



doorWinVideo.addEventListener('ended', () => {
    doorWinVideo.style.display = 'none';
    loop1video.style.display = 'block';

    loop1video.play().catch(e => console.error("Error playing loop_1_video:", e));

    currentRandomLetter = getRandomLetter().toUpperCase();
    console.log(`New : ${currentRandomLetter}`);

    line1 = `Press ${currentRandomLetter}`; // First line of text
    line2 = `To Kill`;

    // Ensure it's not display: none;
    lastkill = true; // Set this to true to indicate the last action was a kill
    // Set opacity to 1 to trigger the CSS fade-in transition
    loop1video.style.opacity = '1';
});


loop1video.addEventListener('timeupdate', () => {
    const videoDuration = loop1video.duration;
    const currentTime = loop1video.currentTime;
    const timeRemaining = videoDuration - currentTime;
    const triggerTime = 1.2; // Number of seconds from the end to trigger for loop1video

    if (videoDuration > 0 && timeRemaining <= triggerTime && !hasTextAppeared) {
        drawTextOnCanvas();
        hasTextAppeared = true;

        // --- Timeout Logic for "No Press" ---
        // This timeout determines if the player *fails to press any key at all*
        const timeoutDuration = timeRemaining * 1000;

        if (keyPressTimeoutId) {
            clearTimeout(keyPressTimeoutId);
        }

        keyPressTimeoutId = setTimeout(() => {
            console.log("Loop 1 challenge: Timeout fired! No key pressed within the window.");
            // IMPORTANT: Do NOT set correctKeyPressed = false here for 'no press'.
            // Leave correctKeyPressed as "notPressed" so that the loop1video 'ended' listener
            // can differentiate this from an 'incorrect key' press.
            // textColor can still be set to red for immediate visual feedback if the text is still visible.
            if (correctKeyPressed === "notPressed") {
                textColor = 'red';
                drawTextOnCanvas(); // Redraw to make the text red
            }
            keyPressTimeoutId = null; // Clear the ID after timeout fires
        }, timeoutDuration);
        // --- End Timeout Logic ---
    }
});


loop1video.addEventListener('ended', () => {
    console.log("Loop 1 video ended.");

    loop1video.style.display = 'none'; // Instantly hide the current video

    // --- NEW LOGIC FOR TEXT COLOR IF NO BUTTON PRESSED ---
    // If no key was pressed, set text color to red before fading out
    if (correctKeyPressed === "notPressed") {
        textColor = 'red';
        drawTextOnCanvas(); // Redraw to make the text red before it starts fading
    }
    // --- END NEW LOGIC ---

    // Determine which video should play next immediately
    let nextVideoToPlay = null;
    if (correctKeyPressed === true) {
        lastkill = false;
        nextVideoToPlay = loopwinvideo;
    } else if (correctKeyPressed === false) {
        nextVideoToPlay = loopdeathvideo;
    } else if (correctKeyPressed === "notPressed") {
        nextVideoToPlay = loop2video;
    }

    if (nextVideoToPlay) {
        nextVideoToPlay.style.display = 'block'; // Instantly show the next video
        nextVideoToPlay.play().catch(e => console.error(`Error playing ${nextVideoToPlay.id}:`, e));
        console.log(`Playing ${nextVideoToPlay.id}`);
    } else {
        console.error("No next loop video element found.");
    }

    // Now, fade out the text canvas concurrently
    textCanvas.style.opacity = '0';

    const handleCanvasTransitionEnd = () => {
        resetText(); // Call resetText ONLY after the fade-out is complete
        textCanvas.removeEventListener('transitionend', handleCanvasTransitionEnd); // Remove listener to avoid multiple calls
    };
    textCanvas.addEventListener('transitionend', handleCanvasTransitionEnd);
});


loop2video.addEventListener('ended', () => {
    loop2video.style.display = 'none';
    loop1video.style.display = 'block';
    loop1video.play().catch(e => console.error("Error playing loop_1_video:", e));
});

loopwinvideo.addEventListener('ended', () => {

    window.location.href = '../end/index.html';
});


doorDeathVideo.addEventListener('ended', () => {
    console.log("Door Death video ended. Restarting Door video.");
    doorDeathVideo.style.display = 'none'; // Hide the death video
    playDoorVideoOnLoad(); // Call the function to restart the door video sequence
});


loopdeathvideo.addEventListener('ended', () => {
    loopdeathvideo.style.display = 'none'; // Hide the death video
    playDoorVideoOnLoad(); // Call the function to restart the door video sequence
});

function resetText() {
    hasTextAppeared = false; // Reset the flag to allow text to appear again
    haskeypressed = false; // Reset the key press flag
    textColor = 'white'; // Reset color for next time
    correctKeyPressed = "notPressed"; // Reset the flag to its initial state
    line1 = ''; // Clear text content
    line2 = ''; // Clear text content
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height); // Ensure canvas is truly clear
}

let fullscreen = false; // Track fullscreen stat
window.onload = () => {

    playDoorVideoOnLoad();
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

};


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

        playDoorVideoOnLoad();
    }
}