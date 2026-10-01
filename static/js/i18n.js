const I18N = {
    en: {
        'login.subtitle': 'Watch together',
        'login.placeholder': 'Enter nickname...',
        'login.join': 'Join',
        'sidebar.playlist': 'Playlist',
        'sidebar.chat': 'Chat',
        'sidebar.voting': 'Vote',
        'player.no_video': 'Add a video to start watching',
        'playlist.empty': 'Playlist is empty',
        'playlist.add': 'Add Video',
        'chat.placeholder': 'Type a message...',
        'modal.add_video': 'Add Video',
        'modal.by_url': 'By URL',
        'modal.by_file': 'Local File',
        'modal.download': 'Download',
        'modal.drop_hint': 'Drag & drop a video file here',
        'modal.or': 'or',
        'modal.browse': 'Browse',
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.theme': 'Theme',
        'settings.accent': 'Accent Color',
        'settings.nickname': 'Nickname',
        'vote.skip_title': 'Skip Video',
        'vote.skip_desc': 'Vote to skip the current video',
        'vote.leader_title': 'Change Leader',
        'vote.leader_desc': 'Vote to change the session leader',
        'vote.select_leader': 'Select new leader:',
        'vote.yes': 'Yes',
        'vote.no': 'No',
        'vote.started_by': 'Started by',
        'vote.votes': 'votes',
        'vote.required': 'required',
        'vote.cooldown': 'Cooldown between votes',
        'vote.already_voted': 'You already voted',
        'header.users': 'Online',
        'header.leader': 'Leader',
        'header.you': '(you)',
        'player.paused_by': 'Paused by',
        'upload.getting_info': 'Getting video info...',
        'upload.downloading': 'Downloading...',
        'upload.complete': 'Download complete!',
        'upload.cached': 'Video already downloaded!',
        'upload.error': 'Download error',
        'upload.uploading': 'Uploading file...',
        'added_by': 'added by',
        'notif.vote_started': 'New vote started!',
        'notif.leader_changed': 'Leader changed!',
    },
    ru: {
        'login.subtitle': 'Смотрим вместе',
        'login.placeholder': 'Введите никнейм...',
        'login.join': 'Войти',
        'sidebar.playlist': 'Плейлист',
        'sidebar.chat': 'Чат',
        'sidebar.voting': 'Голосования',
        'player.no_video': 'Добавьте видео, чтобы начать просмотр',
        'playlist.empty': 'Плейлист пуст',
        'playlist.add': 'Добавить видео',
        'chat.placeholder': 'Введите сообщение...',
        'modal.add_video': 'Добавить видео',
        'modal.by_url': 'По ссылке',
        'modal.by_file': 'Локальный файл',
        'modal.download': 'Скачать',
        'modal.drop_hint': 'Перетащите видеофайл сюда',
        'modal.or': 'или',
        'modal.browse': 'Выбрать файл',
        'settings.title': 'Настройки',
        'settings.language': 'Язык',
        'settings.theme': 'Тема',
        'settings.accent': 'Акцентный цвет',
        'settings.nickname': 'Никнейм',
        'vote.skip_title': 'Пропустить видео',
        'vote.skip_desc': 'Голосование за пропуск текущего видео',
        'vote.leader_title': 'Сменить лидера',
        'vote.leader_desc': 'Голосование за смену лидера сессии',
        'vote.select_leader': 'Выберите нового лидера:',
        'vote.yes': 'За',
        'vote.no': 'Против',
        'vote.started_by': 'Начал',
        'vote.votes': 'голосов',
        'vote.required': 'нужно',
        'vote.cooldown': 'Кулдаун между голосованиями',
        'vote.already_voted': 'Вы уже проголосовали',
        'header.users': 'Онлайн',
        'header.leader': 'Лидер',
        'header.you': '(вы)',
        'player.paused_by': 'На паузу поставил',
        'upload.getting_info': 'Получение информации...',
        'upload.downloading': 'Загрузка...',
        'upload.complete': 'Загрузка завершена!',
        'upload.cached': 'Видео уже скачано!',
        'upload.error': 'Ошибка загрузки',
        'upload.uploading': 'Загрузка файла...',
        'added_by': 'добавил',
        'notif.vote_started': 'Начато новое голосование!',
        'notif.leader_changed': 'Лидер изменён!',
    }
};

let currentLang = 'en';

function detectLanguage() {
    const saved = localStorage.getItem('botyara_lang');
    if (saved && I18N[saved]) return saved;
    const nav = navigator.language || navigator.userLanguage || 'en';
    return nav.startsWith('ru') ? 'ru' : 'en';
}

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || (I18N['en'][key]) || key;
}

function setLanguage(lang) {
    if (!I18N[lang]) lang = 'en';
    currentLang = lang;
    localStorage.setItem('botyara_lang', lang);
    applyI18N();
}

function applyI18N() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}
