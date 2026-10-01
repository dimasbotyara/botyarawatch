// Global state
const appState = {
    nickname: '',
    users: [],
    playlist: [],
    currentVideoIndex: -1,
    currentTime: 0,
    isPlaying: false,
    leader: null,
    pausedBy: null,
    activeVote: null,
};

function updateHeaderInfo() {
    const usersEl = document.getElementById('header-users');
    const leaderEl = document.getElementById('header-leader');

    if (usersEl) {
        usersEl.innerHTML = `<span class="nf nf-md-account_group"></span> ${t('header.users')}: ${appState.users.length}`;
    }

    if (leaderEl) {
        const isMe = appState.leader === appState.nickname;
        leaderEl.innerHTML = `<span class="nf nf-md-crown"></span> ${t('header.leader')}: ${appState.leader || '—'} ${isMe ? t('header.you') : ''}`;
    }
}

function initSidebarTabs() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    const panels = document.querySelectorAll('.sidebar-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');

            // Clear badge
            if (tab.dataset.tab === 'chat') {
                chatUnread = 0;
                updateChatBadge();
                scrollChatToBottom();
            }
        });
    });
}

function initMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('mobile-sidebar-toggle');

    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
        });
    }

    // Swipe to open/close on mobile tabs area
    let touchStartY = 0;
    const sidebarTabs = sidebar.querySelector('.sidebar-tabs');

    if (sidebarTabs) {
        sidebarTabs.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        sidebarTabs.addEventListener('touchend', (e) => {
            const diff = touchStartY - e.changedTouches[0].clientY;
            if (diff > 30) {
                sidebar.classList.add('sidebar-open');
            } else if (diff < -30) {
                sidebar.classList.remove('sidebar-open');
            }
        }, { passive: true });
    }
}

function initLogin() {
    const input = document.getElementById('nickname-input');
    const btn = document.getElementById('join-btn');
    const savedNick = localStorage.getItem('botyara_nickname');

    if (savedNick) {
        input.value = savedNick;
    }

    function doJoin() {
        const nick = input.value.trim();
        if (!nick) return;
        appState.nickname = nick;
        joinRoom(nick);
    }

    btn.addEventListener('click', doJoin);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doJoin();
    });

    // Focus
    input.focus();
}

// ============================
// INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    initSocket();
    initLogin();
    initSidebarTabs();
    initMobileSidebar();
    initPlayer();
    initChat();
    initUpload();
    applyI18N();
});
