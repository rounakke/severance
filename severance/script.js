// Get references to elements
const startScreen = document.getElementById('start-screen');
const fullscreenVideo = document.getElementById('fullscreen-video');
const mainContent = document.getElementById('main-content');
const screenElement = document.getElementById('screen'); // Reference to the screen div
const randomNumbersCanvas = document.getElementById('random-numbers-canvas'); // Reference to the canvas element
const ctx = randomNumbersCanvas.getContext('2d'); // 2D rendering context

// Custom cursor elements
const customCursor = document.getElementById('custom-cursor');
const cursorBoundingBox = document.getElementById('cursor-bounding-box');
const scoreDisplay = document.getElementById('score-display'); // NEW: Reference to score display element
// NEW: Reference to the total percentage display element
const totalPercentageDisplay = document.getElementById('total-percentage-display');


// Initial check for canvas element, useful for debugging if element isn't found
if (!randomNumbersCanvas) {
    console.error("Error: Canvas element 'random-numbers-canvas' not found!");
}
if (!screenElement) {
    console.error("Error: Screen element 'screen' not found.");
}

let boundingBox = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0
};

let zoomLevel = 1;
const BASE_NUM_ROWS_GRID = 100;
const BASE_NUM_COLS_GRID = 100;

const GRID_PADDING_TOP = 90;
const GRID_PADDING_RIGHT = 172;
const GRID_PADDING_BOTTOM = 80;
const GRID_PADDING_LEFT = 175;

const BASE_FONT_SIZE_PX = 8;
const MAX_ZOOM = 1.7;
const MIN_ZOOM = 1;

const ZOOMED_LINE_HEIGHT_FACTOR = 2.0;
const ZOOMED_COLUMN_GAP_FACTOR = 0.8;

const MIN_COLUMN_GAP_FACTOR = ZOOMED_COLUMN_GAP_FACTOR;
const MIN_LINE_HEIGHT_FACTOR = ZOOMED_LINE_HEIGHT_FACTOR;

const HOVER_TRANSITION_DURATION = 200;

let gridOffsetX = 0;
let gridOffsetY = 0;
const gridScrollSpeedLogicalUnitsPerSecond = 150;
const horizontalEdgeThresholdPx = 300;
const verticalEdgeThresholdPx = 150;
let maxGridOffsetX = 0;
let maxGridOffsetY = 0;

let currentCustomCursorX = 0;
let currentCustomCursorY = 0;

let gridData = [];
let floatingAnimationStartTime = 0;
let animationFrameId;
let lastFrameTime = 0;

let hoveredNumber = null;
let transitioningNumbers = new Map(); // Numbers transitioning back to normal size after hover
let permanentlyRedNumbers = new Set(); // Stores coordinates of numbers that should stay red

let highlightedNumber = null; // Number currently growing to become red
const HIGHLIGHT_DURATION = 1000;
const HIGHLIGHT_INTERVAL = 5000;
let highlightIntervalId;

// Constants for Infection Logic
const INFECTION_RATE = 0.4; // 40% chance for a neighbor to be infected
const MAX_INFECTION_DISTANCE = 2;

const ENLARGED_FONT_MULTIPLIER = 2.4;

// Constants for Fade In/Out on click
const FADE_IN_DURATION = 300; // Duration for new number to fade in
const REAPPEAR_DELAY = 5000; // 5 seconds in milliseconds

let fadingNumbers = new Map(); // Stores {row, col} -> {startTime, duration, type: 'fade-in', value}

// NEW: Selection related variables
let isSelecting = false;
let selectionStartGridPos = null; // {row, col}
let selectedCells = new Set(); // Stores 'row-col' strings for currently selected cells during drag

// NEW: Score variable
let score = 0;
let previousScore = 0; // To store score before it's updated for score change calculation


function easeInOutQuad(t) {
    t *= 2;
    if (t < 1) return 0.5 * t * t;
    t--;
    return -0.5 * (t * (t - 2) - 1);
}

/**
 * Updates the boundingBox to match the current dimensions and position of the canvas.
 * This is crucial for correctly positioning the custom cursor and handling clicks.
 */
function updateBoundingBox() {
    // Get the current live dimensions and position of the canvas element itself
    const canvasRect = randomNumbersCanvas.getBoundingClientRect();

    boundingBox.width = canvasRect.width;
    boundingBox.height = canvasRect.height;
    boundingBox.left = canvasRect.left;
    boundingBox.top = canvasRect.top;
    boundingBox.right = boundingBox.left + boundingBox.width;
    boundingBox.bottom = boundingBox.top + boundingBox.height;

    if (cursorBoundingBox) {
        cursorBoundingBox.style.width = `${boundingBox.width}px`;
        cursorBoundingBox.style.height = `${boundingBox.height}px`;
        cursorBoundingBox.style.left = `${boundingBox.left}px`;
        cursorBoundingBox.style.top = `${boundingBox.top}px`;
    }
}

/**
 * Calculates the maximum scroll offsets for the grid based on its dimensions
 * and the visible canvas area at max zoom.
 */
