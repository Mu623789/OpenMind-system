document.addEventListener('DOMContentLoaded', async function () {
    const user = requireCurrentUser();
    if (!user) {
        window.location.href = './login.html';
        return;
    }
    setResultMapPlayerAvatar(user);

    var headerEl = document.querySelector('.page-header');
    if (headerEl) {
        headerEl.classList.add(user.role === 'TEACHER' ? 'page-header-teacher' : 'page-header-student');
    }

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    const from = params.get('from');
    if (!sessionId) {
        qs('#resultTopic').textContent = 'Missing session id';
        return;
    }

    qs('#backButton').addEventListener('click', function () {
        if (from === 'teacher-dashboard') {
            window.location.href = './teacher-dashboard.html';
            return;
        }
        window.location.href = user.role === 'TEACHER' ? './teacher-dashboard.html' : './waiting-room.html';
    });

    if (user.role !== 'TEACHER') {
        qs('#exportCsvButton').style.display = 'none';
    } else {
        qs('#exportCsvButton').addEventListener('click', async function () {
            try {
                const response = await fetch(API_BASE_URL + '/teacher/sessions/' + sessionId + '/result.csv', {
                    headers: {
                        Authorization: 'Bearer ' + getAccessToken()
                    }
                });
                if (!response.ok) {
                    throw new Error('Export failed with status ' + response.status);
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'session-' + sessionId + '-result.csv';
                link.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                showMessage(qs('#message'), error.message, true);
            }
        });
    }

    try {
        const data = await apiRequest(user.role === 'TEACHER' ? '/teacher/sessions/' + sessionId + '/result' : '/students/session-result?sessionId=' + sessionId);
        qs('#resultTopic').textContent = data.topic + ' - ' + data.status + ' - ' + (data.durationMinutes || '-') + ' min';

        var groups = data.groups || [];
        var totalParticipants = 0;
        var totalSpeaking = 0;
        var sessionDurationSeconds = Math.max(1, (data.durationMinutes || 0) * 60);
        var myRoundCoins = 0;
        groups.forEach(function (group) {
            var members = group.members || [];
            totalParticipants += members.length;
            members.forEach(function (m) {
                totalSpeaking += (m.score || 0);
                if (Number(m.userId) === Number(user.id)) {
                    myRoundCoins = calculateRoundCoins(m.score || 0, sessionDurationSeconds);
                }
            });
        });

        var summaryHtml =
            '<div class="stat-card"><div class="stat-label">Groups</div><div class="stat-value">' + groups.length + '</div><div class="stat-note">Discussion groups in this session</div></div>' +
            '<div class="stat-card"><div class="stat-label">Participants</div><div class="stat-value">' + totalParticipants + '</div><div class="stat-note">Students included in the result</div></div>' +
            '<div class="stat-card"><div class="stat-label">Speaking</div><div class="stat-value">' + totalSpeaking + 's</div><div class="stat-note">Total speaking time recorded</div></div>' +
            '<div class="stat-card result-coin-summary"><div class="stat-label">Round Coins</div><div class="stat-value"><img src="../assets/images/playful/star-coin.png" alt=""> ' + myRoundCoins + '</div><div class="stat-note">Coins you earned in this session</div></div>' +
            '<div class="stat-card"><div class="stat-label">Started</div><div class="stat-value result-summary-time">' + (data.startedAt ? new Date(data.startedAt).toLocaleString() : '-') + '</div><div class="stat-note">Session end: ' + (data.endedAt ? new Date(data.endedAt).toLocaleString() : '-') + '</div></div>';
        qs('#resultSummaryContent').innerHTML = summaryHtml;
        qs('#resultSummary').style.display = '';

        var medals = ['&#127942;', '&#129352;', '&#129353;'];
        qs('#resultRanking').innerHTML = (data.ranking || []).map(function (item, index) {
            var medal = index < 3 ? medals[index] : (index + 1);
            return '<div class="leaderboard-row">' +
                '<div class="leaderboard-rank">' + medal + '</div>' +
                '<div class="leaderboard-copy">' +
                '<div class="leaderboard-name">' + escapeText(item.name || '') + '</div>' +
                '<div class="leaderboard-score">' + (item.score || 0) + 's - ' + escapeText(item.groupName || '') + '</div>' +
                '</div>' +
                '</div>';
        }).join('') || '<div class="panel-empty">No ranking data</div>';
        applyStagger(qs('#resultRanking'));

        qs('#resultGroups').innerHTML = groups.map(function (group, groupIndex) {
            var members = (group.members || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
            var groupTotal = 0;
            members.forEach(function (m) { groupTotal += (m.score || 0); });
            var topSpeaker = members[0];
            var avgSpeaking = members.length ? Math.round(groupTotal / members.length) : 0;
            var balanceLabel = 'Balanced';
            var topShare = topSpeaker && groupTotal ? Math.round(((topSpeaker.score || 0) / groupTotal) * 100) : 0;
            if (topShare >= 60) {
                balanceLabel = 'Highly Dominated';
            } else if (topShare >= 45) {
                balanceLabel = 'Slightly Dominated';
            }
            return '<div class="result-group-card">' +
                '<div class="detail-item-row">' +
                '<strong>' + escapeText(group.groupName || ('Group ' + (groupIndex + 1))) + '</strong>' +
                '<span class="meta-chip"><strong>' + members.length + '</strong> members</span>' +
                '</div>' +
                '<div class="result-group-top">' +
                '<div class="result-balance-card">' +
                '<div class="result-balance-label">Balance Status</div>' +
                '<div class="result-balance-value">' + balanceLabel + '</div>' +
                '<div class="result-balance-note">Top share ' + topShare + '% of group speaking</div>' +
                '</div>' +
                '<div class="result-group-metrics">' +
                '<div class="detail-metric"><div class="detail-metric-label">Total Speaking</div><div class="detail-metric-value">' + groupTotal + 's</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Average</div><div class="detail-metric-value">' + avgSpeaking + 's</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Top Speaker</div><div class="detail-metric-value">' + escapeText(topSpeaker ? topSpeaker.name : '-') + '</div></div>' +
                '<div class="detail-metric"><div class="detail-metric-label">Top Share</div><div class="detail-metric-value">' + topShare + '%</div></div>' +
                '</div>' +
                '</div>' +
                '<div class="result-member-bars">' +
                (members.map(function (member) {
                    var pct = groupTotal ? Math.max(4, Math.round(((member.score || 0) / groupTotal) * 100)) : 4;
                    var coins = calculateRoundCoins(member.score || 0, sessionDurationSeconds);
                    return '<div class="result-member-row">' +
                        '<div class="result-member-head"><span>' + escapeText(member.name || '') + '</span><span class="result-member-stats"><span>' + (member.score || 0) + 's</span><span class="result-coin-badge"><img src="../assets/images/playful/star-coin.png" alt=""> ' + coins + '</span></span></div>' +
                        '<div class="monitor-heat-bar"><div class="monitor-heat-fill" style="width:' + pct + '%;background:linear-gradient(90deg, rgba(59,130,246,.95), rgba(139,92,246,.58));"></div></div>' +
                        '</div>';
                }).join('') || '<div class="panel-empty">No members</div>') +
                '</div>' +
                '</div>';
        }).join('') || '<div class="panel-empty">No group data</div>';
        applyStagger(qs('#resultGroups'));
    } catch (error) {
        qs('#resultTopic').textContent = error.message;
    }

    function applyStagger(container) {
        if (container.dataset.staggerApplied) return;
        container.dataset.staggerApplied = '1';
        var children = container.children;
        for (var i = 0; i < children.length; i++) {
            children[i].classList.add('stagger-in');
            children[i].style.animationDelay = (i * 40) + 'ms';
        }
    }

    function calculateRoundCoins(score, sessionDurationSeconds) {
        var progress = Math.max(0, Math.min(100, ((score || 0) / (sessionDurationSeconds || 1)) * 100));
        var passedFlags = [20, 40, 60, 80].filter(function (checkpoint) {
            return progress >= checkpoint;
        }).length;
        return passedFlags * 10;
    }

    function setResultMapPlayerAvatar(profile) {
        var player = qs('#resultMapPlayer');
        if (!player) {
            return;
        }
        var avatar = profile && profile.avatar ? profile.avatar : 'kitty.png';
        player.src = '../assets/images/avatars/' + avatar;
    }
});
