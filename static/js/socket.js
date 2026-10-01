let socket = null;

function initSocket() {
    socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity,
    });

    // Heartbeat
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('heartbeat');
        }
    }, 3000);

    socket.on('connect', () => {
        console.log('[Socket] Connected');
        if (appState.nickname) {
            joinRoom(appState.nickname);
        }
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
    });

    socket.on('join_success', (data) => {
        appState.nickname = data.nickname;
        localStorage.setItem('botyara_nickname', data.nickname);

        // Hide login, show app
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        // Sync state
        handleStateSync(data.state);

        // Load chat history
        if (data.chat_history) {
            data.chat_history.forEach(msg => appendChatMessage(msg, false));
            scrollChatToBottom();
        }
    });

    socket.on('join_error', (data) => {
        const errEl = document.getElementById('login-error');
        if (errEl) {
            errEl.textContent = currentLang === 'ru' ? data.message_ru : data.message;
        }
    });

    socket.on('state_sync', (data) => {
        handleStateSync(data);
    });

    socket.on('users_update', (data) => {
        appState.users = data.users;
        updateHeaderInfo();
    });

    socket.on('time_update', (data) => {
        handleTimeUpdate(data);
    });

    socket.on('video_pause', (data) => {
        handleVideoPause(data);
    });

    socket.on('video_resume', (data) => {
        handleVideoResume(data);
    });

    socket.on('video_seek', (data) => {
        handleVideoSeek(data);
    });

    socket.on('chat_message', (msg) => {
        appendChatMessage(msg, true);
    });

    socket.on('download_progress', (data) => {
        handleDownloadProgress(data);
    });

    socket.on('download_started', (data) => {
        // Noop — handled in upload.js
    });

    socket.on('not_leader', () => {
        showNotification(currentLang === 'ru' ? 'Только лидер может это делать' : 'Only the leader can do that');
    });

    socket.on('vote_error', (data) => {
        showNotification(currentLang === 'ru' ? data.message_ru : data.message);
    });
}

function joinRoom(nickname) {
    const uuid = getCookie('botyara_uuid') || '';
    socket.emit('join', { nickname, uuid });
}

function getCookie(name) {
    const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
}