function calculateMaxOffsets() {
    // These calculations need to be based on the actual visible width/height of the canvas
    // which is set by initializeCanvasGrid based on screenElement.
    const baseCanvasLogicalWidth = randomNumbersCanvas.width / window.devicePixelRatio;
    const baseCanvasLogicalHeight = randomNumbersCanvas.height / window.devicePixelRatio;

    const baseCellWidth = baseCanvasLogicalWidth / BASE_NUM_COLS_GRID;
    const baseCellHeight = baseCanvasLogicalHeight / BASE_NUM_ROWS_GRID;

    const zoomProgress = (zoomLevel - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const clampedZoomProgress = Math.max(0, Math.min(1, zoomProgress));
    const currentColumnGapFactorAtMaxZoom = MIN_COLUMN_GAP_FACTOR + (ZOOMED_COLUMN_GAP_FACTOR - MIN_COLUMN_GAP_FACTOR) * 1;
    const currentLineHeightFactorAtMaxZoom = MIN_LINE_HEIGHT_FACTOR + (ZOOMED_LINE_HEIGHT_FACTOR - MIN_LINE_HEIGHT_FACTOR) * 1;

    const effectiveCellWidthAtMaxZoom = baseCellWidth * (1 + currentColumnGapFactorAtMaxZoom);
    const effectiveCellHeightAtMaxZoom = baseCellHeight * (1 + currentLineHeightFactorAtMaxZoom);

    // Add padding to the total logical grid dimensions
    const totalLogicalGridWidth = (BASE_NUM_COLS_GRID * effectiveCellWidthAtMaxZoom) + GRID_PADDING_LEFT + GRID_PADDING_RIGHT;
    const totalLogicalGridHeight = (BASE_NUM_ROWS_GRID * effectiveCellHeightAtMaxZoom) + GRID_PADDING_TOP + GRID_PADDING_BOTTOM;

    const visibleLogicalWidth = baseCanvasLogicalWidth;
    const visibleLogicalHeight = baseCanvasLogicalHeight;

    const scrollEdgeBufferPx = 10;

    maxGridOffsetX = Math.max(0, totalLogicalGridWidth - visibleLogicalWidth + scrollEdgeBufferPx);
    maxGridOffsetY = Math.max(0, totalLogicalGridHeight - visibleLogicalHeight + scrollEdgeBufferPx);
}


/**
 * Initializes the canvas dimensions and populates the grid data.
 * All numbers will be immediately visible (opacity 1).
 */
function initializeCanvasGrid() {
    if (!screenElement || !randomNumbersCanvas) {
        console.error("Cannot initialize canvas grid: screenElement or randomNumbersCanvas not found.");
        return;
    }
    // This sizes the canvas based on its parent #screen div (screenElement)
    randomNumbersCanvas.width = screenElement.clientWidth * window.devicePixelRatio;
    randomNumbersCanvas.height = screenElement.clientHeight * window.devicePixelRatio;

    randomNumbersCanvas.style.width = `${screenElement.clientWidth}px`;
    randomNumbersCanvas.style.height = `${screenElement.clientHeight}px`;

    gridData = [];
    for (let r = 0; r < BASE_NUM_ROWS_GRID; r++) {
        const row = [];
        for (let c = 0; c < BASE_NUM_COLS_GRID; c++) {
            row.push({
                value: Math.floor(Math.random() * 10),
                opacity: 1, // Change opacity to 1 so they are always visible
                animationDelay: Math.random() * 2,
                animationDuration: 4 + Math.random() * 2
            });
        }
        gridData.push(row);
    }

    // Since all numbers are immediately visible, we can directly trigger the zoom and other processes
    zoomLevel = MAX_ZOOM;
    applyGridVisuals();
    calculateMaxOffsets(); // Recalculate offsets for max zoom

    // Start the transition for the canvas zoom
    randomNumbersCanvas.style.transition = 'transform 1s ease-out';
    randomNumbersCanvas.addEventListener('transitionend', handleZoomTransitionEnd, {
        once: true
    });

    // Initial draw to ensure numbers are visible as soon as possible
    drawGrid(performance.now());
}

/**
 * Triggers a random number within the visible grid to grow and turn red.
 * Ensures it doesn't pick numbers that are already in a special state.
 */
function triggerRandomHighlight() {
    const baseCanvasLogicalWidth = randomNumbersCanvas.width / window.devicePixelRatio;
    const baseCanvasLogicalHeight = randomNumbersCanvas.height / window.devicePixelRatio;

    const baseCellWidth = baseCanvasLogicalWidth / BASE_NUM_COLS_GRID;
    const baseCellHeight = baseCanvasLogicalHeight / BASE_NUM_ROWS_GRID;

    const zoomProgress = (zoomLevel - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const clampedZoomProgress = Math.max(0, Math.min(1, zoomProgress));
    const currentColumnGapFactor = MIN_COLUMN_GAP_FACTOR + (ZOOMED_COLUMN_GAP_FACTOR - MIN_COLUMN_GAP_FACTOR) * 1;
    const currentLineHeightFactor = MIN_LINE_HEIGHT_FACTOR + (ZOOMED_LINE_HEIGHT_FACTOR - MIN_LINE_HEIGHT_FACTOR) * 1;

    const effectiveCellWidth = baseCellWidth * (1 + currentColumnGapFactor);
    const effectiveCellHeight = baseCellHeight * (1 + currentLineHeightFactor);

    const visibleLogicalWidth = baseCanvasLogicalWidth;
    const visibleLogicalHeight = baseCanvasLogicalHeight;

    // Calculate visible grid cells taking into account scrolling
    const startCol = Math.max(0, Math.floor(gridOffsetX / effectiveCellWidth));
    const endCol = Math.min(BASE_NUM_COLS_GRID, Math.ceil((gridOffsetX + visibleLogicalWidth) / effectiveCellWidth));
    const startRow = Math.max(0, Math.floor(gridOffsetY / effectiveCellHeight));
    const endRow = Math.min(BASE_NUM_ROWS_GRID, Math.ceil((gridOffsetY + visibleLogicalHeight) / effectiveCellHeight));

    const visibleCells = [];
    for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
            if (gridData[r] && gridData[r][c] && gridData[r][c].opacity > 0 && gridData[r][c].value !== '') { // Check value is not empty
                const cellKey = `${r}-${c}`;
                // Don't highlight if currently hovered, already highlighted, permanently red, or currently fading
                if (!(hoveredNumber && hoveredNumber.row === r && hoveredNumber.col === c) &&
                    !(highlightedNumber && highlightedNumber.row === r && highlightedNumber.col === c) &&
                    !permanentlyRedNumbers.has(cellKey) &&
                    !fadingNumbers.has(cellKey)) { // Check if fading
                    visibleCells.push({
                        row: r,
                        col: c
                    });
                }
            }
        }
    }

    if (visibleCells.length > 0) {
        const randomIndex = Math.floor(Math.random() * visibleCells.length);
        const {
            row,
            col
        } = visibleCells[randomIndex];

        highlightedNumber = {
            row: row,
            col: col,
            startTime: performance.now(),
            startFontSize: BASE_FONT_SIZE_PX,
        };
    } else {
        highlightedNumber = null;
    }
}

/**
 * Infects neighboring numbers around a given source cell with a chance.
 * @param {number} sourceRow - The row of the number that just turned red.
 * @param {number} sourceCol - The column of the number that just turned red.
 */
