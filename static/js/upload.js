let activeDownloadId = null;

function initUpload() {
    const addBtn = document.getElementById('add-video-btn');
    const modal = document.getElementById('add-video-modal');
    const closeBtn = document.getElementById('modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    const urlInput = document.getElementById('video-url-input');
    const urlSubmit = document.getElementById('url-submit-btn');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('file-browse-btn');

    // Modal tabs
    const modalTabs = modal.querySelectorAll('.modal-tab');
    const modalPanels = modal.querySelectorAll('.modal-tab-panel');

    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            modalPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            modal.querySelector(`[data-mpanel="${tab.dataset.mtab}"]`).classList.add('active');
        });
    });

    // Open/Close modal
    addBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        resetDownloadProgress();
        urlInput.value = '';
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    backdrop.addEventListener('click', () => modal.classList.add('hidden'));

    // URL submit
    urlSubmit.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;
        urlSubmit.disabled = true;
        socket.emit('playlist_add_url', { url });
        showDownloadProgress();
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') urlSubmit.click();
    });

    // File upload
    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            uploadLocalFile(fileInput.files[0]);
        }
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            uploadLocalFile(e.dataTransfer.files[0]);
        }
    });
}

function uploadLocalFile(file) {
    showDownloadProgress();
    const progressEl = document.getElementById('download-progress');
    const titleEl = document.getElementById('download-title');
    const barEl = document.getElementById('download-bar');
    const percentEl = document.getElementById('download-percent');
    const speedEl = document.getElementById('download-speed');
    const statusEl = document.getElementById('download-status');

    titleEl.textContent = file.name;
    statusEl.textContent = t('upload.uploading');

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload_local');

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100;
            barEl.style.width = pct + '%';
            percentEl.textContent = Math.round(pct) + '%';
            speedEl.textContent = formatBytes(e.loaded) + ' / ' + formatBytes(e.total);
        }
    });

    xhr.addEventListener('load', () => {
        try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.status === 'ok' && resp.video) {
                barEl.style.width = '100%';
                percentEl.textContent = '100%';
                statusEl.textContent = t('upload.complete');
                statusEl.style.color = 'var(--accent)';

                // Add to playlist
                socket.emit('playlist_add_local', { video: resp.video });

                setTimeout(() => {
                    document.getElementById('add-video-modal').classList.add('hidden');
                    resetDownloadProgress();
                }, 1500);
            } else {
                statusEl.textContent = t('upload.error') + ': ' + (resp.error || '');
                statusEl.style.color = '#f38ba8';
            }
        } catch (e) {
            statusEl.textContent = t('upload.error');
            statusEl.style.color = '#f38ba8';
        }
        document.getElementById('url-submit-btn').disabled = false;
    });

    xhr.addEventListener('error', () => {
        statusEl.textContent = t('upload.error');
        statusEl.style.color = '#f38ba8';
        document.getElementById('url-submit-btn').disabled = false;
    });

    xhr.send(formData);
}

function showDownloadProgress() {
    const el = document.getElementById('download-progress');
    if (el) el.classList.remove('hidden');
}

function resetDownloadProgress() {
    const el = document.getElementById('download-progress');
    if (el) el.classList.add('hidden');
    const barEl = document.getElementById('download-bar');
    if (barEl) barEl.style.width = '0%';
    const percentEl = document.getElementById('download-percent');
    if (percentEl) percentEl.textContent = '0%';
    const speedEl = document.getElementById('download-speed');
    if (speedEl) speedEl.textContent = '';
    const etaEl = document.getElementById('download-eta');
    if (etaEl) etaEl.textContent = '';
    const statusEl = document.getElementById('download-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
    const titleEl = document.getElementById('download-title');
    if (titleEl) titleEl.textContent = '';
    document.getElementById('url-submit-btn').disabled = false;
}

function handleDownloadProgress(data) {
    const progressEl = document.getElementById('download-progress');
    const titleEl = document.getElementById('download-title');
    const barEl = document.getElementById('download-bar');
    const percentEl = document.getElementById('download-percent');
    const speedEl = document.getElementById('download-speed');
    const etaEl = document.getElementById('download-eta');
    const statusEl = document.getElementById('download-status');

    if (!progressEl) return;
    progressEl.classList.remove('hidden');

    switch (data.status) {
        case 'getting_info':
            titleEl.textContent = t('upload.getting_info');
            statusEl.textContent = data.message;
            break;

        case 'downloading':
            titleEl.textContent = data.title || '';
            barEl.style.width = (data.percent || 0) + '%';
            percentEl.textContent = Math.round(data.percent || 0) + '%';
            speedEl.textContent = data.speed || '';
            etaEl.textContent = data.eta ? 'ETA ' + data.eta : '';
            statusEl.textContent = t('upload.downloading');
            break;

        case 'complete':
            barEl.style.width = '100%';
            percentEl.textContent = '100%';
            statusEl.textContent = t('upload.complete');
            statusEl.style.color = 'var(--accent)';

            // Add to playlist
            if (data.video) {
                socket.emit('playlist_add_complete', { video: data.video });
            }

            setTimeout(() => {
                document.getElementById('add-video-modal').classList.add('hidden');
                resetDownloadProgress();
            }, 2000);
            break;

        case 'cached':
            barEl.style.width = '100%';
            percentEl.textContent = '100%';
            statusEl.textContent = t('upload.cached');
            statusEl.style.color = 'var(--accent)';

            if (data.video) {
                socket.emit('playlist_add_complete', { video: data.video });
            }

            setTimeout(() => {
                document.getElementById('add-video-modal').classList.add('hidden');
                resetDownloadProgress();
            }, 1500);
            break;

        case 'error':
            statusEl.textContent = t('upload.error') + ': ' + (data.message || '');
            statusEl.style.color = '#f38ba8';
            document.getElementById('url-submit-btn').disabled = false;
            break;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
