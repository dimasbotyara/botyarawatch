import os
import json
import time
import uuid
import math
import threading
from flask import Flask, render_template, send_from_directory, request, make_response
from flask_socketio import SocketIO, emit
from config import (
    HOST, PORT, SECRET_KEY, DOWNLOADS_DIR,
    VOTE_TIMEOUT_SECONDS, VOTE_COOLDOWN_SECONDS,
    HEARTBEAT_TIMEOUT_SECONDS, CHAT_HISTORY_FILE
)
from utils.downloader import VideoDownloader
from utils.cleaner import start_cleanup_thread
from utils.video_cache import mark_video_watched, get_all_videos

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY

socketio = SocketIO(app, async_mode='gevent', cors_allowed_origins="*",
                    max_http_buffer_size=500 * 1024 * 1024)

downloader = VideoDownloader(socketio)

# ========================
# Глобальное состояние
# ========================

users = {}  # sid -> {nickname, uuid, ip, last_heartbeat, online}
playlist = []  # [{video_id, title, filepath, duration, added_by}, ...]
current_video_index = -1
current_time = 0.0
is_playing = False
leader_nickname = None
paused_by = None

# Голосование
active_vote = None  # {type, started_by, started_at, votes_yes: set, votes_no: set, required, timer}
last_vote_time = 0

# Чат
chat_history = []


def load_chat_history():
    global chat_history
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, 'r', encoding='utf-8') as f:
                chat_history = json.load(f)
                # Ограничиваем до 500 последних
                chat_history = chat_history[-500:]
        except (json.JSONDecodeError, IOError):
            chat_history = []