function infectNeighbors(sourceRow, sourceCol) {
    for (let dRow = -MAX_INFECTION_DISTANCE; dRow <= MAX_INFECTION_DISTANCE; dRow++) {
        for (let dCol = -MAX_INFECTION_DISTANCE; dCol <= MAX_INFECTION_DISTANCE; dCol++) {
            if (dRow === 0 && dCol === 0) {
                continue;
            }

            const neighborRow = sourceRow + dRow;
            const neighborCol = sourceCol + dCol;

            if (neighborRow >= 0 && neighborRow < BASE_NUM_ROWS_GRID &&
                neighborCol >= 0 && neighborCol < BASE_NUM_COLS_GRID) {

                const neighborKey = `${neighborRow}-${neighborCol}`;
                const neighborCell = gridData[neighborRow][neighborCol];

                const isAlreadyRed = permanentlyRedNumbers.has(neighborKey);
                const isHovered = hoveredNumber && hoveredNumber.row === neighborRow && hoveredNumber.col === neighborCol;
                const isHighlighted = highlightedNumber && highlightedNumber.row === neighborRow && highlightedNumber.col === neighborCol;
                const isFading = fadingNumbers.has(neighborKey); // Check if fading
                const isEmpty = neighborCell.value === ''; // Check if value is empty

                // Only infect if not already red, hovered, highlighted, fading, empty AND based on INFECTION_RATE
                if (!isAlreadyRed && !isHovered && !isHighlighted && !isFading && !isEmpty && Math.random() < INFECTION_RATE) {
                    permanentlyRedNumbers.add(neighborKey);
                }
            }
        }
    }
}

/**
 * Draws the entire grid, including numbers, hover effects, highlights, and fading animations.
 * @param {DOMHighResTimeStamp} currentTime - The current time provided by requestAnimationFrame.
 */
