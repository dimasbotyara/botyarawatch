// Theme accent palettes
const THEME_ACCENTS = {
    'catppuccin-mocha': [
        { name: 'green', color: '#a6e3a1' },
        { name: 'mauve', color: '#cba6f7' },
        { name: 'pink', color: '#f5c2e7' },
        { name: 'peach', color: '#fab387' },
        { name: 'blue', color: '#89b4fa' },
        { name: 'lavender', color: '#b4befe' },
    ],
    'catppuccin-macchiato': [
        { name: 'teal', color: '#8bd5ca' },
        { name: 'sapphire', color: '#7dc4e4' },
        { name: 'pink', color: '#f5bde6' },
        { name: 'flamingo', color: '#f0c6c6' },
        { name: 'yellow', color: '#eed49f' },
        { name: 'mauve', color: '#c6a0f6' },
    ],
    'catppuccin-frappe': [
        { name: 'sky', color: '#99d1db' },
        { name: 'maroon', color: '#ea999c' },
        { name: 'green', color: '#a6d189' },
        { name: 'rosewater', color: '#f2d5cf' },
        { name: 'blue', color: '#8caaee' },
        { name: 'peach', color: '#ef9f76' },
    ],
    'catppuccin-latte': [
        { name: 'green', color: '#40a02b' },
        { name: 'mauve', color: '#8839ef' },
        { name: 'flamingo', color: '#dd7878' },
        { name: 'sapphire', color: '#209fb5' },
        { name: 'teal', color: '#179299' },
        { name: 'red', color: '#d20f39' },
    ],
    'tokyo-night': [
        { name: 'cyan', color: '#7dcfff' },
        { name: 'purple', color: '#bb9af7' },
        { name: 'blue', color: '#7aa2f7' },
        { name: 'magenta', color: '#ff007c' },
        { name: 'green', color: '#9ece6a' },
        { name: 'orange', color: '#ff9e64' },
    ],
    'gruvbox-dark': [
        { name: 'aqua', color: '#8ec07c' },
        { name: 'orange', color: '#fe8019' },
        { name: 'green', color: '#b8bb26' },
        { name: 'yellow', color: '#fabd2f' },
        { name: 'purple', color: '#d3869b' },
        { name: 'red', color: '#fb4934' },
    ],
    'nord': [
        { name: 'frost-blue', color: '#88c0d0' },
        { name: 'green', color: '#a3be8c' },
        { name: 'purple', color: '#b48ead' },
        { name: 'snow', color: '#e5e9f0' },
        { name: 'orange', color: '#d08770' },
        { name: 'red', color: '#bf616a' },
    ],
    'rose-pine': [
        { name: 'rose', color: '#ebbcba' },
        { name: 'iris', color: '#c4a7e7' },
        { name: 'foam', color: '#9ccfd8' },
        { name: 'gold', color: '#f6c177' },
        { name: 'pine', color: '#31748f' },
        { name: 'love', color: '#eb6f92' },
    ],
};

function getDefaultAccent(theme) {
    const accents = THEME_ACCENTS[theme];
    return accents ? accents[0].name : 'green';
}

function loadSettings() {
    const settings = {
        theme: localStorage.getItem('botyara_theme') || 'catppuccin-mocha',
        accent: localStorage.getItem('botyara_accent') || 'green',
        lang: localStorage.getItem('botyara_lang') || detectLanguage(),
        nickname: localStorage.getItem('botyara_nickname') || '',
    };
    return settings;
}

function saveSettings(settings) {
    localStorage.setItem('botyara_theme', settings.theme);
    localStorage.setItem('botyara_accent', settings.accent);
    localStorage.setItem('botyara_lang', settings.lang);
    if (settings.nickname) {
        localStorage.setItem('botyara_nickname', settings.nickname);
    }
}

function applyTheme(theme, accent) {
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-accent', accent);
}

function renderAccentPalette(theme) {
    const palette = document.getElementById('accent-palette');
    if (!palette) return;
    palette.innerHTML = '';

    const accents = THEME_ACCENTS[theme] || [];
    const currentAccent = document.body.getAttribute('data-accent');

    accents.forEach(a => {
        const swatch = document.createElement('div');
        swatch.className = 'accent-swatch' + (a.name === currentAccent ? ' active' : '');
        swatch.style.background = a.color;
        swatch.setAttribute('data-accent-name', a.name);
        swatch.title = a.name;

        swatch.addEventListener('click', () => {
            document.body.setAttribute('data-accent', a.name);
            localStorage.setItem('botyara_accent', a.name);
            palette.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });

        palette.appendChild(swatch);
    });
}

function initSettings() {
    const settings = loadSettings();
    applyTheme(settings.theme, settings.accent);
    setLanguage(settings.lang);

    const themeSelect = document.getElementById('setting-theme');
    const langSelect = document.getElementById('setting-lang');
    const nicknameInput = document.getElementById('setting-nickname');

    if (themeSelect) {
        themeSelect.value = settings.theme;
        themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value;
            const defaultAccent = getDefaultAccent(newTheme);
            applyTheme(newTheme, defaultAccent);
            localStorage.setItem('botyara_theme', newTheme);
            localStorage.setItem('botyara_accent', defaultAccent);
            renderAccentPalette(newTheme);
        });
    }

    if (langSelect) {
        langSelect.value = settings.lang;
        langSelect.addEventListener('change', () => {
            setLanguage(langSelect.value);
            // Re-render dynamic content
            if (typeof renderVoting === 'function') renderVoting();
            if (typeof renderPlaylist === 'function') renderPlaylist();
            updateHeaderInfo();
        });
    }

    if (nicknameInput) {
        nicknameInput.value = settings.nickname;
    }

    // Settings modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
            renderAccentPalette(document.body.getAttribute('data-theme'));
            if (nicknameInput) nicknameInput.value = appState.nickname || '';
        });
    }

    if (settingsClose) {
        settingsClose.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    if (settingsModal) {
        settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }
}
