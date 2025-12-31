/* ==========================================
   FAMILY GAME NIGHT HUB - JAVASCRIPT
   Handles: Timers, Checkboxes, Media, Modal
   LocalStorage Persistence for custom rounds
   100% Vanilla JS - No dependencies
   ========================================== */

// ==========================================
// GLOBAL VARIABLES
// ==========================================

/**
 * Counter for generating unique row IDs
 */

const STORAGE_SCHEMA_VERSION = 1;


// Utility to escape user-provided text so it is safe for insertion into innerHTML
function escapeHtml(str) {
    if (!str && str !== '') return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build prompt HTML wrapped in the spoiler UI.
 * visible=true => inner content is shown by default and button says "Hide"
 * visible=false => inner content hidden by default and button says "Reveal"
 */
function buildPromptHTML(promptText, visible = true) {
    const safe = escapeHtml(promptText);
    if (visible) {
        return `
      <div class="spoiler-container">
        <button class="btn btn-reveal" onclick="toggleReveal(this)">Hide</button>
        <div class="">
          ${safe}
        </div>
      </div>
    `;
    } else {
        return `
      <div class="spoiler-container">
        <button class="btn btn-reveal" onclick="toggleReveal(this)">Reveal</button>
        <div class="hidden">
          ${safe}
        </div>
      </div>
    `;
    }
}


let nextRowId = 6;

/**
 * Store timer state for each row
 * Key: row ID (number)
 * Value: { intervalId, remainingSeconds, isRunning }
 */
const timers = {};

/**
 * LocalStorage key for saving custom rounds
 */
const STORAGE_KEY = 'gameNightRounds';


// ==========================================
// LOCAL STORAGE PERSISTENCE SYSTEM
// Saves and loads custom rounds automatically
// ==========================================

/**
 * Save all current rounds to LocalStorage
 * Called after adding or deleting a round
 */
function saveRoundsToStorage() {
    const rounds = [];
    const allRows = document.querySelectorAll('.game-row');

    allRows.forEach(row => {
        const rowId = parseInt(row.dataset.rowId);
        const gameName = row.querySelector('.game-name').textContent.trim();
        const gameIcon = row.querySelector('.game-icon')?.textContent.trim() || '🎮';
        const prompt = row.querySelector('.round-prompt').innerHTML;
        const resourceCell = row.querySelector('.resource-cell').innerHTML;
        const timerMin = parseInt(row.querySelector('.timer-min')?.value) || 0;
        const timerSec = parseInt(row.querySelector('.timer-sec')?.value) || 0;
        const isCompleted = row.querySelector('.done-checkbox')?.checked || false;

        rounds.push({
            id: rowId,
            gameName: gameName.replace(gameIcon, '').trim(),
            gameIcon: gameIcon,
            prompt: prompt,
            resourceHTML: resourceCell,
            timerMin: timerMin,
            timerSec: timerSec,
            isCompleted: isCompleted
        });
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
        console.log('✅ Rounds saved to LocalStorage');
    } catch (e) {
        console.warn('Could not save to LocalStorage:', e);
    }
}

/**
 * Load rounds from LocalStorage and rebuild the table
 * Called on page load if stored data exists
 */
function loadRoundsFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            console.warn('No saved rounds found, using default HTML');
            return false;
        }

        const rounds = JSON.parse(stored);


        if (!Array.isArray(rounds) || rounds.length === 0) {
            console.warn('Stored data invalid — using HTML');
            return false;
        }

        // Clear existing table body
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';

        // Rebuild rows from saved data
        let maxId = 0;
        rounds.forEach(round => {
            if (round.id > maxId) maxId = round.id;
            // If stored prompt looks like HTML, use it as-is.
            // Otherwise wrap plain text into the spoiler UI so it matches your desired layout.
            let promptHTML;
            if (typeof round.prompt === 'string' && /<\s*\w+[^>]*>/.test(round.prompt)) {
                // stored prompt already contains HTML - use it unchanged
                promptHTML = round.prompt;
            } else {
                // plain text -> wrap in spoiler (visible by default to match your example)
                promptHTML = buildPromptHTML(round.prompt || '', true);
            }

            const rowHTML = `
                <tr data-row-id="${round.id}" class="game-row ${round.isCompleted ? 'completed' : ''}">
                    <td class="game-name">
                        <span class="game-icon">${round.gameIcon}</span>
                        ${round.gameName}
                    </td>
                    <td class="round-prompt">
                        ${promptHTML}
                    </td>
                    <td class="resource-cell">
                        ${round.resourceHTML}
                    </td>
                    <td class="timer-cell">
                        <div class="timer-controls">
                            <div class="timer-input-group">
                                <input type="number" class="timer-input timer-min" value="${round.timerMin}" min="0" max="60" aria-label="Timer minutes">
                                <span class="timer-label">m</span>
                                <input type="number" class="timer-input timer-sec" value="${round.timerSec}" min="0" max="59" aria-label="Timer seconds">
                                <span class="timer-label">s</span>
                            </div>
                            <div class="timer-display" id="timer-${round.id}">00:00</div>
                            <div class="timer-buttons">
                                <button class="btn btn-start" onclick="startTimer(${round.id})" aria-label="Start timer">▶️</button>
                                <button class="btn btn-pause" onclick="pauseTimer(${round.id})" aria-label="Pause timer">⏸️</button>
                                <button class="btn btn-reset" onclick="resetTimer(${round.id})" aria-label="Reset timer">🔄</button>
                            </div>
                        </div>
                    </td>
                    <td class="done-cell">
                        <label class="checkbox-container">
                            <input type="checkbox" class="done-checkbox" onchange="toggleDone(${round.id}, this)" ${round.isCompleted ? 'checked' : ''}>
                            <span class="checkmark">✓</span>
                        </label>
                    </td>
                    <td class="actions-cell">
    <button class="btn btn-move" onclick="moveRowUp(${round.id})" aria-label="Move up">⬆️</button>
    <button class="btn btn-move" onclick="moveRowDown(${round.id})" aria-label="Move down">⬇️</button>
    <button class="btn btn-delete" onclick="deleteRow(${round.id})" aria-label="Delete round">🗑️</button>
</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', rowHTML);
        });

        nextRowId = maxId + 1;
        console.log('✅ Rounds loaded from LocalStorage');
        return true;

    } catch (e) {
        console.warn('Could not load from LocalStorage:', e);
        return false;
    }
}

/**
 * Clear all saved rounds from LocalStorage
 * Useful for resetting to default state
 */
function clearSavedRounds() {
    if (!confirm('Clear all saved data? This will reset to the default rounds on next refresh.')) {
        return;
    }
    localStorage.removeItem(STORAGE_KEY);
    alert('Saved data cleared. Refresh the page to see default rounds.');
}


// ==========================================
// TIMER SYSTEM
// Each row has an independent timer
// Supports both minutes AND seconds input
// ==========================================

/**
 * Get total seconds from the minutes and seconds inputs for a row
 * @param {HTMLElement} row - The table row element
 * @returns {number} Total seconds
 */
function getTimerSeconds(row) {
    const minInput = row.querySelector('.timer-min');
    const secInput = row.querySelector('.timer-sec');
    const minutes = parseInt(minInput.value) || 0;
    const seconds = parseInt(secInput.value) || 0;
    return (minutes * 60) + seconds;
}

/**
 * Start the timer for a specific row
 * @param {number} rowId - The ID of the row (data-row-id)
 */
function startTimer(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const display = row.querySelector('.timer-display');

    // If timer is already running, do nothing
    if (timers[rowId] && timers[rowId].isRunning) {
        return;
    }

    // Initialize timer if not exists or was reset
    if (!timers[rowId] || timers[rowId].remainingSeconds === 0) {
        const totalSeconds = getTimerSeconds(row);
        timers[rowId] = {
            intervalId: null,
            remainingSeconds: totalSeconds,
            isRunning: false
        };
    }

    // Don't start if no time set
    if (timers[rowId].remainingSeconds <= 0) {
        display.textContent = "Set time!";
        return;
    }

    // Mark row as active
    row.classList.add('active');
    row.classList.remove('timer-finished');
    display.classList.add('running');
    display.classList.remove('finished');

    // Start the countdown
    timers[rowId].isRunning = true;
    updateTimerDisplay(rowId);
    updateGlobalTimerDisplay();

    timers[rowId].intervalId = setInterval(() => {
        timers[rowId].remainingSeconds--;

        // Update display
        updateTimerDisplay(rowId);

        // Color changes based on remaining time
        if (timers[rowId].remainingSeconds <= 10 && timers[rowId].remainingSeconds > 0) {
            display.classList.remove('running', 'warning');
            display.classList.add('danger');
        } else if (timers[rowId].remainingSeconds <= 30 && timers[rowId].remainingSeconds > 10) {
            display.classList.remove('running', 'danger');
            display.classList.add('warning');
        }

        // Timer finished
        if (timers[rowId].remainingSeconds <= 0) {
            timerFinished(rowId);
        }

        updateGlobalTimerDisplay();
    }, 1000);
}

/**
 * Pause the timer for a specific row
 * @param {number} rowId - The ID of the row
 */
function pauseTimer(rowId) {
    if (!timers[rowId]) return;

    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const display = row.querySelector('.timer-display');

    // Clear the interval
    if (timers[rowId].intervalId) {
        clearInterval(timers[rowId].intervalId);
        timers[rowId].intervalId = null;
    }

    timers[rowId].isRunning = false;

    // Update visual state
    display.classList.remove('running');
    row.classList.remove('active');

    updateGlobalTimerDisplay();
}

/**
 * Reset the timer for a specific row
 * @param {number} rowId - The ID of the row
 */
function resetTimer(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const display = row.querySelector('.timer-display');

    // Clear any running interval
    if (timers[rowId] && timers[rowId].intervalId) {
        clearInterval(timers[rowId].intervalId);
    }

    // Reset state
    timers[rowId] = {
        intervalId: null,
        remainingSeconds: 0,
        isRunning: false
    };

    // Reset display
    display.textContent = "00:00";
    display.classList.remove('running', 'warning', 'danger', 'finished');
    row.classList.remove('active', 'timer-finished');

    updateGlobalTimerDisplay();
}

/**
 * Handle timer completion
 * @param {number} rowId - The ID of the row
 */
function timerFinished(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const display = row.querySelector('.timer-display');

    // Clear the interval
    if (timers[rowId].intervalId) {
        clearInterval(timers[rowId].intervalId);
        timers[rowId].intervalId = null;
    }

    timers[rowId].isRunning = false;
    timers[rowId].remainingSeconds = 0;

    // Visual feedback
    display.textContent = "TIME!";
    display.classList.remove('running', 'warning', 'danger');
    display.classList.add('finished');
    row.classList.remove('active');
    row.classList.add('timer-finished');

    // Play a sound effect (using Web Audio API if available)
    playTimerSound();

    updateGlobalTimerDisplay();
}

/**
 * Update the timer display for a specific row
 * @param {number} rowId - The ID of the row
 */
function updateTimerDisplay(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const display = row.querySelector('.timer-display');

    const seconds = timers[rowId].remainingSeconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update the global timer display in the header
 * Shows the active timer with the least time remaining
 */
function updateGlobalTimerDisplay() {
    const globalDisplay = document.getElementById('activeTimerDisplay');

    // Find all running timers
    const runningTimers = Object.entries(timers)
        .filter(([id, timer]) => timer.isRunning && timer.remainingSeconds > 0)
        .map(([id, timer]) => ({
            id: parseInt(id),
            seconds: timer.remainingSeconds
        }));

    if (runningTimers.length === 0) {
        globalDisplay.textContent = "No active timer";
        globalDisplay.style.color = '#58a6ff';
        return;
    }

    // Find the one with least time
    const urgent = runningTimers.reduce((min, t) =>
        t.seconds < min.seconds ? t : min
    );

    const mins = Math.floor(urgent.seconds / 60);
    const secs = urgent.seconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Get game name for the timer
    const row = document.querySelector(`tr[data-row-id="${urgent.id}"]`);
    if (!row) return;

    const gameName = row.querySelector('.game-name').textContent.trim();

    globalDisplay.textContent = `${gameName}: ${timeStr}`;

    // Add warning color if low time
    if (urgent.seconds <= 10) {
        globalDisplay.style.color = '#f85149';
    } else if (urgent.seconds <= 30) {
        globalDisplay.style.color = '#d29922';
    } else {
        globalDisplay.style.color = '#58a6ff';
    }
}

/**
 * Play a simple beep sound when timer finishes
 * Uses Web Audio API for offline compatibility
 */
function playTimerSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();

        // Beep pattern: beep-beep-beep
        setTimeout(() => oscillator.stop(), 150);

        // Second beep
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            osc2.connect(gainNode);
            osc2.frequency.value = 800;
            osc2.start();
            setTimeout(() => osc2.stop(), 150);
        }, 200);

        // Third beep
        setTimeout(() => {
            const osc3 = audioContext.createOscillator();
            osc3.connect(gainNode);
            osc3.frequency.value = 1000;
            osc3.start();
            setTimeout(() => osc3.stop(), 300);
        }, 400);

    } catch (e) {
        // Web Audio not supported - fail silently
        console.log('Audio not supported');
    }
}


// ==========================================
// CHECKBOX / PROGRESS SYSTEM
// ==========================================

/**
 * Toggle the "done" state for a row
 * @param {number} rowId - The ID of the row
 * @param {HTMLInputElement} checkbox - The checkbox element
 */
function toggleDone(rowId, checkbox) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    if (checkbox.checked) {
        // Mark as completed
        row.classList.add('completed');

        // Pause timer if running
        pauseTimer(rowId);

        // Auto-scroll to next unchecked row
        scrollToNextUnchecked(rowId);
    } else {
        // Unmark as completed
        row.classList.remove('completed');
    }

    // Update progress bar
    updateProgress();

    // Save state to LocalStorage
    saveRoundsToStorage();
}

/**
 * Scroll to the next unchecked row
 * @param {number} currentRowId - The ID of the current row
 */
function scrollToNextUnchecked(currentRowId) {
    const allRows = document.querySelectorAll('.game-row');
    let foundCurrent = false;

    for (const row of allRows) {
        const rowId = parseInt(row.dataset.rowId);

        if (rowId === currentRowId) {
            foundCurrent = true;
            continue;
        }

        if (foundCurrent) {
            const checkbox = row.querySelector('.done-checkbox');
            if (!checkbox.checked) {
                // Smooth scroll to this row
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Highlight briefly
                row.style.outline = '2px solid #58a6ff';
                setTimeout(() => {
                    row.style.outline = 'none';
                }, 2000);

                break;
            }
        }
    }
}

/**
 * Update the progress bar based on completed rounds
 */
function updateProgress() {
    const allCheckboxes = document.querySelectorAll('.done-checkbox');
    const checkedCount = document.querySelectorAll('.done-checkbox:checked').length;
    const totalCount = allCheckboxes.length;

    const percentage = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${checkedCount} of ${totalCount} rounds completed`;

    // Celebration when all done!
    if (checkedCount === totalCount && totalCount > 0) {
        progressText.textContent = `🎉 All ${totalCount} rounds completed! Great game night! 🎉`;
        celebrateCompletion();
    }
}

/**
 * Simple celebration animation when all rounds are complete
 */
function celebrateCompletion() {
    const header = document.querySelector('.header');
    header.style.background = 'linear-gradient(135deg, #2ea043, #3fb950)';

    setTimeout(() => {
        header.style.background = '';
    }, 3000);
}


// ==========================================
// ADD NEW ROUND SYSTEM
// Allows adding rounds from the browser
// Automatically saves to LocalStorage
// ==========================================

/**
 * Toggle the visibility of the add round form
 */
function toggleAddRoundForm() {
    const form = document.getElementById('addRoundForm');
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';
}

/**
 * Toggle the resource path input based on resource type
 */
function toggleResourceInput() {
    const resourceType = document.getElementById('newResourceType').value;
    const pathGroup = document.getElementById('resourcePathGroup');

    // Show path input for audio, image, video; hide for text
    if (resourceType === 'audio' || resourceType === 'image' || resourceType === 'video' || resourceType === 'answer') {
        pathGroup.style.display = 'block';

        // Update placeholder based on type
        const pathInput = document.getElementById('newResourcePath');
        if (resourceType === 'audio') pathInput.placeholder = 'e.g., audio/song.mp3';
        if (resourceType === 'image') pathInput.placeholder = 'e.g., images/pic.jpg';
        if (resourceType === 'video') pathInput.placeholder = 'e.g., videos/clip.mp4';
        if (resourceType === 'answer') pathInput.placeholder = 'e.g., 2015';
    } else {
        pathGroup.style.display = 'none';
    }
}

/**
 * Add a new round to the table
 */
function addNewRound() {
    // Get form values
    const gameName = document.getElementById('newGameName').value.trim();
    const gameIcon = document.getElementById('newGameIcon').value.trim() || '🎮';
    const prompt = document.getElementById('newPrompt').value.trim();
    const promptHTML = buildPromptHTML(prompt, true);
    const resourceType = document.getElementById('newResourceType').value;
    const resourcePath = document.getElementById('newResourcePath').value.trim();
    const timerMin = parseInt(document.getElementById('newTimerMin').value) || 0;
    const timerSec = parseInt(document.getElementById('newTimerSec').value) || 0;

    // Validation
    if (!gameName) {
        alert('Please enter a game name.');
        return;
    }
    if (!prompt) {
        alert('Please enter a round/prompt.');
        return;
    }

    // Generate resource HTML based on type
    let resourceHTML = '';
    switch (resourceType) {
        case 'audio':
            resourceHTML = `
                <div class="audio-container">
                    <audio controls class="audio-player">
                        <source src="${resourcePath}" type="audio/mpeg">
                    </audio>
                </div>
            `;
            break;
        case 'image':
            resourceHTML = `
                <div class="spoiler-container">
                    <button class="btn btn-reveal" onclick="toggleReveal(this)">Reveal Image</button>
                    <div class="image-container hidden">
                        <img 
                            src="${resourcePath}" 
                            alt="Round image" 
                            class="thumbnail"
                            onclick="openImageModal(this.src, 'Round image')"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        >
                    </div>
                </div>
            `;
            break;
        case 'video':
            resourceHTML = `
                <div class="video-container">
                    <video controls class="video-player">
                        <source src="${resourcePath}" type="video/mp4">
                        <span class="fallback-message">📹 Add video: ${resourcePath || 'videos/file.mp4'}</span>
                    </video>
                </div>
            `;
            break;
        case 'answer':
            // resourcePath holds the answer text; escape it to avoid injecting HTML
            const safeAnswer = escapeHtml(resourcePath);
            resourceHTML = `
        <div class="spoiler-answer">
            <button class="btn btn-reveal" onclick="toggleReveal(this)">Reveal Answer</button>
            <span class="answer hidden">${safeAnswer}</span>
        </div>
    `;
            break;
        default:
            resourceHTML = '<span class="text-only-badge">📝 Text Only</span>';
    }

    // Create new row HTML
    const rowId = nextRowId++;
    const newRowHTML = `
        <tr data-row-id="${rowId}" class="game-row">
            <td class="game-name">
                <span class="game-icon">${gameIcon}</span>
                ${gameName}
            </td>
            <td class="round-prompt">
                ${promptHTML}
            </td>
            <td class="resource-cell">
                ${resourceHTML}
            </td>
            <td class="timer-cell">
                <div class="timer-controls">
                    <div class="timer-input-group">
                        <input type="number" class="timer-input timer-min" value="${timerMin}" min="0" max="60" aria-label="Timer minutes">
                        <span class="timer-label">m</span>
                        <input type="number" class="timer-input timer-sec" value="${timerSec}" min="0" max="59" aria-label="Timer seconds">
                        <span class="timer-label">s</span>
                    </div>
                    <div class="timer-display" id="timer-${rowId}">00:00</div>
                    <div class="timer-buttons">
                        <button class="btn btn-start" onclick="startTimer(${rowId})" aria-label="Start timer">▶️</button>
                        <button class="btn btn-pause" onclick="pauseTimer(${rowId})" aria-label="Pause timer">⏸️</button>
                        <button class="btn btn-reset" onclick="resetTimer(${rowId})" aria-label="Reset timer">🔄</button>
                    </div>
                </div>
            </td>
            <td class="done-cell">
                <label class="checkbox-container">
                    <input type="checkbox" class="done-checkbox" onchange="toggleDone(${rowId}, this)">
                    <span class="checkmark">✓</span>
                </label>
            </td>
            <td class="actions-cell">
                <button class="btn btn-move" onclick="moveRowUp(${rowId})" aria-label="Move up">⬆️</button>
                <button class="btn btn-move" onclick="moveRowDown(${rowId})" aria-label="Move down">⬇️</button>
                <button class="btn btn-delete" onclick="deleteRow(${rowId})" aria-label="Delete round">🗑️</button>
            </td>
        </tr>
    `;

    // Add to table
    const tableBody = document.getElementById('tableBody');
    tableBody.insertAdjacentHTML('beforeend', newRowHTML);

    // Clear form and hide
    document.getElementById('newGameName').value = '';
    document.getElementById('newPrompt').value = '';
    document.getElementById('newResourcePath').value = '';
    document.getElementById('newTimerMin').value = '1';
    document.getElementById('newTimerSec').value = '0';
    document.getElementById('newResourceType').value = 'text';
    toggleResourceInput();
    toggleAddRoundForm();

    // Update progress
    updateProgress();

    // *** SAVE TO LocalStorage ***
    saveRoundsToStorage();

    // Scroll to new row
    const newRow = document.querySelector(`tr[data-row-id="${rowId}"]`);
    newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    newRow.style.outline = '2px solid #3fb950';
    setTimeout(() => {
        newRow.style.outline = 'none';
    }, 2000);

    console.log(`✅ Added round "${gameName}" and saved to storage`);
}

/**
 * Delete a row from the table
 * @param {number} rowId - The ID of the row to delete
 */
function deleteRow(rowId) {
    if (!confirm('Delete this round?')) {
        return;
    }

    // Stop timer if running
    if (timers[rowId]) {
        if (timers[rowId].intervalId) {
            clearInterval(timers[rowId].intervalId);
        }
        delete timers[rowId];
    }

    // Remove row from DOM
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (row) {
        row.remove();
    }

    // Update progress
    updateProgress();
    updateGlobalTimerDisplay();

    // *** SAVE TO LocalStorage ***
    saveRoundsToStorage();
}


// ==========================================
// ROW REORDERING SYSTEM
// Move rows up or down in the table
// ==========================================

/**
 * Move a row up in the table
 * @param {number} rowId - The ID of the row to move
 */
function moveRowUp(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const previousRow = row.previousElementSibling;

    // If there's no previous row, we're already at the top
    if (!previousRow) {
        console.log('Already at top');
        return;
    }

    // Move the row before its previous sibling
    row.parentNode.insertBefore(row, previousRow);

    // Visual feedback
    row.style.outline = '2px solid #58a6ff';
    setTimeout(() => {
        row.style.outline = 'none';
    }, 500);

    // Save to LocalStorage
    saveRoundsToStorage();
}

/**
 * Move a row down in the table
 * @param {number} rowId - The ID of the row to move
 */
function moveRowDown(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const nextRow = row.nextElementSibling;

    // If there's no next row, we're already at the bottom
    if (!nextRow) {
        console.log('Already at bottom');
        return;
    }

    // Move the row after its next sibling
    row.parentNode.insertBefore(nextRow, row);

    // Visual feedback
    row.style.outline = '2px solid #58a6ff';
    setTimeout(() => {
        row.style.outline = 'none';
    }, 500);

    // Save to LocalStorage
    saveRoundsToStorage();
}


// ==========================================
// IMAGE MODAL SYSTEM
// ==========================================

/**
 * Open the image modal with the specified image
 * @param {string} src - The image source URL
 * @param {string} caption - The image caption
 */
function openImageModal(src, caption) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');

    modalImage.src = src;
    modalCaption.textContent = caption || '';
    modal.classList.add('open');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

/**
 * Close the image modal
 * @param {Event} event - Optional click event
 */
function closeImageModal(event) {
    // If clicking on the image itself, don't close
    if (event && event.target.id === 'modalImage') {
        return;
    }

    const modal = document.getElementById('imageModal');
    modal.classList.remove('open');

    // Restore body scroll
    document.body.style.overflow = '';
}

/**
 * Show message when image placeholder is clicked
 */
function showImageMessage() {
    alert('To add an image:\n\n1. Save your image file\n2. Place it in the "images" folder\n3. Update the src attribute in index.html\n\nExample: images/actor-eyes.jpg');
}


// ==========================================
// ANSWER REVEAL SYSTEM
// ==========================================

/**
 * Reveal/Hide hidden content (answers, questions, etc.)
 * @param {HTMLButtonElement} button - The reveal button
 */
function toggleReveal(button) {
    const content = button.nextElementSibling;
    const isHidden = content.classList.contains('hidden');

    // Toggle visibility
    content.classList.toggle('hidden');

    // Toggle button text (Reveal X <-> Hide X)
    const currentText = button.textContent;
    if (isHidden) {
        // Was hidden, now visible -> Change "Reveal" to "Hide"
        button.textContent = currentText.replace('Reveal', 'Hide');
    } else {
        // Was visible, now hidden -> Change "Hide" to "Reveal"
        button.textContent = currentText.replace('Hide', 'Reveal');
    }
}


// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

document.addEventListener('keydown', function (event) {
    // Escape key closes modal
    if (event.key === 'Escape') {
        closeImageModal();
    }
});


// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize the app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎮 Family Game Night Hub loaded!');

    // *** Load saved rounds from LocalStorage ***
    const loadedFromStorage = loadRoundsFromStorage();

    if (!loadedFromStorage) {
        // If no saved data, find the highest existing row ID from HTML
        const allRows = document.querySelectorAll('.game-row');
        let maxId = 0;
        allRows.forEach(row => {
            const id = parseInt(row.dataset.rowId);
            if (id > maxId) maxId = id;
        });
        nextRowId = maxId + 1;
    }

    // Initialize progress bar
    updateProgress();

    // Add visual feedback to table rows on hover
    const rows = document.querySelectorAll('.game-row');
    rows.forEach(row => {
        row.addEventListener('mouseenter', function () {
            if (!this.classList.contains('completed')) {
                this.style.cursor = 'default';
            }
        });
    });

    // Prevent accidental form submissions and allow Enter to start timer
    document.querySelectorAll('.timer-input').forEach(input => {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const rowId = this.closest('tr').dataset.rowId;
                startTimer(parseInt(rowId));
            }
        });
    });
});


// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get total number of rows
 * @returns {number} Total row count
 */
function getTotalRows() {
    return document.querySelectorAll('.game-row').length;
}

/**
 * Get number of completed rows
 * @returns {number} Completed row count
 */
function getCompletedRows() {
    return document.querySelectorAll('.done-checkbox:checked').length;
}

/**
 * Reset all timers and checkboxes (full game reset)
 */
function resetAllRounds() {
    if (!confirm('Reset all rounds? This will clear all timers and checkboxes.')) {
        return;
    }

    // Reset all timers
    document.querySelectorAll('.game-row').forEach(row => {
        const rowId = parseInt(row.dataset.rowId);
        resetTimer(rowId);

        // Uncheck checkbox
        const checkbox = row.querySelector('.done-checkbox');
        checkbox.checked = false;
        row.classList.remove('completed');
    });

    // Update progress
    updateProgress();

    // Save reset state
    saveRoundsToStorage();
}