def save_chat_history():
    try:
        with open(CHAT_HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(chat_history[-500:], f, ensure_ascii=False)
    except IOError:
        pass


load_chat_history()


def get_online_users():
    """Возвращает список онлайн пользователей."""
    now = time.time()
    online = []
    for sid, user in users.items():
        if now - user.get('last_heartbeat', 0) < HEARTBEAT_TIMEOUT_SECONDS:
            user['online'] = True
            online.append(user)
        else:
            user['online'] = False
    return online


def get_online_nicknames():
    return [u['nickname'] for u in get_online_users()]


def get_online_count():
    return len(get_online_users())


def find_sid_by_nickname(nickname):
    for sid, user in users.items():
        if user['nickname'] == nickname and user.get('online', False):
            return sid
    return None


def get_state():
    """Возвращает полное состояние для синхронизации."""
    return {
        'playlist': playlist,
        'current_video_index': current_video_index,
        'current_time': current_time,
        'is_playing': is_playing,
        'leader': leader_nickname,
        'paused_by': paused_by,
        'users': get_online_nicknames(),
        'active_vote': serialize_vote(),
    }


def serialize_vote():
    if active_vote is None:
        return None
    return {
        'type': active_vote['type'],
        'started_by': active_vote['started_by'],
        'started_at': active_vote['started_at'],
        'votes_yes': list(active_vote['votes_yes']),
        'votes_no': list(active_vote['votes_no']),
        'required': active_vote['required'],
        'timeout': VOTE_TIMEOUT_SECONDS,
        'elapsed': time.time() - active_vote['started_at'],
        'target': active_vote.get('target', None)
    }


def broadcast_state():
    socketio.emit('state_sync', get_state())


def broadcast_users():
    socketio.emit('users_update', {'users': get_online_nicknames()})


def add_system_message(text_ru, text_en):
    msg = {
        'type': 'system',
        'text_ru': text_ru,
        'text_en': text_en,
        'timestamp': time.time()
    }
    chat_history.append(msg)
    save_chat_history()
    socketio.emit('chat_message', msg)


def transfer_leadership(reason_ru="", reason_en=""):
    """Передаёт лидерство."""
    global leader_nickname

    online = get_online_nicknames()
    if not online:
        leader_nickname = None
        return

    # Ищем следующего в плейлисте
    new_leader = None
    if playlist:
        for i in range(len(playlist)):
            idx = (current_video_index + 1 + i) % len(playlist)
            added_by = playlist[idx].get('added_by', '')
            if added_by in online and added_by != leader_nickname:
                new_leader = added_by
                break

    if not new_leader:
        # Берём любого онлайн, кроме текущего лидера
        others = [n for n in online if n != leader_nickname]
        if others:
            new_leader = others[0]
        elif online:
            new_leader = online[0]

    old_leader = leader_nickname
    leader_nickname = new_leader

    if leader_nickname:
        add_system_message(
            f"🔄 {reason_ru}Новый лидер: {leader_nickname}",
            f"🔄 {reason_en}New leader: {leader_nickname}"
        )
    broadcast_state()


# ========================
# Heartbeat checker
# ========================

def heartbeat_checker():
    global active_vote
    while True:
        time.sleep(3)
        now = time.time()
        disconnected = []

        for sid, user in list(users.items()):
            was_online = user.get('online', False)
            if now - user.get('last_heartbeat', 0) >= HEARTBEAT_TIMEOUT_SECONDS:
                if was_online:
                    user['online'] = False
                    disconnected.append(user['nickname'])

        for nickname in disconnected:
            add_system_message(
                f"👻 {nickname} отключился",
                f"👻 {nickname} disconnected"
            )

            # Пересчёт голосования
            if active_vote:
                active_vote['votes_yes'].discard(nickname)
                active_vote['votes_no'].discard(nickname)
                online_count = get_online_count()
                if active_vote['type'] == 'change_leader':
                    voters = [n for n in get_online_nicknames() if n != leader_nickname]
                    active_vote['required'] = math.ceil(len(voters) / 2) if voters else 1
                else:
                    active_vote['required'] = math.ceil(online_count / 2) if online_count > 0 else 1
                check_vote_result()

            # Лидер ушёл
            if nickname == leader_nickname:
                transfer_leadership(
                    f"Лидер {nickname} отключился. ",
                    f"Leader {nickname} disconnected. "
                )

        if disconnected:
            broadcast_users()


threading.Thread(target=heartbeat_checker, daemon=True).start()


# ========================
# Голосование таймер
# ========================

def vote_timer():
    global active_vote, last_vote_time
    while True:
        time.sleep(1)
        if active_vote:
            elapsed = time.time() - active_vote['started_at']
            if elapsed >= VOTE_TIMEOUT_SECONDS:
                # Время вышло
                add_system_message(
                    f"⏰ Голосование истекло. Отклонено.",
                    f"⏰ Vote timed out. Rejected."
                )
                active_vote = None
                broadcast_state()


threading.Thread(target=vote_timer, daemon=True).start()


def check_vote_result():
    global active_vote, last_vote_time, current_video_index, is_playing
    global current_time, paused_by, leader_nickname

    if not active_vote:
        return

    yes = len(active_vote['votes_yes'])
    no = len(active_vote['votes_no'])
    required = active_vote['required']

    total_voters = yes + no

    # Определяем, сколько всего могут голосовать
    if active_vote['type'] == 'change_leader':
        eligible = [n for n in get_online_nicknames() if n != leader_nickname]
    else:
        eligible = get_online_nicknames()

    # Проверяем: прошло ли голосование
    if yes >= required:
        # Принято!
        vote_type = active_vote['type']
        if vote_type == 'skip':
            add_system_message(
                "✅ Голосование за пропуск: принято!",
                "✅ Vote to skip: accepted!"
            )
            # Переключаем на следующее видео
            if playlist and current_video_index < len(playlist) - 1:
                current_video_index += 1
                current_time = 0
                is_playing = True
                paused_by = None
                # Обновляем лидера
                leader_nickname = playlist[current_video_index].get('added_by', leader_nickname)
                if leader_nickname not in get_online_nicknames():
                    transfer_leadership()
            else:
                is_playing = False
                current_time = 0

        elif vote_type == 'change_leader':
            target = active_vote.get('target')
            if target and target in get_online_nicknames():
                old = leader_nickname
                leader_nickname = target
                add_system_message(
                    f"✅ Смена лидера: {old} → {leader_nickname}",
                    f"✅ Leader changed: {old} → {leader_nickname}"
                )
            else:
                add_system_message(
                    "❌ Кандидат в лидеры недоступен.",
                    "❌ Leader candidate unavailable."
                )

        active_vote = None
        last_vote_time = time.time()
        broadcast_state()

    elif no >= required or total_voters >= len(eligible):
        # Отклонено или все проголосовали
        if yes < required:
            add_system_message(
                "❌ Голосование отклонено.",
                "❌ Vote rejected."
            )
            active_vote = None
            last_vote_time = time.time()
            broadcast_state()


# ========================
# Routes
# ========================

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    if 'botyara_uuid' not in request.cookies:
        resp.set_cookie('botyara_uuid', str(uuid.uuid4()), max_age=365*24*3600)
    return resp


@app.route('/video/<path:filename>')
def serve_video(filename):
    return send_from_directory(DOWNLOADS_DIR, filename)


@app.route('/upload_local', methods=['POST'])
def upload_local_video():
    """Загрузка локального видео файла."""
    if 'video' not in request.files:
        return json.dumps({'error': 'No file'}), 400

    file = request.files['video']
    if not file.filename:
        return json.dumps({'error': 'No filename'}), 400

    video_id = str(uuid.uuid4())[:12]
    ext = os.path.splitext(file.filename)[1] or '.mp4'
    safe_name = re.sub(r'[^\w\s\-\.]', '_', os.path.splitext(file.filename)[0])[:80]
    save_path = os.path.join(DOWNLOADS_DIR, f"{video_id}_{safe_name}{ext}")

    file.save(save_path)

    title = os.path.splitext(file.filename)[0]
    from utils.video_cache import add_video_to_cache
    video_info = add_video_to_cache(video_id, title, save_path, duration=0)

    return json.dumps({
        'status': 'ok',
        'video': {
            'video_id': video_id,
            'title': title,
            'filepath': save_path,
            'duration': 0,
            'filename': os.path.basename(save_path)
        }
    }), 200


import re  # уже импортирован выше, но на всякий случай


# ========================
# SocketIO Events
# ========================

@socketio.on('connect')
def handle_connect():
    pass


@socketio.on('disconnect')
def handle_disconnect():
    global leader_nickname
    sid = request.sid
    if sid in users:
        nickname = users[sid]['nickname']
        users[sid]['online'] = False
        # Не удаляем сразу — heartbeat_checker разберётся


@socketio.on('join')
def handle_join(data):
    global leader_nickname
    sid = request.sid
    nickname = data.get('nickname', 'Anonymous').strip()[:20]

    if not nickname:
        nickname = 'Anonymous'

    # Проверяем, не занят ли ник
    for s, u in users.items():
        if u['nickname'] == nickname and u.get('online', False) and s != sid:
            emit('join_error', {'message': 'Nickname taken', 'message_ru': 'Ник занят'})
            return

    users[sid] = {
        'nickname': nickname,
        'uuid': data.get('uuid', ''),
        'ip': request.remote_addr,
        'last_heartbeat': time.time(),
        'online': True
    }

    # Первый пользователь = лидер
    if leader_nickname is None or leader_nickname not in get_online_nicknames():
        leader_nickname = nickname

    add_system_message(
        f"👋 {nickname} присоединился",
        f"👋 {nickname} joined"
    )

    # Отправляем полное состояние новому пользователю
    emit('join_success', {
        'nickname': nickname,
        'state': get_state(),
        'chat_history': chat_history[-200:]
    })

    broadcast_users()


@socketio.on('heartbeat')
def handle_heartbeat():
    sid = request.sid
    if sid in users:
        users[sid]['last_heartbeat'] = time.time()
        users[sid]['online'] = True


@socketio.on('chat_send')
def handle_chat_send(data):
    sid = request.sid
    if sid not in users:
        return

    text = data.get('text', '').strip()[:500]
    if not text:
        return

    msg = {
        'type': 'user',
        'nickname': users[sid]['nickname'],
        'text': text,
        'timestamp': time.time()
    }
    chat_history.append(msg)
    save_chat_history()
    socketio.emit('chat_message', msg)


@socketio.on('sync_time')
def handle_sync_time(data):
    """Лидер отправляет текущее время."""
    global current_time, is_playing
    sid = request.sid
    if sid not in users:
        return
    if users[sid]['nickname'] != leader_nickname:
        return

    current_time = data.get('time', 0)
    is_playing = data.get('playing', False)

    socketio.emit('time_update', {
        'time': current_time,
        'playing': is_playing,
        'leader': leader_nickname
    })


@socketio.on('pause')
def handle_pause(data):
    """Любой может ставить на паузу."""
    global is_playing, paused_by
    sid = request.sid
    if sid not in users:
        return

    is_playing = False
    paused_by = users[sid]['nickname']

    add_system_message(
        f"⏸ {paused_by} поставил на паузу",
        f"⏸ {paused_by} paused the video"
    )

    socketio.emit('video_pause', {
        'paused_by': paused_by,
        'time': data.get('time', current_time)
    })


@socketio.on('resume')
def handle_resume(data):
    """Только лидер может снимать с паузы."""
    global is_playing, paused_by
    sid = request.sid
    if sid not in users:
        return
    if users[sid]['nickname'] != leader_nickname:
        emit('not_leader')
        return

    is_playing = True
    paused_by = None

    socketio.emit('video_resume', {
        'time': data.get('time', current_time)
    })


@socketio.on('seek')
def handle_seek(data):
    """Только лидер может перематывать."""
    global current_time
    sid = request.sid
    if sid not in users:
        return
    if users[sid]['nickname'] != leader_nickname:
        emit('not_leader')
        return

    current_time = data.get('time', 0)
    socketio.emit('video_seek', {
        'time': current_time
    })


@socketio.on('video_ended')
def handle_video_ended():
    """Видео закончилось — переходим к следующему."""
    global current_video_index, current_time, is_playing, paused_by, leader_nickname
    sid = request.sid
    if sid not in users:
        return
    if users[sid]['nickname'] != leader_nickname:
        return

    # Помечаем текущее видео как просмотренное
    if 0 <= current_video_index < len(playlist):
        vid = playlist[current_video_index].get('video_id')
        if vid:
            mark_video_watched(vid)

    if current_video_index < len(playlist) - 1:
        current_video_index += 1
        current_time = 0
        is_playing = True
        paused_by = None
        leader_nickname = playlist[current_video_index].get('added_by', leader_nickname)
        if leader_nickname not in get_online_nicknames():
            transfer_leadership()
        add_system_message(
            f"▶ Следующее видео: {playlist[current_video_index]['title']}",
            f"▶ Next video: {playlist[current_video_index]['title']}"
        )
    else:
        is_playing = False
        current_time = 0
        add_system_message(
            "🏁 Плейлист окончен!",
            "🏁 Playlist finished!"
        )

    broadcast_state()


@socketio.on('playlist_add_url')
def handle_playlist_add_url(data):
    """Добавление видео по URL (через yt-dlp)."""
    sid = request.sid
    if sid not in users:
        return

    url = data.get('url', '').strip()
    if not url:
        return

    nickname = users[sid]['nickname']
    download_id = str(uuid.uuid4())[:8]

    emit('download_started', {'download_id': download_id, 'url': url})
    downloader.download_video(url, nickname, download_id)


@socketio.on('playlist_add_complete')
def handle_playlist_add_complete(data):
    """Видео скачано или из кеша — добавляем в плейлист."""
    global current_video_index, is_playing, leader_nickname
    sid = request.sid
    if sid not in users:
        return

    video = data.get('video', {})
    if not video:
        return

    video['added_by'] = users[sid]['nickname']
    playlist.append(video)

    add_system_message(
        f"📋 {video['added_by']} добавил: {video.get('title', '?')}",
        f"📋 {video['added_by']} added: {video.get('title', '?')}"
    )

    # Если это первое видео — стартуем
    if current_video_index == -1:
        current_video_index = 0
        is_playing = True
        leader_nickname = video['added_by']

    broadcast_state()


@socketio.on('playlist_add_local')
def handle_playlist_add_local(data):
    """Локальное видео уже загружено через HTTP — добавляем в плейлист."""
    global current_video_index, is_playing, leader_nickname
    sid = request.sid
    if sid not in users:
        return

    video = data.get('video', {})
    if not video:
        return

    video['added_by'] = users[sid]['nickname']
    playlist.append(video)

    add_system_message(
        f"📋 {video['added_by']} добавил: {video.get('title', '?')}",
        f"📋 {video['added_by']} added: {video.get('title', '?')}"
    )

    if current_video_index == -1:
        current_video_index = 0
        is_playing = True
        leader_nickname = video['added_by']

    broadcast_state()


@socketio.on('playlist_remove')
def handle_playlist_remove(data):
    """Удаление из плейлиста (только лидер)."""
    global current_video_index
    sid = request.sid
    if sid not in users:
        return
    if users[sid]['nickname'] != leader_nickname:
        return

    index = data.get('index', -1)
    if 0 <= index < len(playlist):
        removed = playlist.pop(index)
        if index < current_video_index:
            current_video_index -= 1
        elif index == current_video_index:
            if current_video_index >= len(playlist):
                current_video_index = max(0, len(playlist) - 1)

        broadcast_state()


socketio.on('vote_start')
def handle_vote_start(data):
    global active_vote, last_vote_time
    sid = request.sid
    if sid not in users:
        return

    nickname = users[sid]['nickname']
    vote_type = data.get('type', '')

    if active_vote:
        emit('vote_error', {'message': 'Vote already active', 'message_ru': 'Голосование уже идёт'})
        return

    if time.time() - last_vote_time < VOTE_COOLDOWN_SECONDS:
        remaining = int(VOTE_COOLDOWN_SECONDS - (time.time() - last_vote_time))
        emit('vote_error', {
            'message': f'Cooldown: {remaining}s',
            'message_ru': f'Кулдаун: {remaining} сек'
        })
        return

    if vote_type == 'change_leader':
        if nickname == leader_nickname:
            emit('vote_error', {
                'message': 'Leader cannot start this vote',
                'message_ru': 'Лидер не может начать это голосование'
            })
            return
        eligible = [n for n in get_online_nicknames() if n != leader_nickname]
        target = data.get('target', nickname)
        required = math.ceil(len(eligible) / 2) if eligible else 1
        active_vote = {
            'type': vote_type,
            'started_by': nickname,
            'started_at': time.time(),
            'votes_yes': {nickname},
            'votes_no': set(),
            'required': required,
            'target': target
        }
        add_system_message(
            f"🗳 {nickname} начал голосование за смену лидера на {target}! ({VOTE_TIMEOUT_SECONDS} сек)",
            f"🗳 {nickname} started a vote to change leader to {target}! ({VOTE_TIMEOUT_SECONDS}s)"
        )
    elif vote_type == 'skip':
        online_count = get_online_count()
        required = math.ceil(online_count / 2) if online_count > 0 else 1
        active_vote = {
            'type': vote_type,
            'started_by': nickname,
            'started_at': time.time(),
            'votes_yes': {nickname},
            'votes_no': set(),
            'required': required
        }
        add_system_message(
            f"🗳 {nickname} начал голосование за пропуск! ({VOTE_TIMEOUT_SECONDS} сек)",
            f"🗳 {nickname} started a vote to skip! ({VOTE_TIMEOUT_SECONDS}s)"
        )
    else:
        return

    check_vote_result()
    broadcast_state()


@socketio.on('vote_cast')
def handle_vote_cast(data):
    global active_vote
    sid = request.sid
    if sid not in users or not active_vote:
        return

    nickname = users[sid]['nickname']
    vote = data.get('vote', '')

    # Проверяем, может ли голосовать
    if active_vote['type'] == 'change_leader' and nickname == leader_nickname:
        return

    # Уже голосовал?
    if nickname in active_vote['votes_yes'] or nickname in active_vote['votes_no']:
        return

    if vote == 'yes':
        active_vote['votes_yes'].add(nickname)
    else:
        active_vote['votes_no'].add(nickname)

    check_vote_result()
    broadcast_state()


# ========================
# Main
# ========================

if __name__ == '__main__':
    start_cleanup_thread()
    print(f"""
    ╔══════════════════════════════════════╗
    ║         botyarawatch                 ║
    ║   http://{HOST}:{PORT}               ║
    ╚══════════════════════════════════════╝
    """)
    socketio.run(app, host=HOST, port=PORT, debug=False)
