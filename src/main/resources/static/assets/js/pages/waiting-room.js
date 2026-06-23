document.addEventListener('DOMContentLoaded', async function () {
    const user = requireCurrentUser();
    if (!user) {
        return;
    }
    let realtimeConnected = false;
    let rejoinReady = false;
    let manualDiscussionReturn = !!storage.get('manualDiscussionReturn');
    var cachedSessions = [];
    var sessionMetaMap = {};
    qs('#userName').textContent = user.name;
    setWaitingMapPlayerAvatar(user);
    var openSessionIds = await loadOpenSessions();
    var rememberedSessionId = storage.get('joinedSessionId');
    if (rememberedSessionId && openSessionIds.indexOf(rememberedSessionId) === -1) {
        rememberedSessionId = await resolveRememberedSession(rememberedSessionId);
    }
    if (rememberedSessionId) {
        qs('#sessionSelect').value = String(rememberedSessionId);
        refreshParticipantCount(rememberedSessionId);
    }
    initWaitingMap();
    updateButtonState();
    updateLobbyProgress(!!rememberedSessionId, false);

    qs('#sessionSelect').addEventListener('change', function () {
        updateButtonState();
        showSessionInfo();
        renderSessionPreview();
    });
    showSessionInfo();
    renderSessionPreview();

    connectRealtime(rememberedSessionId);
    if (rememberedSessionId) {
        await checkGroup(true);
    }

    qs('#openHistoryBtn').addEventListener('click', function () {
        qs('#historyOverlay').style.display = 'flex';
        loadMyHistory();
    });
    qs('#closeHistoryBtn').addEventListener('click', function () {
        qs('#historyOverlay').style.display = 'none';
    });
    qs('#historyOverlay').addEventListener('click', function (e) {
        if (e.target === qs('#historyOverlay')) {
            qs('#historyOverlay').style.display = 'none';
        }
    });
    qs('#viewAllSessionsBtn').addEventListener('click', function () {
        renderAllSessions();
        qs('#allSessionsOverlay').style.display = 'flex';
    });
    qs('#closeAllSessionsBtn').addEventListener('click', function () {
        qs('#allSessionsOverlay').style.display = 'none';
    });
    qs('#allSessionsOverlay').addEventListener('click', function (e) {
        if (e.target === qs('#allSessionsOverlay')) {
            qs('#allSessionsOverlay').style.display = 'none';
        }
    });

    qs('#joinSessionButton').addEventListener('click', async function () {
        try {
            const sessionId = Number(qs('#sessionSelect').value);
            if (!sessionId) {
                throw new Error('Please select a session');
            }
            await apiRequest('/students/join-session', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: sessionId
                })
            });
            storage.set('joinedSessionId', sessionId);
            storage.remove('manualDiscussionReturn');
            manualDiscussionReturn = false;
            hideRejoinPanel();
            disconnectDiscussionSocket();
            connectRealtime(sessionId);
            refreshParticipantCount(sessionId);
            renderWaitingStats(sessionId);
            updateLobbyProgress(true, false);
            showMessage(qs('#message'), 'Joined the waiting room');
        } catch (error) {
            showMessage(qs('#message'), error.message, true);
        }
    });

    qs('#rejoinDiscussionButton').addEventListener('click', function () {
        if (!rejoinReady || !storage.get('currentGroup')) {
            showMessage(qs('#message'), 'Your discussion room is not ready yet.', true);
            return;
        }
        storage.remove('manualDiscussionReturn');
        manualDiscussionReturn = false;
        window.location.href = './discussion-room.html';
    });

    const pollTimer = setInterval(async function () {
        const joined = await checkGroup(true);
        if (joined) {
            clearInterval(pollTimer);
        }
    }, 5000);

    const countTimer = setInterval(async function () {
        const joinedSessionId = storage.get('joinedSessionId');
        if (joinedSessionId) {
            await refreshParticipantCount(joinedSessionId);
            renderWaitingStats(joinedSessionId);
        }
    }, 5000);

    window.addEventListener('beforeunload', function () {
        clearInterval(pollTimer);
        clearInterval(countTimer);
        disconnectDiscussionSocket();
    });

    async function checkGroup(silent) {
        try {
            const sessionId = storage.get('joinedSessionId');
            if (!sessionId) {
                hideRejoinPanel();
                if (!silent) {
                    showMessage(qs('#message'), 'Join a session first', true);
                }
                return false;
            }
            const group = await apiRequest('/students/group?sessionId=' + sessionId);
            storage.set('currentGroup', group);
            await acknowledgeGroupReady(sessionId);
            if (!manualDiscussionReturn) {
                storage.remove('manualDiscussionReturn');
                window.location.href = './discussion-room.html';
                return true;
            }
            showRejoinPanel(group, sessionId);
            if (!silent) {
                showMessage(qs('#message'), realtimeConnected ? 'Group ready. You can rejoin the discussion now.' : 'Group result loaded. You can rejoin the discussion now.');
            }
            return true;
        } catch (error) {
            const waitingMessage = 'User has not been assigned to a group in this session';
            if (error.message === waitingMessage) {
                hideRejoinPanel();
                if (!silent) {
                    showMessage(qs('#message'), 'Grouping is not ready yet. Please wait for the teacher.', true);
                }
                return false;
            }
            hideRejoinPanel();
            if (!silent) {
                showMessage(qs('#message'), error.message, true);
            } else {
                console.error(error);
            }
            return false;
        }
    }

    async function resolveRememberedSession(sessionId) {
        try {
            const session = await apiRequest('/sessions/' + sessionId);
            if (session && session.status !== 'ENDED') {
                sessionMetaMap[String(sessionId)] = session;
                return sessionId;
            }
        } catch (error) {
        }
        storage.remove('joinedSessionId');
        storage.remove('currentGroup');
        storage.remove('manualDiscussionReturn');
        return null;
    }

    function showRejoinPanel(group, sessionId) {
        var sessionMeta = sessionMetaMap[String(sessionId)] || cachedSessions.find(function (s) {
            return Number(s.id) === Number(sessionId);
        });
        var sessionLabel = sessionMeta && sessionMeta.topic ? '"' + sessionMeta.topic + '"' : 'your current session';
        rejoinReady = true;
        qs('#rejoinCard').style.display = 'grid';
        qs('#rejoinMessage').textContent = (group && group.groupName ? group.groupName : 'Your group') + ' is ready in ' + sessionLabel + '. You can rejoin the discussion at any time before it ends.';
        updateLobbyProgress(true, true);
    }

    function hideRejoinPanel() {
        rejoinReady = false;
        manualDiscussionReturn = false;
        storage.remove('manualDiscussionReturn');
        qs('#rejoinCard').style.display = 'none';
        updateLobbyProgress(!!storage.get('joinedSessionId'), false);
    }

    function updateButtonState() {
        var hasSelection = !!qs('#sessionSelect').value;
        qs('#joinSessionButton').disabled = !hasSelection;
    }

    async function loadOpenSessions() {
        cachedSessions = await apiRequest('/sessions/open');
        sessionMetaMap = {};
        cachedSessions.forEach(function (session) {
            sessionMetaMap[String(session.id)] = session;
        });
        qs('#sessionSelect').innerHTML = '<option value="">Select a session</option>' + cachedSessions.map(function (session) {
            var teacher = session.teacherName ? ' - ' + session.teacherName : '';
            return '<option value="' + session.id + '">' + session.topic + ' - ' + session.status + teacher + '</option>';
        }).join('');
        renderSessionPreview();
        renderWaitingStats(storage.get('joinedSessionId'));
        if (!cachedSessions.length) {
            showMessage(qs('#message'), 'No sessions available. Please wait for a teacher to create one.', true, true);
        }
        return cachedSessions.map(function (s) { return s.id; });
    }

    function showSessionInfo() {
        var selectedId = Number(qs('#sessionSelect').value);
        var infoEl = qs('#sessionInfo');
        if (!selectedId) {
            infoEl.style.display = 'none';
            return;
        }
        var session = cachedSessions.find(function (s) { return s.id === selectedId; });
        if (session) {
            infoEl.innerHTML =
                '<div class="detail-metric-grid">' +
                '<div class="detail-metric"><div class="detail-metric-label">Teacher</div><div class="detail-metric-value">' + escapeHtml(session.teacherName || '-') + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Duration</div><div class="detail-metric-value">' + (session.durationMinutes || '-') + ' min</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Group Size</div><div class="detail-metric-value">' + (session.groupSize || '-') + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Status</div><div class="detail-metric-value">' + escapeHtml(session.status || '-') + '</div></div>' +
                '</div>';
            infoEl.style.display = 'block';
        } else {
            infoEl.style.display = 'none';
        }
    }

    function renderSessionPreview() {
        var selectedId = Number(qs('#sessionSelect').value);
        var list = qs('#sessionPreviewList');
        if (!cachedSessions.length) {
            list.innerHTML = '<div class="panel-empty">No open sessions right now.</div>';
            qs('#viewAllSessionsBtn').style.display = 'none';
            return;
        }
        var previewSessions = cachedSessions.slice(0, 2);
        list.innerHTML = renderSessionCards(previewSessions, selectedId);
        qs('#viewAllSessionsBtn').style.display = cachedSessions.length > previewSessions.length ? 'inline-flex' : 'none';
        bindSessionCards('#sessionPreviewList');
    }

    function renderAllSessions() {
        var selectedId = Number(qs('#sessionSelect').value);
        var list = qs('#allSessionsList');
        if (!cachedSessions.length) {
            list.innerHTML = '<div class="panel-empty">No open sessions right now.</div>';
            return;
        }
        list.innerHTML = renderSessionCards(cachedSessions, selectedId);
        bindSessionCards('#allSessionsList');
    }

    function renderSessionCards(sessions, selectedId) {
        return sessions.map(function (session) {
            var activeClass = session.id === selectedId ? ' active' : '';
            return '<div class="session-card waiting-session-card' + activeClass + '" role="button" tabindex="0" data-session-id="' + session.id + '">' +
                '<div class="session-card-head">' +
                '<div>' +
                '<div class="waiting-session-icon" aria-hidden="true">' + getSessionMark(session.status) + '</div>' +
                '<div class="session-card-title">' + escapeHtml(session.topic || '') + '</div>' +
                '<div class="session-card-meta">' +
                '<span class="meta-chip"><strong>' + (session.durationMinutes || '-') + '</strong> min</span>' +
                '<span class="meta-chip"><strong>' + (session.groupSize || '-') + '</strong> per group</span>' +
                '</div>' +
                '</div>' +
                '<span class="status-chip status-active">' + escapeHtml(session.status || '') + '</span>' +
                '</div>' +
                '<div class="member-inline-meta">Teacher: ' + escapeHtml(session.teacherName || '-') + '</div>' +
                '</div>';
        }).join('');
    }

    function renderWaitingStats(joinedSessionId) {
        var selectedId = Number(qs('#sessionSelect').value) || Number(joinedSessionId);
        var selectedSession = cachedSessions.find(function (s) { return s.id === selectedId; });
        var stats = qs('#waitingStats');
        stats.innerHTML =
            '<div class="detail-metric waiting-board-metric"><div class="detail-metric-label">Rooms Open</div><div class="detail-metric-value">' + cachedSessions.length + '</div></div>' +
            '<div class="detail-metric waiting-board-metric"><div class="detail-metric-label">My Seat</div><div class="detail-metric-value">' + (joinedSessionId ? 'Saved' : 'Not Yet') + '</div></div>' +
            '<div class="detail-metric waiting-board-metric"><div class="detail-metric-label">Current Mission</div><div class="detail-metric-value">' + escapeHtml(selectedSession ? selectedSession.topic : '-') + '</div></div>' +
            '<div class="detail-metric waiting-board-metric"><div class="detail-metric-label">Connection</div><div class="detail-metric-value">' + (realtimeConnected ? 'Live' : 'Checking') + '</div></div>';
    }

    function bindSessionCards(containerSelector) {
        var root = containerSelector ? qs(containerSelector) : document;
        var cards = Array.from(root.querySelectorAll('.waiting-session-card'));
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', selectSessionCard);
            cards[i].addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectSessionCard.call(this);
                }
            });
        }
    }

    function selectSessionCard() {
        var sessionId = this.getAttribute('data-session-id');
        qs('#sessionSelect').value = sessionId;
        updateButtonState();
        showSessionInfo();
        renderSessionPreview();
        if (qs('#allSessionsOverlay').style.display !== 'none') {
            qs('#allSessionsOverlay').style.display = 'none';
        }
        renderWaitingStats(storage.get('joinedSessionId'));
    }

    function updateLobbyProgress(joined, ready) {
        var pulse = qs('#waitingPulse');
        if (pulse) {
            pulse.style.display = joined && !ready ? 'flex' : 'none';
        }
        var steps = qsa('.waiting-path-step');
        for (var i = 0; i < steps.length; i++) {
            steps[i].classList.remove('active', 'current');
        }
        if (steps[0]) {
            steps[0].classList.add('active');
        }
        if (joined && steps[1]) {
            steps[1].classList.add('active');
        }
        if (ready && steps[2]) {
            steps[2].classList.add('active');
        } else if (joined && steps[2]) {
            steps[2].classList.add('current');
        }

        var stages = qsa('.waiting-map-stage');
        for (var j = 0; j < stages.length; j++) {
            stages[j].classList.remove('active', 'current');
        }
        if (stages[0]) {
            stages[0].classList.add('active');
        }
        if (joined && stages[1]) {
            stages[1].classList.add('active');
        }
        if (ready && stages[2]) {
            stages[2].classList.add('active');
        } else if (joined && stages[2]) {
            stages[2].classList.add('current');
        }

        var player = qs('#waitingMapPlayer');
        if (player) {
            player.classList.remove('stage-1', 'stage-2', 'stage-3', 'stage-4');
            player.classList.add(ready ? 'stage-3' : joined ? 'stage-2' : 'stage-1');
        }
    }

    function setWaitingMapPlayerAvatar(profile) {
        var player = qs('#waitingMapPlayer');
        if (!player) {
            return;
        }
        player.src = '../assets/images/avatars/' + resolveAvatarFile(profile);
    }

    function resolveAvatarFile(profile) {
        if (profile && profile.avatar) {
            return profile.avatar;
        }
        if (profile && profile.name === 'Student_Alice') {
            return 'alice-kitty.png';
        }
        if (profile && profile.name === 'Student_Bob') {
            return 'bob-drawing.png';
        }
        return 'kitty.png';
    }

    function initWaitingMap() {
        var viewport = qs('#waitingMapViewport');
        var canvas = qs('#waitingMapCanvas');
        var zoomInBtn = qs('#waitingMapZoomIn');
        var zoomOutBtn = qs('#waitingMapZoomOut');
        var resetBtn = qs('#waitingMapReset');
        if (!viewport || !canvas || !zoomInBtn || !zoomOutBtn || !resetBtn) {
            return;
        }

        var mapWidth = 760;
        var fitScale = Math.min(1, Math.max(0.68, (viewport.clientWidth - 20) / mapWidth));
        var state = {
            scale: fitScale,
            minScale: 0.68,
            maxScale: 1.65,
            x: Math.round((viewport.clientWidth - mapWidth * fitScale) / 2),
            y: 0
        };
        var drag = null;

        applyTransform();

        viewport.addEventListener('pointerdown', function (event) {
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: state.x,
                originY: state.y
            };
            viewport.classList.add('dragging');
            viewport.setPointerCapture(event.pointerId);
        });

        viewport.addEventListener('pointermove', function (event) {
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }
            state.x = drag.originX + (event.clientX - drag.startX);
            state.y = drag.originY + (event.clientY - drag.startY);
            applyTransform();
        });

        viewport.addEventListener('pointerup', finishDrag);
        viewport.addEventListener('pointercancel', finishDrag);

        zoomInBtn.addEventListener('click', function () {
            setScale(state.scale + 0.12);
        });

        zoomOutBtn.addEventListener('click', function () {
            setScale(state.scale - 0.12);
        });

        resetBtn.addEventListener('click', function () {
            fitScale = Math.min(1, Math.max(0.68, (viewport.clientWidth - 20) / mapWidth));
            state.scale = fitScale;
            state.x = Math.round((viewport.clientWidth - mapWidth * fitScale) / 2);
            state.y = 0;
            applyTransform();
        });

        function finishDrag(event) {
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }
            viewport.classList.remove('dragging');
            drag = null;
        }

        function setScale(nextScale) {
            state.scale = Math.max(state.minScale, Math.min(state.maxScale, nextScale));
            applyTransform();
        }

        function applyTransform() {
            canvas.style.transform = 'translate(' + state.x + 'px, ' + state.y + 'px) scale(' + state.scale + ')';
        }
    }

    function getSessionMark(status) {
        if (status === 'RUNNING') {
            return 'LIVE';
        }
        if (status === 'CREATED') {
            return 'NEW';
        }
        return 'OPEN';
    }

    async function refreshParticipantCount(sessionId) {
        try {
            const result = await apiRequest('/students/waiting-room/count?sessionId=' + sessionId);
            qs('#participantCount').textContent = result.count;
        } catch (error) {
            qs('#participantCount').textContent = '-';
        }
    }

    async function acknowledgeGroupReady(sessionId) {
        try {
            await apiRequest('/students/group-ready/ack?sessionId=' + sessionId, {
                method: 'POST'
            });
        } catch (error) {
        }
    }

    var cachedHistory = [];

    async function loadMyHistory() {
        var container = qs('#historyContent');
        qs('#historyTitle').textContent = 'My History';
        container.innerHTML = 'Loading...';
        try {
            cachedHistory = await apiRequest('/students/my-sessions');
            renderHistoryList();
        } catch (error) {
            container.innerHTML = '<div class="detail-error">Failed to load history.</div>';
            console.error(error);
        }
    }

    function renderHistoryList() {
        var container = qs('#historyContent');
        qs('#historyTitle').textContent = 'My History';
        if (!cachedHistory || cachedHistory.length === 0) {
            container.innerHTML = '<div class="panel-empty">No participation history yet.</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < cachedHistory.length; i++) {
            var s = cachedHistory[i];
            var statusClass = s.status === 'ENDED' ? 'status-ended' : s.status === 'RUNNING' ? 'status-active' : 'status-warning';
            var speakingInfo = '';
            if (s.speakingCount > 0) {
                var mins = Math.floor(s.totalSpeakingSeconds / 60);
                var secs = s.totalSpeakingSeconds % 60;
                var dur = mins > 0 ? mins + 'm ' + secs + 's' : secs + 's';
                speakingInfo = s.speakingCount + ' turns - ' + dur;
            } else {
                speakingInfo = 'No speaking record';
            }
            var dateStr = s.startedAt ? new Date(s.startedAt).toLocaleString() : (s.createdAt ? new Date(s.createdAt).toLocaleString() : '-');
            html += '<div class="detail-panel waiting-history-item" data-index="' + i + '">';
            html += '<div class="detail-item-row">';
            html += '<strong>' + escapeHtml(s.topic) + '</strong>';
            html += '<span class="status-chip ' + statusClass + '">' + s.status + '</span>';
            html += '</div>';
            html += '<div class="member-inline-meta">' + escapeHtml(s.teacherName) + ' - ' + dateStr + '</div>';
            html += '<div class="member-inline-meta">' + speakingInfo + '</div>';
            html += '</div>';
        }
        container.innerHTML = html;
        var items = container.querySelectorAll('.waiting-history-item');
        for (var j = 0; j < items.length; j++) {
            items[j].addEventListener('click', function () {
                var idx = Number(this.getAttribute('data-index'));
                renderHistoryDetail(cachedHistory[idx]);
            });
        }
    }

    function renderHistoryDetail(s) {
        var statusClass = s.status === 'ENDED' ? 'status-ended' : s.status === 'RUNNING' ? 'status-active' : 'status-warning';
        var html = '';
        html += '<div class="detail-stack">';
        html += '<div class="detail-panel"><div class="detail-item-row"><strong>Status</strong><span class="status-chip ' + statusClass + '">' + s.status + '</span></div></div>';
        html += '<div class="detail-metric-grid">';
        html += '<div class="detail-metric"><div class="detail-metric-label">Teacher</div><div class="detail-metric-value">' + escapeHtml(s.teacherName) + '</div></div>';
        html += '<div class="detail-metric"><div class="detail-metric-label">Duration</div><div class="detail-metric-value">' + (s.durationMinutes || '-') + ' min</div></div>';
        if (s.startedAt) {
            html += '<div class="detail-metric"><div class="detail-metric-label">Started</div><div class="detail-metric-value waiting-detail-time">' + new Date(s.startedAt).toLocaleString() + '</div></div>';
        }
        if (s.endedAt) {
            html += '<div class="detail-metric"><div class="detail-metric-label">Ended</div><div class="detail-metric-value waiting-detail-time">' + new Date(s.endedAt).toLocaleString() + '</div></div>';
        }
        html += '<div class="detail-metric"><div class="detail-metric-label">Joined</div><div class="detail-metric-value waiting-detail-time">' + new Date(s.joinedAt).toLocaleString() + '</div></div>';
        html += '<div class="detail-metric"><div class="detail-metric-label">Turns</div><div class="detail-metric-value">' + (s.speakingCount || 0) + '</div></div>';
        html += '</div>';
        html += '<div class="detail-panel"><strong>Speaking Stats</strong><div class="member-inline-meta" style="margin-top:8px;">' + ((s.speakingCount > 0) ? (Math.floor(s.totalSpeakingSeconds / 60) > 0 ? Math.floor(s.totalSpeakingSeconds / 60) + 'm ' + (s.totalSpeakingSeconds % 60) + 's' : (s.totalSpeakingSeconds % 60) + 's') : 'No speaking record') + '</div></div>';
        if (s.status === 'ENDED') {
            html += '<button class="btn" style="width:100%;" onclick="window.location.href=\'./session-result.html?sessionId=' + s.sessionId + '&from=history\'">View Session Result</button>';
        }
        html += '</div>';
        qs('#historyContent').innerHTML = html;
        qs('#historyTitle').style.cursor = 'pointer';
        qs('#historyTitle').textContent = '< Back to History';
        qs('#historyTitle').onclick = function () {
            qs('#historyTitle').style.cursor = '';
            qs('#historyTitle').onclick = null;
            renderHistoryList();
        };
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function connectRealtime(sessionId) {
        if (!sessionId) {
            realtimeConnected = false;
            renderWaitingStats(storage.get('joinedSessionId'));
            return;
        }
        connectDiscussionSocket(sessionId, async function (message) {
            const joinedSessionId = storage.get('joinedSessionId');
            if (!joinedSessionId || message.type !== 'GROUP_READY' || Number(message.sessionId) !== Number(joinedSessionId)) {
                return;
            }
            await checkGroup(true);
        }, {
            onOpen: function () {
                realtimeConnected = true;
                renderWaitingStats(storage.get('joinedSessionId'));
            },
            onError: function () {
                realtimeConnected = false;
                renderWaitingStats(storage.get('joinedSessionId'));
            },
            onClose: function () {
                realtimeConnected = false;
                renderWaitingStats(storage.get('joinedSessionId'));
            }
        });
    }
});
