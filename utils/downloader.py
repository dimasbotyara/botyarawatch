import subprocess
import json
import os
import uuid
import re
import threading
from config import DOWNLOADS_DIR, YTDLP_FORMAT
from utils.video_cache import find_cached_video, add_video_to_cache


class VideoDownloader:
    def __init__(self, socketio):
        self.socketio = socketio
        self.active_downloads = {}

    def get_video_info(self, url):
        """Получает информацию о видео без скачивания."""
        try:
            result = subprocess.run(
                ['yt-dlp', '--dump-json', '--no-download', url],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                info = json.loads(result.stdout)
                return {
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'url': url
                }
        except Exception as e:
            print(f"[Downloader] Error getting info: {e}")
        return None

    def download_video(self, url, added_by, download_id=None):
        """Скачивает видео в фоновом потоке."""
        if download_id is None:
            download_id = str(uuid.uuid4())[:8]

        thread = threading.Thread(
            target=self._download_worker,
            args=(url, added_by, download_id),
            daemon=True
        )
        thread.start()
        return download_id

    def _download_worker(self, url, added_by, download_id):
        try:
            # Получаем инфо
            self.socketio.emit('download_progress', {
                'download_id': download_id,
                'status': 'getting_info',
                'message': 'Getting video info...'
            })

            info = self.get_video_info(url)
            if not info:
                self.socketio.emit('download_progress', {
                    'download_id': download_id,
                    'status': 'error',
                    'message': 'Failed to get video info'
                })
                return

            title = info['title']
            duration = info['duration']

            # Проверяем кеш
            cached = find_cached_video(title)
            if cached:
                self.socketio.emit('download_progress', {
                    'download_id': download_id,
                    'status': 'cached',
                    'message': 'Video already downloaded!',
                    'video': {
                        'video_id': cached['video_id'],
                        'title': cached['title'],
                        'filepath': cached['filepath'],
                        'duration': cached.get('duration', 0),
                        'added_by': added_by
                    }
                })
                return

            # Скачиваем
            video_id = str(uuid.uuid4())[:12]
            safe_title = re.sub(r'[^\w\s\-\.]', '_', title)[:80]
            output_path = os.path.join(DOWNLOADS_DIR, f"{video_id}_{safe_title}.mp4")

            self.socketio.emit('download_progress', {
                'download_id': download_id,
                'status': 'downloading',
                'title': title,
                'percent': 0,
                'speed': '',
                'eta': ''
            })

            process = subprocess.Popen(
                [
                    'yt-dlp',
                    '-f', YTDLP_FORMAT,
                    '--merge-output-format', 'mp4',
                    '-o', output_path,
                    '--newline',
                    '--progress',
                    url
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )

            self.active_downloads[download_id] = process

            for line in process.stdout:
                line = line.strip()
                if '[download]' in line and '%' in line:
                    parsed = self._parse_progress(line)
                    if parsed:
                        self.socketio.emit('download_progress', {
                            'download_id': download_id,
                            'status': 'downloading',
                            'title': title,
                            **parsed
                        })

            process.wait()

            if download_id in self.active_downloads:
                del self.active_downloads[download_id]

            if process.returncode == 0:
                # Ищем выходной файл (yt-dlp может добавить расширение)
                actual_path = output_path
                if not os.path.exists(actual_path):
                    # Ищем файлы, начинающиеся с video_id
                    for f in os.listdir(DOWNLOADS_DIR):
                        if f.startswith(video_id):
                            actual_path = os.path.join(DOWNLOADS_DIR, f)
                            break

                if os.path.exists(actual_path):
                    video_info = add_video_to_cache(
                        video_id, title, actual_path,
                        source_url=url, duration=duration
                    )
                    self.socketio.emit('download_progress', {
                        'download_id': download_id,
                        'status': 'complete',
                        'message': 'Download complete!',
                        'video': {
                            'video_id': video_id,
                            'title': title,
                            'filepath': actual_path,
                            'duration': duration,
                            'added_by': added_by
                        }
                    })
                else:
                    self.socketio.emit('download_progress', {
                        'download_id': download_id,
                        'status': 'error',
                        'message': 'Download finished but file not found'
                    })
            else:
                self.socketio.emit('download_progress', {
                    'download_id': download_id,
                    'status': 'error',
                    'message': 'Download failed'
                })

        except Exception as e:
            self.socketio.emit('download_progress', {
                'download_id': download_id,
                'status': 'error',
                'message': str(e)
            })

    def _parse_progress(self, line):
        """Парсит строку прогресса yt-dlp."""
        try:
            percent = 0
            speed = ''
            eta = ''
            size = ''

            # [download]  45.2% of 150.00MiB at 5.00MiB/s ETA 00:16
            m_percent = re.search(r'([\d.]+)%', line)
            if m_percent:
                percent = float(m_percent.group(1))

            m_speed = re.search(r'at\s+([\d.]+\w+/s)', line)
            if m_speed:
                speed = m_speed.group(1)

            m_eta = re.search(r'ETA\s+([\d:]+)', line)
            if m_eta:
                eta = m_eta.group(1)

            m_size = re.search(r'of\s+~?([\d.]+\w+)', line)
            if m_size:
                size = m_size.group(1)

            return {
                'percent': percent,
                'speed': speed,
                'eta': eta,
                'size': size
            }
        except Exception:
            return None
