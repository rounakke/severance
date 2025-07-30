const startScreen = document.getElementById('start-screen');



function handleKeyDown(event) {
    if (event.key === 'Enter' || event.code === 'Enter') {
        if (startScreen.style.display === 'flex') {

            window.location.href = 'severance/index.html';
            //window.location.href = 'wordle/index.html';
            //window.location.href = 'evil/index.html';
        }
    }
}


window.onload = () => {
    startScreen.style.display = 'flex';

    // Event Listeners for initial screen and video
    document.addEventListener('keydown', handleKeyDown);

};