# 📺 botyarawatch

Self-hosted watch-party: synchronized video viewing with a shared playlist, voting, chat and built-in downloads. Flask + Socket.IO — everyone on your network opens one link and watches together.

## Features

- **Synchronized playback** — the current "leader" drives position & state for everyone, synced every 2 seconds
- **Shared playlist** with voting for the next video (30 s vote window, 60 s cooldown)
- **Real-time chat** with persisted history
- **Built-in video downloader**
- **Auto-cleanup** — videos older than 7 days (or watched more than a day ago) are removed hourly

## Quick start

```bash
pip install -r requirements.txt
python app.py
```

Friends open `http://<your-ip>:<port>` on the same network — no accounts, no cloud.
