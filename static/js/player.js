let videoEl = null;
let syncInterval = null;
let controlsTimeout = null;
let isSeeking = false;

function initPlayer() {
    videoEl = document.getElementById('video-player');
    const wrapper = document.getElementById('player-wrapper');
    const controls = document.getElementById('player-controls');
    const progressContainer = document.getElementById('progress-container');
    const progressPlayed = document.getElementById('progress-played');
    const progressBuffered = document.getElementById('progress-buffered');
    const progressHandle = document.getElementById('progress-handle');
    const progressTooltip = document.getElementById('progress-tooltip');
    const playBtn = document.getElementById('btn-play');
    const playIcon = document.getElementById('play-icon');
    const rewindBtn = document.getElementById('btn-rewind');
    const forwardBtn = document.getElementById('btn-forward');
    const volumeBtn = document.getElementById('btn-volume');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeSlider = document.getElementById('volume-slider');
    const timeDisplay = document.getElementById('time-display');
    const pipBtn = document.getElementById('btn-pip');
    const fsBtn = document.getElementById('btn-fullscreen');
    const fsIcon = document.getElementById('fullscreen-icon');

    // Show/hide controls
    let hideTimer;
    function showControls() {
        wrapper.classList.add('controls-visible');
        wrapper.classList.remove('hide-cursor');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (appState.isPlaying) {
                wrapper.classList.remove('controls-visible');
                wrapper.classList.add('hide-cursor');
            }
        }, 3000);
    }

    wrapper.addEventListener('mousemove', showControls);
    wrapper.addEventListener('touchstart', () => {
        showControls();
    }, { passive: true });

    // Play/Pause
    playBtn.addEventListener('click', () => {
        if (!videoEl.src) return;
        if (appState.isPlaying) {
            socket.emit('pause', { time: videoEl.currentTime });
        } else {
            socket.emit('resume', { time: videoEl.currentTime });
        }
    });

    // Rewind/Forward (leader only)
    rewindBtn.addEventListener('click', () => {
        if (appState.nickname !== appState.leader) return;
        const newTime = Math.max(0, videoEl.currentTime - 5);
        socket.emit('seek', { time: newTime });
    });

    forwardBtn.addEventListener('click', () => {
        if (appState.nickname !== appState.leader) return;
        const newTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
        socket.emit('seek', { time: newTime });
    });

    // Volume
    volumeSlider.addEventListener('input', () => {
        videoEl.volume = parseFloat(volumeSlider.value);
        updateVolumeIcon();
        localStorage.setItem('botyara_volume', volumeSlider.value);
    });

    volumeBtn.addEventListener('click', () => {
        if (videoEl.volume > 0) {
            videoEl._prevVolume = videoEl.volume;
            videoEl.volume = 0;
            volumeSlider.value = 0;
        } else {
            videoEl.volume = videoEl._prevVolume || 1;
            volumeSlider.value = videoEl.volume;
        }
        updateVolumeIcon();
    });

    function updateVolumeIcon() {
        if (videoEl.volume === 0) {
            volumeIcon.className = 'nf nf-fa-volume_off';
        } else if (videoEl.volume < 0.5) {
            volumeIcon.className = 'nf nf-fa-volume_down';
        } else {
            volumeIcon.className = 'nf nf-fa-volume_up';
        }
    }

    // Restore volume
    const savedVol = localStorage.getItem('botyara_volume');
    if (savedVol !== null) {
        videoEl.volume = parseFloat(savedVol);
        volumeSlider.value = savedVol;
        updateVolumeIcon();
    }

    // Progress bar
    videoEl.addEventListener('timeupdate', () => {
        if (isSeeking) return;
        const dur = videoEl.duration || 0;
        const cur = videoEl.currentTime;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        progressPlayed.style.width = pct + '%';
        progressHandle.style.left = pct + '%';
        timeDisplay.textContent = formatTime(cur) + ' / ' + formatTime(dur);
    });

    videoEl.addEventListener('progress', () => {
        if (videoEl.buffered.length > 0) {
            const buffEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
            const dur = videoEl.duration || 0;
            progressBuffered.style.width = (dur > 0 ? (buffEnd / dur) * 100 : 0) + '%';
        }
    });

    // Seek via progress bar (only leader)
    let progressDragging = false;

    function getProgressTime(e) {
        const rect = progressContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let ratio = (clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        return ratio * (videoEl.duration || 0);
    }

    progressContainer.addEventListener('mousedown', (e) => {
        if (appState.nickname !== appState.leader) return;
        progressDragging = true;
        isSeeking = true;
        const time = getProgressTime(e);
        updateProgressUI(time);
    });

    progressContainer.addEventListener('touchstart', (e) => {
        if (appState.nickname !== appState.leader) return;
        progressDragging = true;
        isSeeking = true;
        const time = getProgressTime(e);
        updateProgressUI(time);
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
        if (progressDragging) {
            const time = getProgressTime(e);
            updateProgressUI(time);
        }
        // Tooltip
        if (progressContainer.matches(':hover')) {
            const rect = progressContainer.getBoundingClientRect();
            let ratio = (e.clientX - rect.left) / rect.width;
            ratio = Math.max(0, Math.min(1, ratio));
            const time = ratio * (videoEl.duration || 0);
            progressTooltip.textContent = formatTime(time);
            progressTooltip.style.left = (ratio * 100) + '%';
        }
    });

    document.addEventListener('mouseup', () => {
        if (progressDragging) {
            progressDragging = false;
            isSeeking = false;
            const dur = videoEl.duration || 0;
            const pct = parseFloat(progressPlayed.style.width) || 0;
            const time = (pct / 100) * dur;
            socket.emit('seek', { time });
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (progressDragging) {
            const time = getProgressTime(e);
            updateProgressUI(time);
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (progressDragging) {
            progressDragging = false;
            isSeeking = false;
            const dur = videoEl.duration || 0;
            const pct = parseFloat(progressPlayed.style.width) || 0;
            const time = (pct / 100) * dur;
            socket.emit('seek', { time });
        }
    });

    function updateProgressUI(time) {
        const dur = videoEl.duration || 0;
        const pct = dur > 0 ? (time / dur) * 100 : 0;
        progressPlayed.style.width = pct + '%';
        progressHandle.style.left = pct + '%';
        timeDisplay.textContent = formatTime(time) + ' / ' + formatTime(dur);
    }

    // PiP
    pipBtn.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoEl.requestPictureInPicture();
            }
        } catch (e) {
            console.log('PiP not supported');
        }
    });

    // Fullscreen
    fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            wrapper.requestFullscreen().catch(() => {});
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fsIcon.className = 'nf nf-md-fullscreen_exit';
        } else {
            fsIcon.className = 'nf nf-md-fullscreen';
        }
    });

    // Video ended
    videoEl.addEventListener('ended', () => {
        if (appState.nickname === appState.leader) {
            socket.emit('video_ended');
        }
    });

    // Leader sync interval
    syncInterval = setInterval(() => {
        if (socket && socket.connected && appState.nickname === appState.leader && videoEl.src && !videoEl.paused) {
            socket.emit('sync_time', {
                time: videoEl.currentTime,
                playing: !videoEl.paused
            });
        }
    }, 2000);
}

