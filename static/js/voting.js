let voteTimerInterval = null;

function renderVoting() {
    const container = document.getElementById('voting-content');
    if (!container) return;

    if (appState.activeVote) {
        renderActiveVote(container);
    } else {
        renderVoteButtons(container);
    }
}

function renderVoteButtons(container) {
    const isLeader = appState.nickname === appState.leader;

    container.innerHTML = `
        <div class="vote-buttons">
            <button class="vote-start-btn" id="vote-skip-btn">
                <span class="vote-icon nf nf-md-skip_next"></span>
                <div class="vote-start-btn-info">
                    <div class="vote-start-btn-title">${t('vote.skip_title')}</div>
                    <div class="vote-start-btn-desc">${t('vote.skip_desc')}</div>
                </div>
            </button>
            ${!isLeader ? `
            <button class="vote-start-btn" id="vote-leader-btn">
                <span class="vote-icon nf nf-md-account_switch"></span>
                <div class="vote-start-btn-info">
                    <div class="vote-start-btn-title">${t('vote.leader_title')}</div>
                    <div class="vote-start-btn-desc">${t('vote.leader_desc')}</div>
                </div>
            </button>
            ` : ''}
        </div>
    `;

    const skipBtn = document.getElementById('vote-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            socket.emit('vote_start', { type: 'skip' });
        });
    }

    const leaderBtn = document.getElementById('vote-leader-btn');
    if (leaderBtn) {
        leaderBtn.addEventListener('click', () => {
            showLeaderSelectModal();
        });
    }
}

function showLeaderSelectModal() {
    const container = document.getElementById('voting-content');
    const candidates = appState.users.filter(u => u !== appState.leader && u !== appState.nickname);

    // Include self as candidate
    const allCandidates = [appState.nickname, ...candidates].filter(u => u !== appState.leader);

    let html = `<div class="vote-buttons">
        <h4 style="color:var(--text-secondary);margin-bottom:12px">${t('vote.select_leader')}</h4>
        <div class="leader-select-list">`;

    allCandidates.forEach(name => {
        html += `<div class="leader-select-item" data-candidate="${escapeHtml(name)}">${escapeHtml(name)}</div>`;
    });

    html += `</div>
        <button class="vote-start-btn" onclick="renderVoting()" style="justify-content:center;font-size:13px;color:var(--text-muted)">
            ← ${currentLang === 'ru' ? 'Назад' : 'Back'}
        </button>
    </div>`;

    container.innerHTML = html;

    container.querySelectorAll('.leader-select-item').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.candidate;
            socket.emit('vote_start', { type: 'change_leader', target });
        });
    });
}

function renderActiveVote(container) {
    const vote = appState.activeVote;
    if (!vote) return;

    const elapsed = vote.elapsed || 0;
    const remaining = Math.max(0, vote.timeout - elapsed);
    const pct = ((vote.timeout - remaining) / vote.timeout) * 100;

    const typeText = vote.type === 'skip' ? t('vote.skip_title') :
                     t('vote.leader_title') + (vote.target ? ` → ${vote.target}` : '');

    const yesCount = vote.votes_yes ? vote.votes_yes.length : 0;
    const noCount = vote.votes_no ? vote.votes_no.length : 0;
    const required = vote.required || 1;

    const alreadyVoted = (vote.votes_yes && vote.votes_yes.includes(appState.nickname)) ||
                         (vote.votes_no && vote.votes_no.includes(appState.nickname));

    const canVote = vote.type === 'change_leader' ?
        appState.nickname !== appState.leader : true;

    container.innerHTML = `
        <div class="active-vote-card">
            <div class="active-vote-title">${typeText}</div>
            <div class="active-vote-by">${t('vote.started_by')}: ${escapeHtml(vote.started_by)}</div>
            <div class="active-vote-timer" id="vote-timer">${Math.ceil(remaining)}s</div>
            <div class="active-vote-bar-container">
                <div class="active-vote-bar" id="vote-bar" style="width:${pct}%"></div>
            </div>
            <div class="active-vote-count">
                ✅ ${yesCount} / ❌ ${noCount} (${t('vote.required')}: ${required} ${t('vote.votes')})
            </div>
            ${canVote && !alreadyVoted ? `
            <div class="vote-action-btns">
                <button class="vote-yes-btn" id="vote-yes">${t('vote.yes')}</button>
                <button class="vote-no-btn" id="vote-no">${t('vote.no')}</button>
            </div>
            ` : alreadyVoted ? `
            <div class="vote-cooldown-msg">${t('vote.already_voted')}</div>
            ` : ''}
        </div>
    `;

    const yesBtn = document.getElementById('vote-yes');
    const noBtn = document.getElementById('vote-no');

    if (yesBtn) yesBtn.addEventListener('click', () => {
        socket.emit('vote_cast', { vote: 'yes' });
        yesBtn.disabled = true;
        noBtn.disabled = true;
    });

    if (noBtn) noBtn.addEventListener('click', () => {
        socket.emit('vote_cast', { vote: 'no' });
        yesBtn.disabled = true;
        noBtn.disabled = true;
    });

    // Timer update
    clearInterval(voteTimerInterval);
    let remainingTime = remaining;
    const startedAt = Date.now();

    voteTimerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed2 = (now - startedAt) / 1000;
        const left = Math.max(0, remainingTime - elapsed2);
        const timerEl = document.getElementById('vote-timer');
        const barEl = document.getElementById('vote-bar');

        if (timerEl) timerEl.textContent = Math.ceil(left) + 's';
        if (barEl) {
            const totalElapsed = vote.elapsed + elapsed2;
            const newPct = (totalElapsed / vote.timeout) * 100;
            barEl.style.width = Math.min(100, newPct) + '%';
        }

        if (left <= 0) {
            clearInterval(voteTimerInterval);
        }
    }, 250);
}
