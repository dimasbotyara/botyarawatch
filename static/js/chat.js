let chatUnread = 0;

function initChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        socket.emit('chat_send', { text });
        input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
}

function appendChatMessage(msg, notify) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const el = document.createElement('div');
    const time = new Date(msg.timestamp * 1000);
    const timeStr = time.getHours().toString().padStart(2, '0') + ':' +
                    time.getMinutes().toString().padStart(2, '0');

    if (msg.type === 'system') {
        el.className = 'chat-msg chat-msg-system';
        const text = currentLang === 'ru' ? msg.text_ru : msg.text_en;
        el.innerHTML = `${escapeHtml(text)} <span class="chat-msg-time">${timeStr}</span>`;
    } else {
        el.className = 'chat-msg chat-msg-user';
        el.innerHTML = `<span class="chat-msg-nick">${escapeHtml(msg.nickname)}</span><span class="chat-msg-text">${escapeHtml(msg.text)}</span> <span class="chat-msg-time">${timeStr}</span>`;
    }

    container.appendChild(el);

    // Auto-scroll
    const panel = container.closest('.panel-content');
    if (panel) {
        const isNearBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 100;
        if (isNearBottom) {
            panel.scrollTop = panel.scrollHeight;
        }
    }

    // Badge
    if (notify) {
        const activeTab = document.querySelector('.sidebar-tab.active');
        if (!activeTab || activeTab.dataset.tab !== 'chat') {
            chatUnread++;
            updateChatBadge();
        }

        // Notification for system msgs about voting/leader
        if (msg.type === 'system') {
            const text = currentLang === 'ru' ? msg.text_ru : msg.text_en;
            if (text.includes('🗳')) {
                showNotification(t('notif.vote_started'));
            }
        }
    }
}

function scrollChatToBottom() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const panel = container.closest('.panel-content');
    if (panel) {
        panel.scrollTop = panel.scrollHeight;
    }
}

function updateChatBadge() {
    const badge = document.getElementById('chat-badge');
    if (!badge) return;
    if (chatUnread > 0) {
        badge.textContent = chatUnread > 99 ? '99+' : chatUnread;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
