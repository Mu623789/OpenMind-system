document.addEventListener('DOMContentLoaded', async function () {
    const user = requireCurrentUser();
    if (!user || user.role !== 'TEACHER') {
        window.location.href = './login.html';
        return;
    }
    qs('#teacherName').textContent = user.name;
    let sessionCountdownTimers = [];
    let activeDetailSessionId = null;
    let activeDetailHtml = '';
    let activeDetailTimer = null;
    try {
        await loadSessions();
    } catch (error) {
        showMessage(qs('#message'), error.message, true);
    }

    qs('#sessionForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
            var groupSize = Number(qs('#groupSize').value);
            if (groupSize < 2 || groupSize > 6) {
                throw new Error('Group size must be between 2 and 6');
            }
            await apiRequest('/sessions/teacher/create', {
                method: 'POST',
                body: JSON.stringify({
                    topic: qs('#topic').value.trim(),
                    durationMinutes: Number(qs('#durationMinutes').value),
                    groupSize: groupSize
                })
            });
            await loadSessions();
            qs('#topic').value = '';
            showMessage(qs('#message'), 'Session created');
        } catch (error) {
            showMessage(qs('#message'), error.message, true);
        }
    });
    qs('#viewAllTeacherSessionsBtn').addEventListener('click', async function () {
        const sessions = await apiRequest('/sessions/teacher');
        qs('#allTeacherSessionsList').innerHTML = renderSessionCards(sessions);
        qs('#allTeacherSessionsOverlay').style.display = 'flex';
    });
    qs('#closeAllTeacherSessionsBtn').addEventListener('click', function () {
        qs('#allTeacherSessionsOverlay').style.display = 'none';
    });
    qs('#allTeacherSessionsOverlay').addEventListener('click', function (event) {
        if (event.target === qs('#allTeacherSessionsOverlay')) {
            qs('#allTeacherSessionsOverlay').style.display = 'none';
        }
    });

    async function loadSessions() {
        clearSessionCountdownTimers();
        qs('#allTeacherSessionsOverlay').style.display = 'none';
        const sessions = await apiRequest('/sessions/teacher');
        renderStats(sessions);
        var previewSessions = sessions.slice(0, 2);
        qs('#sessionList').innerHTML = renderSessionCards(previewSessions);
        qs('#viewAllTeacherSessionsBtn').style.display = sessions.length > previewSessions.length ? 'inline-flex' : 'none';
        applyStagger(qs('#sessionList'));
        startSessionCountdowns(previewSessions);
    }

    function renderSessionCards(sessions) {
        if (!sessions.length) {
            return '<div class="panel-empty">No sessions yet.</div>';
        }
        return sessions.map(function (session) {
            var s = session.status;
            var statusClass = s === 'RUNNING' ? 'status-active' : (s === 'ENDED' ? 'status-ended' : 'status-warning');
            var actions = '';
            if (s === 'CREATED') {
                actions = '<button class="btn" onclick="autoGroup(' + session.id + ')">Auto Group</button>';
            } else if (s === 'GROUPED') {
                actions = '<button class="btn" onclick="autoGroup(' + session.id + ')">Re-Group</button>' +
                    '<button class="btn" onclick="startSession(' + session.id + ')">Start Session</button>';
            } else if (s === 'RUNNING') {
                actions = '<button class="btn btn-danger" onclick="endSession(' + session.id + ')">End Session</button>';
            }
            var views = '';
            if (s !== 'ENDED') {
                views = '<button class="btn btn-outline" onclick="viewGroups(' + session.id + ')">Groups</button>' +
                    '<button class="btn btn-outline" onclick="viewWaitingRoom(' + session.id + ')">Waiting Room</button>' +
                    '<button class="btn btn-outline" onclick="viewOverview(' + session.id + ')">Overview</button>';
            }
            if (s === 'RUNNING') {
                views += '<button class="btn btn-outline" onclick="openSessionMonitor(' + session.id + ')">Session Monitor</button>';
            }
            if (s === 'ENDED') {
                views += '<button class="btn btn-outline" onclick="viewResult(' + session.id + ')">View Result</button>';
            }
            var sessionMeta = '<span class="meta-chip"><strong>' + (session.durationMinutes || '-') + '</strong> min</span>' +
                '<span class="meta-chip"><strong>' + (session.groupSize || '-') + '</strong> per group</span>';
            if (s === 'RUNNING') {
                sessionMeta += '<span class="meta-chip">Remaining <strong data-session-countdown="' + session.id + '">--:--</strong></span>';
            }
            var detailHtml = activeDetailSessionId === session.id ? ('<div class="detail-panel" data-session-detail="' + session.id + '">' + activeDetailHtml + '</div>') : '';
            return '<div class="session-card">' +
                '<div class="session-card-head">' +
                '<div>' +
                '<div class="session-card-title">' + escapeText(session.topic || '') + '</div>' +
                '<div class="session-card-meta">' + sessionMeta + '</div>' +
                '</div>' +
                '<span class="status-chip ' + statusClass + '">' + s + '</span>' +
                '</div>' +
                (actions ? '<div class="session-actions">' + actions + '</div>' : '') +
                (views ? '<div class="session-actions">' + views + '</div>' : '') +
                detailHtml +
                '</div>';
        }).join('');
    }

    function renderStats(sessions) {
        var running = sessions.filter(function (session) { return session.status === 'RUNNING'; }).length;
        var grouped = sessions.filter(function (session) { return session.status === 'GROUPED'; }).length;
        var ended = sessions.filter(function (session) { return session.status === 'ENDED'; }).length;
        qs('#dashboardStats').innerHTML =
            '<div class="stat-card">' +
            '<div class="stat-label">Total Sessions</div>' +
            '<div class="stat-value">' + sessions.length + '</div>' +
            '<div class="stat-note">All created discussion spaces</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Running Now</div>' +
            '<div class="stat-value">' + running + '</div>' +
            '<div class="stat-note">Live sessions currently active</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Grouped</div>' +
            '<div class="stat-value">' + grouped + '</div>' +
            '<div class="stat-note">Ready to launch with teams assigned</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Completed</div>' +
            '<div class="stat-value">' + ended + '</div>' +
            '<div class="stat-note">Sessions available for review</div>' +
            '</div>';
    }

    function applyStagger(container) {
        if (container.dataset.staggerApplied) return;
        container.dataset.staggerApplied = '1';
        var children = container.children;
        for (var i = 0; i < children.length; i++) {
            children[i].classList.add('stagger-in');
            children[i].style.animationDelay = (i * 50) + 'ms';
        }
    }

    function setActiveDetail(sessionId, html) {
        if (activeDetailTimer) {
            clearTimeout(activeDetailTimer);
            activeDetailTimer = null;
        }
        activeDetailSessionId = sessionId;
        activeDetailHtml = html;
        return loadSessions();
    }

    async function setActiveDetailError(sessionId, html) {
        await setActiveDetail(sessionId, html);
        activeDetailTimer = setTimeout(async function () {
            activeDetailTimer = null;
            clearActiveDetail();
            await loadSessions();
        }, 5000);
    }

    function clearActiveDetail() {
        if (activeDetailTimer) {
            clearTimeout(activeDetailTimer);
            activeDetailTimer = null;
        }
        activeDetailSessionId = null;
        activeDetailHtml = '';
    }

    function clearSessionCountdownTimers() {
        sessionCountdownTimers.forEach(function (timerId) {
            clearInterval(timerId);
        });
        sessionCountdownTimers = [];
    }

    function startSessionCountdowns(sessions) {
        sessions.filter(function (session) {
            return session.status === 'RUNNING';
        }).forEach(function (session) {
            const countdownNode = document.querySelector('[data-session-countdown="' + session.id + '"]');
            if (!countdownNode || !session.expectedEndAt || !session.serverNow) {
                return;
            }
            const endTime = new Date(session.expectedEndAt).getTime();
            const serverNow = new Date(session.serverNow).getTime();
            if (isNaN(endTime) || isNaN(serverNow)) {
                countdownNode.textContent = '--:--';
                return;
            }
            const serverOffsetMs = serverNow - Date.now();
            const updateCountdown = function () {
                const remaining = Math.max(0, endTime - (Date.now() + serverOffsetMs));
                const totalSec = Math.ceil(remaining / 1000);
                const min = Math.floor(totalSec / 60);
                const sec = totalSec % 60;
                countdownNode.textContent = remaining <= 0 ? 'Ended' : (min + ':' + (sec < 10 ? '0' : '') + sec);
            };
            updateCountdown();
            sessionCountdownTimers.push(setInterval(updateCountdown, 1000));
        });
    }

    window.autoGroup = async function (sessionId) {
        try {
            await apiRequest('/teacher/sessions/' + sessionId + '/groups/auto', { method: 'POST' });
            clearActiveDetail();
            await window.viewGroups(sessionId);
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-error">' + error.message + '</div>');
        }
    };

    window.startSession = async function (sessionId) {
        try {
            await apiRequest('/sessions/teacher/' + sessionId + '/start', { method: 'POST' });
            clearActiveDetail();
            await loadSessions();
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-error">' + error.message + '</div>');
        }
    };

    window.endSession = async function (sessionId) {
        if (!confirm('End this session? This action cannot be undone.')) return;
        try {
            await apiRequest('/sessions/teacher/' + sessionId + '/end', { method: 'POST' });
            clearActiveDetail();
            await loadSessions();
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-error">' + error.message + '</div>');
        }
    };

    window.viewGroups = async function (sessionId) {
        try {
            const groups = await apiRequest('/teacher/sessions/' + sessionId + '/groups');
            var options = groups.map(function (optionGroup) {
                return '<option value="' + optionGroup.groupId + '">' + optionGroup.groupName + '</option>';
            }).join('');
            var content = '<div class="detail-stack"><h3>Group Result</h3>' + (groups.map(function (group) {
                return '<div class="detail-panel"><div class="stack">' +
                    '<strong>' + group.groupName + '</strong>' +
                    (group.members || []).map(function (member) {
                        var personality = (member.personality || '').toString().toLowerCase();
                        var avatarText = (member.name || '?').trim().charAt(0).toUpperCase();
                        return '<div class="member-inline">' +
                            '<div class="member-inline-main">' +
                            '<span class="avatar-badge personality-' + personality + '">' + avatarText + '</span>' +
                            '<div class="member-inline-copy"><div class="member-inline-name">' + member.name + '</div><div class="member-inline-meta">' + (member.personality || '-') + '</div></div>' +
                            '</div>' +
                            '<div class="row">' +
                            '<select id="move-user-' + member.userId + '" class="input">' + options + '</select>' +
                            '<button class="btn" onclick="moveMember(' + sessionId + ',' + member.userId + ')">Move</button>' +
                            '</div>' +
                            '</div>';
                    }).join('') +
                    '</div></div>';
            }).join('') || '<div class="panel-empty">No groups found</div>') + '</div>';
            await setActiveDetail(sessionId, content);
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-stack"><h3>Group Result</h3><div class="detail-error">' + error.message + '</div></div>');
        }
    };

    window.moveMember = async function (sessionId, userId) {
        try {
            const targetGroupId = Number(qs('#move-user-' + userId).value);
            await apiRequest('/teacher/sessions/' + sessionId + '/groups/move-member', {
                method: 'POST',
                body: JSON.stringify({
                    userId: userId,
                    targetGroupId: targetGroupId
                })
            });
            await window.viewGroups(sessionId);
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-stack"><h3>Group Result</h3><div class="detail-error">' + error.message + '</div></div>');
        }
    };

    window.viewWaitingRoom = async function (sessionId) {
        try {
            const students = await apiRequest('/teacher/sessions/' + sessionId + '/waiting-room/students');
            if (!students.length) {
                await setActiveDetail(sessionId, '<div class="detail-stack"><h3>Waiting Room Students</h3><div class="panel-empty">No students in waiting room</div></div>');
                return;
            }
            var content = '<div class="detail-stack"><h3>Waiting Room Students</h3>' + students.map(function (student) {
                var personality = (student.personality || '').toString().toLowerCase();
                var avatarText = (student.name || '?').trim().charAt(0).toUpperCase();
                return '<div class="member-inline"><div class="member-inline-main">' +
                    '<span class="avatar-badge personality-' + personality + '">' + avatarText + '</span>' +
                    '<div class="member-inline-copy"><div class="member-inline-name">' + student.name + '</div><div class="member-inline-meta">' + (student.personality || '-') + '</div></div>' +
                    '</div></div>';
            }).join('') + '</div>';
            await setActiveDetail(sessionId, content);
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-stack"><h3>Waiting Room Students</h3><div class="detail-error">' + error.message + '</div></div>');
        }
    };

    window.viewOverview = async function (sessionId) {
        try {
            const overview = await apiRequest('/teacher/sessions/' + sessionId + '/overview');
            var content = '<div class="detail-stack"><h3>Overview</h3><div class="detail-metric-grid">' +
                '<div class="detail-metric"><div class="detail-metric-label">Status</div><div class="detail-metric-value">' + overview.status + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Joined</div><div class="detail-metric-value">' + overview.waitingRoomCount + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Groups</div><div class="detail-metric-value">' + overview.groupCount + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Speaking</div><div class="detail-metric-value">' + overview.totalSpeakingSeconds + 's</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Ready Ack</div><div class="detail-metric-value">' + (overview.groupReadyAckCount || 0) + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Pending</div><div class="detail-metric-value">' + (overview.groupReadyPendingCount || 0) + '</div></div>' +
                '</div>' +
                (overview.groups || []).map(function (group) {
                    return '<div class="detail-panel"><div class="stack">' +
                        '<div class="detail-item-row"><strong>' + group.groupName + '</strong><span class="meta-chip"><strong>' + group.memberCount + '</strong> members</span></div>' +
                        '<div class="member-inline-meta">Speaking ' + group.speakingSeconds + 's</div>' +
                        (group.ranking || []).map(function (item) {
                            var avatarText = (item.name || '?').trim().charAt(0).toUpperCase();
                            return '<div class="member-inline"><div class="member-inline-main">' +
                                '<span class="avatar-badge">' + avatarText + '</span>' +
                                '<div class="member-inline-copy"><div class="member-inline-name">' + item.name + '</div><div class="member-inline-meta">' + item.score + 's</div></div>' +
                                '</div></div>';
                        }).join('') +
                        '</div></div>';
                }).join('') +
                '<div class="detail-panel"><div class="stack"><strong>Group Ready Confirmation</strong>' +
                (((overview.groupReadyStudents || []).map(function (student) {
                    var personality = (student.personality || '').toString().toLowerCase();
                    var avatarText = (student.name || '?').trim().charAt(0).toUpperCase();
                    return '<div class="member-inline">' +
                        '<div class="member-inline-main">' +
                        '<span class="avatar-badge personality-' + personality + '">' + avatarText + '</span>' +
                        '<div class="member-inline-copy"><div class="member-inline-name">' + student.name + '</div><div class="member-inline-meta">' + (student.personality || '-') + '</div></div>' +
                        '</div>' +
                        '<span class="status-chip ' + (student.acknowledged ? 'status-active' : 'status-warning') + '">' + (student.acknowledged ? 'Acknowledged' : 'Pending') + '</span>' +
                        '</div>';
                }).join('')) || '<div class="panel-empty">No acknowledgement data</div>') + '</div></div></div>';
            await setActiveDetail(sessionId, content);
        } catch (error) {
            await setActiveDetailError(sessionId, '<div class="detail-stack"><h3>Overview</h3><div class="detail-error">' + error.message + '</div></div>');
        }
    };

    window.viewResult = function (sessionId) {
        window.location.href = './teacher-session.html?sessionId=' + sessionId;
    };

    window.openSessionMonitor = function (sessionId) {
        window.location.href = './teacher-session.html?sessionId=' + sessionId;
    };

    window.addEventListener('beforeunload', function () {
        clearActiveDetail();
        clearSessionCountdownTimers();
    });
});
