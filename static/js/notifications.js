function showNotification(text, duration = 4000) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = text;
    container.appendChild(notif);

    setTimeout(() => {
        notif.classList.add('hiding');
        setTimeout(() => notif.remove(), 300);
    }, duration);
}
