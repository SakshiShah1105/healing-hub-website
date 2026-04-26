let meditationActive = false;
let meditationPaused = false;
let timeRemaining = 0;
let totalTime = 0;
let breathCount = 0;
let meditationInterval = null;
let breathingTimeout = null;
let currentBreathIndex = 0;

function startMeditation(minutes, title) {
    totalTime = minutes * 60;
    timeRemaining = minutes * 60;
    breathCount = 0;
    meditationActive = true;
    meditationPaused = false;
    currentBreathIndex = 0;

    clearInterval(meditationInterval);
    clearTimeout(breathingTimeout);

    document.getElementById('sessionTitle').textContent = title;
    document.getElementById('timerDisplay').textContent = formatTime(timeRemaining);
    document.getElementById('timeRemaining').textContent = formatTime(timeRemaining);
    document.getElementById('breathCount').textContent = breathCount;
    document.getElementById('breathText').textContent = 'Breathe In (4 sec)';

    const pauseBtn = document.getElementById('pauseBtn');
    const playBtn = document.getElementById('playBtn');

    if (pauseBtn) pauseBtn.style.display = 'flex';
    if (playBtn) playBtn.style.display = 'none';

    document.getElementById('sessionModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    startBreathingGuide();
    startTimer();
}

function startTimer() {
    clearInterval(meditationInterval);

    meditationInterval = setInterval(() => {
        if (!meditationActive || meditationPaused) return;

        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(meditationInterval);
            completeMeditation();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const formatted = formatTime(Math.max(timeRemaining, 0));
    document.getElementById('timerDisplay').textContent = formatted;
    document.getElementById('timeRemaining').textContent = formatted;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function togglePause() {
    if (!meditationActive) return;

    meditationPaused = !meditationPaused;

    const pauseBtn = document.getElementById('pauseBtn');
    const playBtn = document.getElementById('playBtn');

    if (meditationPaused) {
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (playBtn) playBtn.style.display = 'flex';

        clearTimeout(breathingTimeout);

        showToastPopup({
            type: 'info',
            icon: '⏸️',
            title: 'Session Paused',
            message: 'Take your time. Resume whenever you are ready.'
        });
    } else {
        if (pauseBtn) pauseBtn.style.display = 'flex';
        if (playBtn) playBtn.style.display = 'none';

        startBreathingGuide();

        showToastPopup({
            type: 'success',
            icon: '▶️',
            title: 'Session Resumed',
            message: 'Welcome back. Continue breathing gently.'
        });
    }
}

function startBreathingGuide() {
    const breathTexts = [
        { text: 'Breathe In (4 sec)', duration: 4000 },
        { text: 'Hold (4 sec)', duration: 4000 },
        { text: 'Breathe Out (4 sec)', duration: 4000 }
    ];

    clearTimeout(breathingTimeout);

    function cycle() {
        if (!meditationActive || meditationPaused) return;

        const current = breathTexts[currentBreathIndex];
        const breathTextEl = document.getElementById('breathText');
        const breathCountEl = document.getElementById('breathCount');

        if (breathTextEl) {
            breathTextEl.textContent = current.text;
        }

        if (currentBreathIndex === 0) {
            breathCount++;
            if (breathCountEl) {
                breathCountEl.textContent = breathCount;
            }
        }

        breathingTimeout = setTimeout(() => {
            if (!meditationActive || meditationPaused) return;
            currentBreathIndex = (currentBreathIndex + 1) % breathTexts.length;
            cycle();
        }, current.duration);
    }

    cycle();
}

function completeMeditation() {
    meditationActive = false;
    meditationPaused = false;

    clearInterval(meditationInterval);
    clearTimeout(breathingTimeout);

    document.getElementById('sessionModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';

    const duration = totalTime - Math.max(timeRemaining, 0);
    document.getElementById('completionTime').textContent = `${Math.max(1, Math.floor(duration / 60))} min`;
    document.getElementById('completionBreaths').textContent = breathCount;

    document.getElementById('completionModal').style.display = 'flex';

    if (typeof addNotification === 'function') {
        addNotification(`🧘 Meditation completed successfully. You finished ${Math.max(1, Math.floor(duration / 60))} min.`, 'Just now');
    }
}

function closeCompletion() {
    document.getElementById('completionModal').style.display = 'none';
    window.location.href = 'index.html';
}

function closeMeditationSession() {
    if (meditationActive) {
        showConfirmPopup({
            type: 'warning',
            icon: '🌿',
            title: 'Leave Session?',
            message: 'Your current meditation session will be lost.',
            confirmText: 'Leave',
            cancelText: 'Continue',
            onConfirm: function () {
                meditationActive = false;
                meditationPaused = false;
                clearInterval(meditationInterval);
                clearTimeout(breathingTimeout);

                document.getElementById('sessionModal').style.display = 'none';
                document.getElementById('modalOverlay').style.display = 'none';

                showToastPopup({
                    type: 'info',
                    icon: '✨',
                    title: 'Session Closed',
                    message: 'You can start a new meditation anytime.'
                });
            }
        });
    } else {
        document.getElementById('sessionModal').style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    }
}

function endMeditation() {
    showConfirmPopup({
        type: 'warning',
        icon: '🧘',
        title: 'End Meditation?',
        message: 'Your session will be completed now.',
        confirmText: 'End Session',
        cancelText: 'Continue',
        onConfirm: function () {
            completeMeditation();
        }
    });
}