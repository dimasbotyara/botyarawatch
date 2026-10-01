import threading
import time
import os
from config import (
    VIDEO_MAX_AGE_DAYS, VIDEO_WATCHED_AGE_DAYS,
    CLEANUP_INTERVAL_SECONDS
)
from utils.video_cache import get_all_videos, remove_video_from_cache


def cleanup_old_videos():
    """Удаляет старые видео."""
    now = time.time()
    videos = get_all_videos()

    for video_id, info in videos.items():
        downloaded_at = info.get('downloaded_at', 0)
        watched = info.get('watched', False)

        if watched:
            max_age = VIDEO_WATCHED_AGE_DAYS * 86400
        else:
            max_age = VIDEO_MAX_AGE_DAYS * 86400

        if now - downloaded_at > max_age:
            remove_video_from_cache(video_id)
            print(f"[Cleaner] Removed old video: {info.get('title', video_id)}")


def start_cleanup_thread():
    """Запускает фоновый поток автоочистки."""
    def loop():
        while True:
            try:
                cleanup_old_videos()
            except Exception as e:
                print(f"[Cleaner] Error: {e}")
            time.sleep(CLEANUP_INTERVAL_SECONDS)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
    print("[Cleaner] Background cleanup thread started")
