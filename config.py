import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Папка для скачанных видео
DOWNLOADS_DIR = os.path.join(BASE_DIR, 'downloads')
METADATA_FILE = os.path.join(DOWNLOADS_DIR, 'metadata.json')
CHAT_HISTORY_FILE = os.path.join(BASE_DIR, 'chat_history.json')

# Автоочистка
VIDEO_MAX_AGE_DAYS = 7
VIDEO_WATCHED_AGE_DAYS = 1
CLEANUP_INTERVAL_SECONDS = 3600  # 1 час

# Голосования
VOTE_TIMEOUT_SECONDS = 30
VOTE_COOLDOWN_SECONDS = 60

# Синхронизация
SYNC_INTERVAL_SECONDS = 2
SYNC_THRESHOLD_SECONDS = 0.5

# Heartbeat
HEARTBEAT_INTERVAL_SECONDS = 3
HEARTBEAT_TIMEOUT_SECONDS = 10

# yt-dlp
YTDLP_FORMAT = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'

# Сервер
HOST = '0.0.0.0'
PORT = 5000
SECRET_KEY = 'botyarawatch-secret-key-2024'

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
