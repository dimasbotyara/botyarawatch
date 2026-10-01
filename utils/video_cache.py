import json
import os
import time
from config import METADATA_FILE, DOWNLOADS_DIR


def _load_metadata():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_metadata(data):
    os.makedirs(os.path.dirname(METADATA_FILE), exist_ok=True)
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def find_cached_video(title):
    """Ищет видео по названию в кеше. Возвращает путь к файлу или None."""
    metadata = _load_metadata()
    for video_id, info in metadata.items():
        if info.get('title', '').strip().lower() == title.strip().lower():
            filepath = info.get('filepath', '')
            if os.path.exists(filepath):
                return info
    return None


def add_video_to_cache(video_id, title, filepath, source_url=None, duration=None):
    """Добавляет видео в кеш."""
    metadata = _load_metadata()
    metadata[video_id] = {
        'title': title,
        'filepath': filepath,
        'source_url': source_url,
        'duration': duration,
        'downloaded_at': time.time(),
        'watched': False,
        'video_id': video_id
    }
    _save_metadata(metadata)
    return metadata[video_id]


def mark_video_watched(video_id):
    """Помечает видео как просмотренное."""
    metadata = _load_metadata()
    if video_id in metadata:
        metadata[video_id]['watched'] = True
        metadata[video_id]['watched_at'] = time.time()
        _save_metadata(metadata)


def get_all_videos():
    """Возвращает все видео из кеша."""
    metadata = _load_metadata()
    # Удаляем записи о несуществующих файлах
    cleaned = {}
    for vid, info in metadata.items():
        if os.path.exists(info.get('filepath', '')):
            cleaned[vid] = info
    if len(cleaned) != len(metadata):
        _save_metadata(cleaned)
    return cleaned


def remove_video_from_cache(video_id):
    """Удаляет видео из кеша и с диска."""
    metadata = _load_metadata()
    if video_id in metadata:
        filepath = metadata[video_id].get('filepath', '')
        if os.path.exists(filepath):
            os.remove(filepath)
        del metadata[video_id]
        _save_metadata(metadata)
        return True
    return False