function drawGrid(currentTime) {
    ctx.clearRect(0, 0, randomNumbersCanvas.width, randomNumbersCanvas.height);

    ctx.save();
    // Apply canvas scaling and translation first, as these affect the entire canvas coordinate system
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(-gridOffsetX, -gridOffsetY);

    // Calculate the logical dimensions of the canvas after device pixel ratio scaling
    const baseCanvasLogicalWidth = randomNumbersCanvas.width / window.devicePixelRatio;
    const baseCanvasLogicalHeight = randomNumbersCanvas.height / window.devicePixelRatio;

    // Calculate base cell dimensions based on the canvas size, not reduced by padding
    let baseCellWidth = baseCanvasLogicalWidth / BASE_NUM_COLS_GRID;
    let baseCellHeight = baseCanvasLogicalHeight / BASE_NUM_ROWS_GRID;

    const zoomProgress = (zoomLevel - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const clampedZoomProgress = Math.max(0, Math.min(1, zoomProgress));

    const currentColumnGapFactor = MIN_COLUMN_GAP_FACTOR + (ZOOMED_COLUMN_GAP_FACTOR - MIN_COLUMN_GAP_FACTOR) * clampedZoomProgress;
    const currentLineHeightFactor = MIN_LINE_HEIGHT_FACTOR + (ZOOMED_LINE_HEIGHT_FACTOR - MIN_LINE_HEIGHT_FACTOR) * clampedZoomProgress;

    // These effectiveCellWidth/Height are for the *content* cells (including internal gaps)
    let effectiveCellWidth = baseCellWidth * (1 + currentColumnGapFactor);
    let effectiveCellHeight = baseCellHeight * (1 + currentLineHeightFactor);

    ctx.font = `${BASE_FONT_SIZE_PX}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const visibleLogicalWidth = baseCanvasLogicalWidth;
    const visibleLogicalHeight = baseCanvasLogicalHeight;

    const bufferCells = 2; // Render a few cells beyond the visible bounds for smooth scrolling

    // These start/end rows/cols need to consider the effective area too if you want perfect culling
    // For simplicity for now, we'll keep them based on original logical dimensions
    const startCol = Math.max(0, Math.floor((gridOffsetX - GRID_PADDING_LEFT) / effectiveCellWidth) - bufferCells);
    const endCol = Math.min(BASE_NUM_COLS_GRID, Math.ceil((gridOffsetX + visibleLogicalWidth - GRID_PADDING_LEFT) / effectiveCellWidth) + bufferCells);
    const startRow = Math.max(0, Math.floor((gridOffsetY - GRID_PADDING_TOP) / effectiveCellHeight) - bufferCells);
    const endRow = Math.min(BASE_NUM_ROWS_GRID, Math.ceil((gridOffsetY + visibleLogicalHeight - GRID_PADDING_TOP) / effectiveCellHeight) + bufferCells);

    const transitionsToRemove = [];
    const fadingNumbersToRemove = [];

    // Draw Fading-In Numbers
    for (const [key, fade] of fadingNumbers.entries()) {
        const {
            row,
            col,
            startTime,
            duration,
            type,
            value
        } = fade;
        const elapsed = currentTime - startTime;
        let progress = elapsed / duration;
        progress = Math.max(0, Math.min(1, progress));

        if (progress >= 1) {
            fadingNumbersToRemove.push(key);
            gridData[row][col].opacity = 1;
        }

        let currentOpacity = easeInOutQuad(progress);
        let currentFontColor = 'cyan';
        let currentFontSize = BASE_FONT_SIZE_PX;
        let displayValue = value;

        // Apply GRID_PADDING offset to x and y coordinates
        let x = GRID_PADDING_LEFT + col * effectiveCellWidth + effectiveCellWidth / 2;
        let y = GRID_PADDING_TOP + row * effectiveCellHeight + effectiveCellHeight / 2;

        if (zoomLevel === MAX_ZOOM) {
            const cellData = gridData[row][col];
            const elapsedFloat = (currentTime - floatingAnimationStartTime) / 1000;
            const animationProgress = (elapsedFloat - cellData.animationDelay) % cellData.animationDuration;
            const normalizedProgress = animationProgress / cellData.animationDuration;
            const floatOffset = Math.sin(normalizedProgress * Math.PI * 2) * 2;
            x += floatOffset;
            y += floatOffset;
        }

        ctx.save();
        ctx.font = `${currentFontSize}px 'Courier New', monospace`;
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = currentFontColor;
        ctx.fillText(displayValue, x, y);
        ctx.restore();
    }
    for (const key of fadingNumbersToRemove) {
        fadingNumbers.delete(key);
    }

    // Draw numbers that are transitioning back to normal size
    for (const [key, transition] of transitioningNumbers.entries()) {
        if (fadingNumbers.has(key)) continue;
        const [row, col] = key.split('-').map(Number);
        const cell = gridData[row][col];
        if (cell.value === '') continue;

        const {
            startTime,
            startFontSize
        } = transition;
        const elapsed = currentTime - startTime;
        let progress = elapsed / HOVER_TRANSITION_DURATION;
        progress = Math.max(0, Math.min(1, progress));

        if (progress >= 1) {
            transitionsToRemove.push(key);
        }

        const interpolatedFontSize = startFontSize - (startFontSize - BASE_FONT_SIZE_PX) * easeInOutQuad(progress);
        // Apply GRID_PADDING offset to x and y coordinates
        let x = GRID_PADDING_LEFT + col * effectiveCellWidth + effectiveCellWidth / 2;
        let y = GRID_PADDING_TOP + row * effectiveCellHeight + effectiveCellHeight / 2;

        if (zoomLevel === MAX_ZOOM) {
            const cellData = gridData[row][col];
            const elapsedFloat = (currentTime - floatingAnimationStartTime) / 1000;
            const animationProgress = (elapsedFloat - cellData.animationDelay) % cellData.animationDuration;
            const normalizedProgress = animationProgress / cellData.animationDuration;
            const floatOffset = Math.sin(normalizedProgress * Math.PI * 2) * 2;
            x += floatOffset;
            y += floatOffset;
        }

        ctx.save();
        ctx.font = `${interpolatedFontSize}px 'Courier New', monospace`;
        ctx.globalAlpha = 1;
        if (permanentlyRedNumbers.has(key)) {
            ctx.fillStyle = 'red';
        } else {
            ctx.fillStyle = 'cyan';
        }
        ctx.fillText(cell.value, x, y);
        ctx.restore();
    }
    for (const key of transitionsToRemove) {
        transitioningNumbers.delete(key);
    }

    // Draw the currently highlighted number
    if (highlightedNumber) {
        const key = `${highlightedNumber.row}-${highlightedNumber.col}`;
        const cell = gridData[highlightedNumber.row][highlightedNumber.col];
        if (fadingNumbers.has(key) || cell.value === '') {
            highlightedNumber = null;
        } else {
            const {
                row,
                col,
                startTime,
                startFontSize
            } = highlightedNumber;
            const elapsed = currentTime - startTime;
            let progress = elapsed / HIGHLIGHT_DURATION;
            progress = Math.max(0, Math.min(1, progress));

            if (progress >= 1) {
                permanentlyRedNumbers.add(key);
                infectNeighbors(row, col);
                highlightedNumber = null;
            } else {
                const interpolatedFontSize = BASE_FONT_SIZE_PX + (BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER - BASE_FONT_SIZE_PX) * easeInOutQuad(progress);
                // Apply GRID_PADDING offset to x and y coordinates
                let x = GRID_PADDING_LEFT + col * effectiveCellWidth + effectiveCellWidth / 2;
                let y = GRID_PADDING_TOP + row * effectiveCellHeight + effectiveCellHeight / 2;

                if (zoomLevel === MAX_ZOOM) {
                    const cellData = gridData[row][col];
                    const elapsedFloat = (currentTime - floatingAnimationStartTime) / 1000;
                    const animationProgress = (elapsedFloat - cellData.animationDelay) % cellData.animationDuration;
                    const normalizedProgress = animationProgress / cellData.animationDuration;
                    const floatOffset = Math.sin(normalizedProgress * Math.PI * 2) * 2;
                    x += floatOffset;
                    y += floatOffset;
                }

                ctx.save();
                ctx.font = `${interpolatedFontSize}px 'Courier New', monospace`;
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'red';
                ctx.fillText(cell.value, x, y);
                ctx.restore();
            }
        }
    }

    // Draw all other numbers (not hovered, not highlighted, not transitioning, NOT FADING)
    for (let r = 0; r < BASE_NUM_ROWS_GRID; r++) {
        for (let c = 0; c < BASE_NUM_COLS_GRID; c++) {
            const cell = gridData[r][c];
            const cellKey = `${r}-${c}`;

            if ((hoveredNumber && hoveredNumber.row === r && hoveredNumber.col === c) ||
                (highlightedNumber && highlightedNumber.row === r && highlightedNumber.col === c) ||
                transitioningNumbers.has(cellKey) ||
                fadingNumbers.has(cellKey)) {
                continue;
            }

            if (cell.opacity > 0 && cell.value !== '' &&
                r >= startRow && r < endRow &&
                c >= startCol && c < endCol) {

                // Apply GRID_PADDING offset to x and y coordinates
                let x = GRID_PADDING_LEFT + c * effectiveCellWidth + effectiveCellWidth / 2;
                let y = GRID_PADDING_TOP + r * effectiveCellHeight + effectiveCellHeight / 2;
                let fontSizeToUse = BASE_FONT_SIZE_PX;

                if (permanentlyRedNumbers.has(cellKey)) {
                    fontSizeToUse = BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER;
                    ctx.fillStyle = 'red';
                } else if (isSelecting && selectedCells.has(cellKey)) {
                    ctx.fillStyle = 'white';
                } else {
                    ctx.fillStyle = 'cyan';
                }

                if (zoomLevel === MAX_ZOOM) {
                    const elapsed = (currentTime - floatingAnimationStartTime) / 1000;
                    const animationProgress = (elapsed - cell.animationDelay) % cell.animationDuration;
                    const normalizedProgress = animationProgress / cell.animationDuration;
                    const floatOffset = Math.sin(normalizedProgress * Math.PI * 2) * 2;
                    x += floatOffset;
                    y += floatOffset;
                }

                ctx.globalAlpha = cell.opacity;
                ctx.font = `${fontSizeToUse}px 'Courier New', monospace`;
                ctx.fillText(cell.value, x, y);
            }
        }
    }

    // Draw the currently hovered number
    if (hoveredNumber) {
        const r = hoveredNumber.row;
        const c = hoveredNumber.col;
        const cell = gridData[r][c];
        const cellKey = `${r}-${c}`;

        if (fadingNumbers.has(cellKey) || cell.value === '') {
            hoveredNumber = null;
        } else if (cell.opacity > 0 && r >= startRow && r < endRow && c >= startCol && c < endCol) {
            // Apply GRID_PADDING offset to x and y coordinates
            let x = GRID_PADDING_LEFT + c * effectiveCellWidth + effectiveCellWidth / 2;
            let y = GRID_PADDING_TOP + r * effectiveCellHeight + effectiveCellHeight / 2;

            if (zoomLevel === MAX_ZOOM) {
                const elapsed = (currentTime - floatingAnimationStartTime) / 1000;
                const animationProgress = (elapsed - cell.animationDelay) % cell.animationDuration;
                const normalizedProgress = animationProgress / cell.animationDuration;
                const floatOffset = Math.sin(normalizedProgress * Math.PI * 2) * 2;
                x += floatOffset;
                y += floatOffset;
            }

            ctx.save();
            ctx.font = `${BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER}px 'Courier New', monospace`;
            ctx.globalAlpha = 1;
            if (permanentlyRedNumbers.has(cellKey)) {
                ctx.fillStyle = 'red';
            } else {
                ctx.fillStyle = 'cyan';
            }
            ctx.fillText(cell.value, x, y);
            ctx.restore();
        }
    }

    // NEW: Draw the selection rectangle
    if (isSelecting && selectionStartGridPos && selectedCells.size > 0) {
        let minSelectedPxX = Infinity;
        let minSelectedPxY = Infinity;
        let maxSelectedPxX = -Infinity;
        let maxSelectedPxY = -Infinity;

        selectedCells.forEach(cellKey => {
            const [r, c] = cellKey.split('-').map(Number);
            // Apply GRID_PADDING offset to selection rectangle coordinates
            minSelectedPxX = Math.min(minSelectedPxX, GRID_PADDING_LEFT + c * effectiveCellWidth);
            minSelectedPxY = Math.min(minSelectedPxY, GRID_PADDING_TOP + r * effectiveCellHeight);
            maxSelectedPxX = Math.max(maxSelectedPxX, GRID_PADDING_LEFT + (c + 1) * effectiveCellWidth);
            maxSelectedPxY = Math.max(maxSelectedPxY, GRID_PADDING_TOP + (r + 1) * effectiveCellHeight);
        });

        if (isFinite(minSelectedPxX)) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(minSelectedPxX, minSelectedPxY, maxSelectedPxX - minSelectedPxX, maxSelectedPxY - minSelectedPxY);
        }
    }

    ctx.restore();
}
/**
 * Main render loop for animations and drawing updates.
 * @param {DOMHighResTimeStamp} currentTime - The current time provided by requestAnimationFrame.
 */
function renderLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Auto-scroll logic only at MAX_ZOOM
    if (zoomLevel === MAX_ZOOM) {
        const movementAmount = gridScrollSpeedLogicalUnitsPerSecond * (deltaTime / 1000); // Logical units per frame

        const canvasRect = randomNumbersCanvas.getBoundingClientRect();
        const cursorXRelativeToCanvas = currentCustomCursorX - canvasRect.left;
        const cursorYRelativeToCanvas = currentCustomCursorY - canvasRect.top;

        // Apply scrolling based on cursor proximity to canvas edges
        if (cursorXRelativeToCanvas < horizontalEdgeThresholdPx && gridOffsetX > 0) {
            gridOffsetX = Math.max(0, gridOffsetX - movementAmount);
        } else if (cursorXRelativeToCanvas > canvasRect.width - horizontalEdgeThresholdPx && gridOffsetX < maxGridOffsetX) {
            gridOffsetX = Math.min(maxGridOffsetX, gridOffsetX + movementAmount);
        }

        if (cursorYRelativeToCanvas < verticalEdgeThresholdPx && gridOffsetY > 0) {
            gridOffsetY = Math.max(0, gridOffsetY - movementAmount);
        } else if (cursorYRelativeToCanvas > canvasRect.height - verticalEdgeThresholdPx && gridOffsetY < maxGridOffsetY) {
            gridOffsetY = Math.min(maxGridOffsetY, gridOffsetY + movementAmount);
        }
    }

    drawGrid(currentTime);
    animationFrameId = requestAnimationFrame(renderLoop);
}

/**
 * Handles mousemove events to update the custom cursor's position and trigger grid scrolling.
 * @param {MouseEvent} event - The mousemove event object.
 */
function moveCustomCursor(event) {
    // Only update cursor position if mainContent is visible
    if (mainContent.style.display === 'flex') {
        // Clamp cursor position to stay within the boundingBox of the canvas
        currentCustomCursorX = Math.max(boundingBox.left, Math.min(boundingBox.right, event.clientX));
        currentCustomCursorY = Math.max(boundingBox.top, Math.min(boundingBox.bottom, event.clientY));

        // Update custom cursor position (it tracks the actual mouse pointer within boundingBox)
        customCursor.style.left = `${currentCustomCursorX}px`;
        customCursor.style.top = `${currentCustomCursorY}px`;

        // Only update hover effects if at max zoom
        if (Math.abs(zoomLevel - MAX_ZOOM) < 0.001) {
            const {
                row,
                col
            } = getGridCoordinatesFromMouseEvent(event);
            const newKey = `${row}-${col}`;

            // Check if the current grid coordinates are valid and if there's a visible number there
            if (row >= 0 && row < BASE_NUM_ROWS_GRID &&
                col >= 0 && col < BASE_NUM_COLS_GRID) {
                const cell = gridData[row][col];

                // Determine if this cell should be hoverable
                // It should have a value AND either be visible OR currently fading in
                const isHoverable = (cell.value !== '' && (cell.opacity > 0 || fadingNumbers.has(newKey)));

                if (isHoverable) {
                    // If the number is currently highlighted and growing, do not set as hovered
                    if (highlightedNumber && highlightedNumber.row === row && highlightedNumber.col === col) {
                        // If there was a previous hover, clear it
                        if (hoveredNumber) {
                            const prevKey = `${hoveredNumber.row}-${hoveredNumber.col}`;
                            if (!permanentlyRedNumbers.has(prevKey) && !fadingNumbers.has(prevKey)) {
                                transitioningNumbers.set(prevKey, {
                                    row: hoveredNumber.row,
                                    col: hoveredNumber.col,
                                    startTime: performance.now(),
                                    startFontSize: BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER
                                });
                            }
                            hoveredNumber = null;
                        }
                    } else {
                        // If it's a new cell being hovered, or the hovered state changed
                        if (!hoveredNumber || hoveredNumber.row !== row || hoveredNumber.col !== col) {
                            if (hoveredNumber) {
                                // Start transition for previously hovered number back to normal size
                                const prevKey = `${hoveredNumber.row}-${hoveredNumber.col}`;
                                // Only transition if it's not permanently red (as red ones stay enlarged) or currently fading in
                                if (!permanentlyRedNumbers.has(prevKey) && !fadingNumbers.has(prevKey)) {
                                    transitioningNumbers.set(prevKey, {
                                        row: hoveredNumber.row,
                                        col: hoveredNumber.col,
                                        startTime: performance.now(),
                                        startFontSize: BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER
                                    });
                                }
                            }
                            hoveredNumber = {
                                row: row,
                                col: col
                            };
                            transitioningNumbers.delete(newKey); // Stop any pending transition for this new hovered number
                        }
                    }
                } else {
                    // If not hoverable (empty value or opacity 0), ensure no number is considered hovered
                    if (hoveredNumber) {
                        const prevKey = `${hoveredNumber.row}-${hoveredNumber.col}`;
                        if (!permanentlyRedNumbers.has(prevKey) && !fadingNumbers.has(prevKey)) {
                            transitioningNumbers.set(prevKey, {
                                row: hoveredNumber.row,
                                col: hoveredNumber.col,
                                startTime: performance.now(),
                                startFontSize: BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER
                            });
                        }
                        hoveredNumber = null;
                    }
                }
            } else {
                // Mouse is outside grid bounds, ensure no number is considered hovered
                if (hoveredNumber) {
                    const prevKey = `${hoveredNumber.row}-${hoveredNumber.col}`;
                    if (!permanentlyRedNumbers.has(prevKey) && !fadingNumbers.has(prevKey)) {
                        transitioningNumbers.set(prevKey, {
                            row: hoveredNumber.row,
                            col: hoveredNumber.col,
                            startTime: performance.now(),
                            startFontSize: BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER
                        });
                    }
                    hoveredNumber = null;
                }
            }
        } else {
            // If not at max zoom, ensure no number is considered hovered
            if (hoveredNumber) {
                const prevKey = `${hoveredNumber.row}-${hoveredNumber.col}`;
                if (!permanentlyRedNumbers.has(prevKey) && !fadingNumbers.has(prevKey)) {
                    transitioningNumbers.set(prevKey, {
                        row: hoveredNumber.row,
                        col: hoveredNumber.col,
                        startTime: performance.now(),
                        startFontSize: BASE_FONT_SIZE_PX * ENLARGED_FONT_MULTIPLIER
                    });
                }
                hoveredNumber = null;
            }
        }
    }
}

/**
 * Helper function to get grid coordinates (row, col) from a mouse event.
 * Handles canvas scaling and grid offsets.
 */
function getGridCoordinatesFromMouseEvent(event) {
    const canvasRect = randomNumbersCanvas.getBoundingClientRect();
    const clickXRelativeToCanvas = event.clientX - canvasRect.left;
    const clickYRelativeToCanvas = event.clientY - canvasRect.top;

    // Un-scale these coordinates to get them into the original logical pixel space
    const unscaledClickX = clickXRelativeToCanvas / zoomLevel;
    const unscaledClickY = clickYRelativeToCanvas / zoomLevel;

    // Adjust for grid offsets and then for padding to get the actual grid index
    const finalLogicalClickX = (unscaledClickX + gridOffsetX) - GRID_PADDING_LEFT;
    const finalLogicalClickY = (unscaledClickY + gridOffsetY) - GRID_PADDING_TOP;

    const baseCanvasLogicalWidth = randomNumbersCanvas.width / window.devicePixelRatio;
    const baseCanvasLogicalHeight = randomNumbersCanvas.height / window.devicePixelRatio;

    const baseCellWidth = baseCanvasLogicalWidth / BASE_NUM_COLS_GRID;
    const baseCellHeight = baseCanvasLogicalHeight / BASE_NUM_ROWS_GRID;

    const zoomProgress = (zoomLevel - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const clampedZoomProgress = Math.max(0, Math.min(1, zoomProgress));
    const currentColumnGapFactor = MIN_COLUMN_GAP_FACTOR + (ZOOMED_COLUMN_GAP_FACTOR - MIN_COLUMN_GAP_FACTOR) * clampedZoomProgress;
    const currentLineHeightFactor = MIN_LINE_HEIGHT_FACTOR + (ZOOMED_LINE_HEIGHT_FACTOR - MIN_LINE_HEIGHT_FACTOR) * clampedZoomProgress;

    const effectiveCellWidth = baseCellWidth * (1 + currentColumnGapFactor);
    const effectiveCellHeight = baseCellHeight * (1 + currentLineHeightFactor);

    const col = Math.floor(finalLogicalClickX / effectiveCellWidth);
    const row = Math.floor(finalLogicalClickY / effectiveCellHeight);

    return {
        row,
        col
    };
}



/**
 * Handles mousedown events on the canvas, initiating square selection.
 * @param {MouseEvent} event - The mousedown event object.
 */
function handleCanvasMouseDown(event) {
    // Only respond to left click and if at max zoom
    if (event.button === 0 && Math.abs(zoomLevel - MAX_ZOOM) < 0.001) {
        isSelecting = true;
        selectedCells.clear(); // Clear any previous selection visual
        const {
            row,
            col
        } = getGridCoordinatesFromMouseEvent(event);
        selectionStartGridPos = {
            row,
            col
        };
        // Add the start cell to selectedCells immediately for single cell selection visual
        if (row >= 0 && row < BASE_NUM_ROWS_GRID && col >= 0 && col < BASE_NUM_COLS_GRID) {
            selectedCells.add(`${row}-${col}`);
        }
        drawGrid(performance.now()); // Request redraw to show initial selection
    }
}

/**
 * Handles mousemove events on the canvas when selecting.
 * @param {MouseEvent} event - The mousemove event object.
 */
function handleCanvasMouseMove(event) {
    if (!isSelecting || !selectionStartGridPos) {
        return;
    }

    const {
        row: currentGridRow,
        col: currentGridCol
    } = getGridCoordinatesFromMouseEvent(event);

    // Clamp currentGridRow and currentGridCol to stay within grid bounds
    const clampedCurrentGridRow = Math.max(0, Math.min(BASE_NUM_ROWS_GRID - 1, currentGridRow));
    const clampedCurrentGridCol = Math.max(0, Math.min(BASE_NUM_COLS_GRID - 1, currentGridCol));

    let minRow = Math.min(selectionStartGridPos.row, clampedCurrentGridRow);
    let maxRow = Math.max(selectionStartGridPos.row, clampedCurrentGridRow);
    let minCol = Math.min(selectionStartGridPos.col, clampedCurrentGridCol);
    let maxCol = Math.max(selectionStartGridPos.col, clampedCurrentGridCol);

    selectedCells.clear(); // Clear previous cells

    let cellsAdded = 0;
    const MAX_SELECTABLE_CELLS = 9; // Max 9 cells can be selected

    // Iterate through the potential rectangular selection
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            // Only add if it's a valid cell, has a value, and we haven't hit the max
            if (gridData[r] && gridData[r][c] && gridData[r][c].value !== '' && cellsAdded < MAX_SELECTABLE_CELLS) {
                selectedCells.add(`${r}-${c}`);
                cellsAdded++;
            } else if (cellsAdded === MAX_SELECTABLE_CELLS) {
                // If 9 cells are already selected, stop adding more for this drag
                break; // Exit inner loop
            }
        }
        if (cellsAdded === MAX_SELECTABLE_CELLS) {
            break; // Exit outer loop
        }
    }
    drawGrid(performance.now()); // Request redraw to show updated selection
}

/**
 * Updates the score display element.
 */


/**
 * Updates a random percentage box based on the score change.
 * @param {number} scoreChange - The amount the score changed by (can be positive or negative).
 */
function updateRandomPercentageBox(scoreChange) {
    // No change in percentage if scoreChange is 0
    if (scoreChange === 0) {
        return;
    }

    const percentageBoxes = Array.from(document.querySelectorAll('.percentage-box'));

    // Filter boxes based on whether they can still be affected by the scoreChange
    const eligibleBoxes = percentageBoxes.filter(box => {
        const fillBar = box.querySelector('.fill-bar');
        if (!fillBar) return false;

        const currentPercent = parseInt(fillBar.dataset.percent, 10);
        if (isNaN(currentPercent)) return false;

        if (scoreChange > 0) {
            // Eligible if not already 100%
            return currentPercent < 100;
        } else {
            // Eligible if not already 0%
            return currentPercent > 0;
        }
    });

    if (eligibleBoxes.length === 0) {
        // No eligible boxes to update
        console.log("No percentage boxes eligible for update.");
        return;
    }

    // Choose a random eligible box
    const randomIndex = Math.floor(Math.random() * eligibleBoxes.length);
    const chosenBox = eligibleBoxes[randomIndex];

    const fillBar = chosenBox.querySelector('.fill-bar');
    const percentTextP = chosenBox.querySelector('p'); // The <p> tag inside the percentage-box

    let currentPercent = parseInt(fillBar.dataset.percent, 10);

    // Calculate new percentage, clamping it between 0 and 100
    let newPercent = Math.max(0, Math.min(100, currentPercent + scoreChange)); // Directly add/subtract scoreChange

    // Apply the new percentage
    fillBar.dataset.percent = newPercent.toString(); // Update data-percent attribute
    fillBar.style.width = `${newPercent}%`; // Update visual fill
    percentTextP.textContent = `${newPercent}%`; // Update text display

    // IMPORTANT: Re-calculate and display the total average after a box has changed
    updateTotalPercentageDisplay();
}

function updateGameStatsAndUI(scoreChange) {
    if (scoreDisplay) {
        // You can add logic here to display scoreChange if desired
        scoreDisplay.textContent = `Score: ${score}`;
    }
    updateRandomPercentageBox(scoreChange);
}


/**
 * Handles mouseup events, finalizing the selection and applying effects.
 * @param {MouseEvent} event - The mouseup event object.
 */
function handleCanvasMouseUp(event) {
    if (!isSelecting) {
        return;
    }

    isSelecting = false;
    selectionStartGridPos = null;

    let redNumbersDeletedInSelection = 0;
    let blueNumbersDeletedInSelection = 0;

    // Create a temporary array to store cells for delayed reappearance
    const cellsToReappear = [];

    // Apply effects for all selected cells
    selectedCells.forEach(cellKey => {
        const [row, col] = cellKey.split('-').map(Number);
        if (gridData[row] && gridData[row][col]) {
            // Determine if the number was red before deletion
            const wasRed = permanentlyRedNumbers.has(cellKey);

            if (wasRed) {
                redNumbersDeletedInSelection++;
            } else {
                blueNumbersDeletedInSelection++;
            }

            // Remove from permanentlyRedNumbers when deleted
            permanentlyRedNumbers.delete(cellKey);

            // Immediately set opacity to 0 and clear value so it disappears and is truly "empty"
            gridData[row][col].opacity = 0;
            gridData[row][col].value = ''; // Clear the value

            // Clear any other states (hovered, highlighted, transitioning)
            if (hoveredNumber && hoveredNumber.row === row && hoveredNumber.col === col) {
                hoveredNumber = null;
            }
            if (highlightedNumber && highlightedNumber.row === row && highlightedNumber.col === col) {
                highlightedNumber = null;
            }
            transitioningNumbers.delete(cellKey);
            fadingNumbers.delete(cellKey); // Ensure no ongoing fade for this cell

            // Add this cell to the list for delayed reappearance
            cellsToReappear.push({
                row,
                col,
                cellKey
            });
        }
    });

    // Store the score *before* it's updated
    previousScore = score;

    // Apply scoring based on the selection
    if (redNumbersDeletedInSelection > 0 && blueNumbersDeletedInSelection === 0) {
        // Only red numbers deleted
        score += (2 * redNumbersDeletedInSelection) + redNumbersDeletedInSelection;
    } else if (redNumbersDeletedInSelection === 0 && blueNumbersDeletedInSelection > 0) {
        // Only blue numbers deleted
        score -= (5 * blueNumbersDeletedInSelection);
    } else if (redNumbersDeletedInSelection > 0 && blueNumbersDeletedInSelection > 0) {
        // Mixed selection: red and blue numbers deleted
        score -= 5;
        score -= redNumbersDeletedInSelection; // -1 for every red number deleted
    }

    // Calculate the score change
    const scoreChange = score - previousScore;

    // Pass the scoreChange to the updated function
    updateGameStatsAndUI(scoreChange);

    selectedCells.clear(); // Clear visual selection after processing
    // Don't drawGrid immediately here, the delayed reappearance will handle it.
    // Instead, schedule the reappearance of numbers
    scheduleReappearance(cellsToReappear);
}

// NEW FUNCTION: Schedule the delayed reappearance of numbers
function scheduleReappearance(cells) {
    cells.forEach(({
        row,
        col,
        cellKey
    }) => {
        setTimeout(() => {
            // After the delay, update the grid data and start the fade-in
            const newRandomValue = Math.floor(Math.random() * 10);
            gridData[row][col].value = newRandomValue; // Set the new value
            gridData[row][col].opacity = 0; // Ensure it starts from 0 for fade-in

            fadingNumbers.set(cellKey, {
                row: row,
                col: col,
                startTime: performance.now(),
                duration: FADE_IN_DURATION,
                type: 'fade-in',
                value: newRandomValue
            });
        }, REAPPEAR_DELAY);
    });
    // Request a redraw immediately after numbers are hidden, and then regularly by renderLoop
    drawGrid(performance.now());
}


/**
 * Applies visual styles and transformations to the grid and canvas based on zoom level.
 * This is now primarily for scaling the canvas (not individual numbers within the canvas).
 */
function applyGridVisuals() {
    // Canvas itself will scale if zoomLevel is not 1
    randomNumbersCanvas.style.transform = `scale(${zoomLevel})`;
    randomNumbersCanvas.style.transformOrigin = 'center center'; // Scale from center
}

/**
 * Handles the end of the zoom transition.
 */
function handleZoomTransitionEnd() {
    randomNumbersCanvas.style.transition = ''; // Remove transition after it's done

    // This is the point where the canvas is fully zoomed in.
    // We can now start the continuous number animation and auto-scrolling.
    if (!animationFrameId) {
        floatingAnimationStartTime = performance.now();
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    // Start interval for random highlights only once zoom is complete
    if (!highlightIntervalId) {
        highlightIntervalId = setInterval(triggerRandomHighlight, HIGHLIGHT_INTERVAL);
    }

    // Ensure cursor is displayed and listening for mouse events
    if (customCursor) {
        customCursor.style.display = 'block';
    }
    document.addEventListener('mousemove', moveCustomCursor);
    randomNumbersCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    document.addEventListener('mouseup', handleCanvasMouseUp); // Listen on document for mouseup outside canvas
    document.addEventListener('mousemove', handleCanvasMouseMove); // Listen for mousemove for selection
}


/**
 * Handles the video 'ended' event.
 * Shows the main content and initializes the game.
 */
function videoEndedHandler(event) {
    fullscreenVideo.style.display = 'none'; // Hide video
    startScreen.style.display = 'none'; // Hide start screen
    mainContent.style.display = 'flex'; // Show game content
    document.body.style.cursor = 'none'; // Ensure custom cursor is used

    // Add these lines to change the background
    mainContent.style.backgroundImage = 'url("empty.png")';
    mainContent.style.backgroundSize = 'cover'; // Or '100% 100%' if you want it to stretch
    mainContent.style.backgroundPosition = 'center';
    mainContent.style.backgroundRepeat = 'no-repeat';

    // Initialize the canvas grid and start reveal animation
    initializeCanvasGrid();

    // Initialize custom cursor bounding box after canvas is sized
    updateBoundingBox();

    // Call initializeFillBars to set initial percentages for the boxes
    initializeFillBars(); // This function now calls updateTotalPercentageDisplay internally

    // Initialize and display score
    score = 0;
    updateGameStatsAndUI(0); // Pass 0 as initial score change
}

/**
 * Initializes the fill bars for the percentage boxes.
 * This function should be called when main content is visible.
 */
function initializeFillBars() {
    const fillBars = document.querySelectorAll('.fill-bar');
    fillBars.forEach(bar => {
        const percent = bar.dataset.percent;
        if (percent) {
            bar.style.width = `${percent}%`;
        }
    });

    // NEW: After setting individual fill bars, update the total percentage
    updateTotalPercentageDisplay();
}

/**
 * Calculates the average percentage from all fill bars and updates the display.
 */
function updateTotalPercentageDisplay() {
    if (!totalPercentageDisplay) {
        console.error("Error: 'total-percentage-display' element not found.");
        return;
    }

    const fillBars = document.querySelectorAll('.percentage-box .fill-bar');
    let totalPercentageSum = 0;
    let validBarsCount = 0;

    fillBars.forEach(bar => {
        const percent = parseInt(bar.dataset.percent, 10);
        if (!isNaN(percent)) {
            totalPercentageSum += percent;
            validBarsCount++;
        }
    });

    let averagePercentage = 0;
    if (validBarsCount > 0) {
        averagePercentage = Math.round(totalPercentageSum / validBarsCount);
        totalPercentageDisplay.textContent = `${averagePercentage}% Complete`;
    } else {
        totalPercentageDisplay.textContent = `0% Complete`; // Or handle as appropriate
    }

    // NEW CHECK: If 100% complete
    if (averagePercentage === 100) {
        console.log("Congratulations! All percentage boxes are 100% complete!");
        window.location.href = '../wordle/index.html';
      
    }

}


/**
 * Handles keyboard input.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyDown(event) {
    if (event.key === 'Enter' || event.code === 'Enter') {
        if (startScreen.style.display === 'flex') {
            startScreen.style.display = 'none';
            fullscreenVideo.style.display = 'block'; // Show video element
            fullscreenVideo.play().catch(error => {
                console.error("Autoplay failed:", error);
                // Fallback if autoplay is blocked: directly show main content
                videoEndedHandler();
            });

            // Request fullscreen if video autoplay is successful or not needed
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) { // Firefox
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
                document.documentElement.msRequestFullscreen();
            }
        }
    }
}

/**
 * Handles window resize events.
 * Adjusts canvas size and recalculates grid offsets.
 */
function handleResize() {
    if (mainContent.style.display === 'flex') {
        updateBoundingBox();

        randomNumbersCanvas.width = screenElement.clientWidth * window.devicePixelRatio;
        randomNumbersCanvas.height = screenElement.clientHeight * window.devicePixelRatio;

        randomNumbersCanvas.style.width = `${screenElement.clientWidth}px`;
        randomNumbersCanvas.style.height = `${screenElement.clientHeight}px`;

        applyGridVisuals();
        calculateMaxOffsets();

        // Adjust grid offsets to stay within bounds after resize
        gridOffsetX = Math.min(gridOffsetX, maxGridOffsetX);
        gridOffsetY = Math.min(gridOffsetY, maxGridOffsetY);
        gridOffsetX = Math.max(0, gridOffsetX);
        gridOffsetY = Math.max(0, gridOffsetY);

        // Restart render loop for smooth transition if already zoomed
        if (zoomLevel === MAX_ZOOM) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            floatingAnimationStartTime = performance.now();
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    }
}

let fullscreen = false;

window.onload = () => {
    startScreen.style.display = 'none';
    fullscreenVideo.style.display = 'block';
    mainContent.style.display = 'none';
    customCursor.style.display = 'none';
    document.body.style.cursor = 'none'; 

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
            document.addEventListener('keydown', handleKeypress);


        }
        else {
            fullscreen = true;
        }

    }, 100); 


    fullscreenVideo.play().catch(error => {
        console.error("Autoplay failed:", error);
        // Fallback if autoplay is blocked: directly show main content
        videoEndedHandler();
    });

    // Request fullscreen if video autoplay is successful or not needed
    

   
    fullscreenVideo.addEventListener('ended', videoEndedHandler);
    window.addEventListener('resize', handleResize);

    // Initial check for aspect ratio for `main-content`
    handleResize(); // Call once to set initial sizes and positions correctly
};


function handleKeypress(event) {
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
        document.removeEventListener('keydown', handleKeypress);

        fullscreenVideo.play().catch(error => {
            console.error("Autoplay failed:", error);
            // Fallback if autoplay is blocked: directly show main content
            videoEndedHandler();
        });
    }
}