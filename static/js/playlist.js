function renderPlaylist() {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    if (appState.playlist.length === 0) {
        container.innerHTML = `<div class="playlist-empty" data-i18n="playlist.empty">${t('playlist.empty')}</div>`;
        return;
    }

    container.innerHTML = '';

    appState.playlist.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item' + (index === appState.currentVideoIndex ? ' current' : '');

        const duration = video.duration ? formatTime(video.duration) : '--:--';

        item.innerHTML = `
            <div class="playlist-item-index">${index === appState.currentVideoIndex ? '▶' : index + 1}</div>
            <div class="playlist-item-info">
                <div class="playlist-item-title" title="${escapeHtml(video.title || '?')}">${escapeHtml(video.title || '?')}</div>
                <div class="playlist-item-meta">${t('added_by')} ${escapeHtml(video.added_by || '?')} · ${duration}</div>
            </div>
            <button class="playlist-item-remove" data-index="${index}" title="Remove"
                    style="display:${appState.nickname === appState.leader ? '' : 'none'}">
                <span class="nf nf-md-close"></span>
            </button>
        `;

        const removeBtn = item.querySelector('.playlist-item-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                socket.emit('playlist_remove', { index });
            });
        }

        container.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