function updateLeaderControls() {
    const isLeader = appState.nickname === appState.leader;
    const rewindBtn = document.getElementById('btn-rewind');
    const forwardBtn = document.getElementById('btn-forward');

    if (rewindBtn) rewindBtn.style.display = isLeader ? '' : 'none';
    if (forwardBtn) forwardBtn.style.display = isLeader ? '' : 'none';
}

function loadVideo(videoInfo) {
    if (!videoEl) return;
    const filename = videoInfo.filepath ? videoInfo.filepath.split('/').pop().split('\\').pop() : '';
    if (filename) {
        videoEl.src = '/video/' + encodeURIComponent(filename);
        videoEl.load();
        document.getElementById('no-video-placeholder').classList.add('hidden');
    }
}

function handleStateSync(state) {
    appState.playlist = state.playlist || [];
    appState.currentVideoIndex = state.current_video_index;
    appState.currentTime = state.current_time;
    appState.isPlaying = state.is_playing;
    appState.leader = state.leader;
    appState.pausedBy = state.paused_by;
    appState.users = state.users || [];
    appState.activeVote = state.active_vote;

    updateHeaderInfo();
    updateLeaderControls();
    renderPlaylist();
    renderVoting();
    updatePausedIndicator();

    // Load current video
    if (appState.currentVideoIndex >= 0 && appState.currentVideoIndex < appState.playlist.length) {
        const currentVideo = appState.playlist[appState.currentVideoIndex];
        const currentSrc = videoEl ? videoEl.src : '';
        const filename = currentVideo.filepath ? currentVideo.filepath.split('/').pop().split('\\').pop() : '';
        const expectedSrc = '/video/' + encodeURIComponent(filename);

        if (!currentSrc.endsWith(encodeURIComponent(filename))) {
            loadVideo(currentVideo);
        }

        // Sync time
        if (videoEl && videoEl.readyState >= 1) {
            syncVideoState();
        } else if (videoEl) {
            videoEl.addEventListener('loadedmetadata', () => {
                syncVideoState();
            }, { once: true });
        }
    } else {
        if (videoEl) videoEl.src = '';
        document.getElementById('no-video-placeholder').classList.remove('hidden');
    }

    // Show/hide remove buttons
    document.querySelectorAll('.playlist-item-remove').forEach(btn => {
        btn.style.display = appState.nickname === appState.leader ? '' : 'none';
    });
}

function syncVideoState() {
    if (!videoEl || !videoEl.src) return;

    const timeDiff = Math.abs(videoEl.currentTime - appState.currentTime);
    if (timeDiff > 0.5 && appState.nickname !== appState.leader) {
        videoEl.currentTime = appState.currentTime;
    }

    if (appState.isPlaying && videoEl.paused) {
        videoEl.play().catch(() => {});
    } else if (!appState.isPlaying && !videoEl.paused) {
        videoEl.pause();
    }

    updatePlayIcon();
}

function handleTimeUpdate(data) {
    if (appState.nickname === appState.leader) return; // leader is source of truth
    if (!videoEl || !videoEl.src) return;

    appState.currentTime = data.time;
    appState.isPlaying = data.playing;

    const timeDiff = Math.abs(videoEl.currentTime - data.time);
    if (timeDiff > 0.5) {
        videoEl.currentTime = data.time;
    }

    if (data.playing && videoEl.paused) {
        videoEl.play().catch(() => {});
    } else if (!data.playing && !videoEl.paused) {
        videoEl.pause();
    }

    updatePlayIcon();
}

function handleVideoPause(data) {
    appState.isPlaying = false;
    appState.pausedBy = data.paused_by;
    if (videoEl) {
        videoEl.currentTime = data.time;
        videoEl.pause();
    }
    updatePlayIcon();
    updatePausedIndicator();
}

function handleVideoResume(data) {
    appState.isPlaying = true;
    appState.pausedBy = null;
    if (videoEl) {
        videoEl.currentTime = data.time;
        videoEl.play().catch(() => {});
    }
    updatePlayIcon();
    updatePausedIndicator();
}

function handleVideoSeek(data) {
    appState.currentTime = data.time;
    if (videoEl) {
        videoEl.currentTime = data.time;
    }
}

function updatePlayIcon() {
    const icon = document.getElementById('play-icon');
    if (!icon) return;
    if (appState.isPlaying) {
        icon.className = 'nf nf-fa-pause';
    } else {
        icon.className = 'nf nf-fa-play';
    }
}

function updatePausedIndicator() {
    const indicator = document.getElementById('paused-indicator');
    if (!indicator) return;
    if (appState.pausedBy && !appState.isPlaying) {
        indicator.classList.remove('hidden');
        indicator.textContent = t('player.paused_by') + ': ' + appState.pausedBy;
    } else {
        indicator.classList.add('hidden');
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return m + ':' + String(s).padStart(2, '0');
}
