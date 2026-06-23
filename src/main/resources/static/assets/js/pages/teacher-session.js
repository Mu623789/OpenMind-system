document.addEventListener('DOMContentLoaded', async function () {
    const user = requireCurrentUser();
    if (!user || user.role !== 'TEACHER') {
        window.location.href = './login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    if (!sessionId) {
        qs('#sessionMeta').textContent = 'Missing session id';
        return;
    }

    let currentOverview = null;
    let currentSpeakers = {};
    let lastSpeakTime = {};
    let overviewTimer = null;
    let realtimeConnected = false;
    let timerInterval = null;
    let timerStarted = false;
    var analyticsTab = 'group';
    var cachedTimeline = null;
    var groupColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

    connectDiscussionSocket(sessionId, function (message) {
        if (message.type === 'SESSION_ENDED' && message.sessionId === Number(sessionId)) {
            showNotification('Session Ended', 'The session has ended automatically.');
            if (overviewTimer) {
                clearInterval(overviewTimer);
                overviewTimer = null;
            }
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            qs('#timerText').textContent = 'Ended';
            qs('#timerProgress').style.width = '100%';
            return;
        }
        if (!currentOverview || message.sessionId !== Number(sessionId)) {
            return;
        }
        if (message.payload && message.payload.userId && (message.type === 'SPEAKING_START' || message.type === 'SPEAKING_END')) {
            currentSpeakers[message.groupId] = message.payload.speaking ? message.payload.userName : '';
            if (message.payload.speaking) {
                lastSpeakTime[message.groupId] = Date.now();
            }
            if (analyticsTab === 'timeline' && currentOverview && currentOverview.status !== 'ENDED') {
                cachedTimeline = null;
                renderAnalytics(currentOverview);
            }
            renderAlerts(currentOverview);
            renderGroupStatus(currentOverview);
        }
    }, {
        onOpen: function () {
            realtimeConnected = true;
        },
        onError: function () {
            realtimeConnected = false;
        },
        onClose: function () {
            realtimeConnected = false;
        }
    });

    window.addEventListener('beforeunload', function () {
        if (overviewTimer) {
            clearInterval(overviewTimer);
        }
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        if (chartInstance) {
            chartInstance.dispose();
            chartInstance = null;
        }
        disconnectDiscussionSocket();
    });

    qs('#exportCsvButton').addEventListener('click', async function () {
        try {
            var response = await fetch(API_BASE_URL + '/teacher/sessions/' + sessionId + '/result.csv', {
                headers: { Authorization: 'Bearer ' + getAccessToken() }
            });
            if (!response.ok) throw new Error('Export failed: ' + response.status);
            var blob = await response.blob();
            var url = window.URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'session-' + sessionId + '-result.csv';
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.message);
        }
    });

    await loadOverview();
    overviewTimer = setInterval(loadOverview, 5000);

    function renderMonitorStats(overview) {
        var connectedLabel = realtimeConnected ? 'Connected' : 'Fallback';
        var connectedNote = realtimeConnected ? 'WebSocket live updates are active' : 'Polling backup is currently in use';
        qs('#monitorStats').innerHTML =
            '<div class="stat-card">' +
            '<div class="stat-label">Groups</div>' +
            '<div class="stat-value">' + (overview.groupCount || 0) + '</div>' +
            '<div class="stat-note">Active groups in this session</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Participants</div>' +
            '<div class="stat-value">' + (overview.participantCount || 0) + '</div>' +
            '<div class="stat-note">Students currently assigned</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Speaking</div>' +
            '<div class="stat-value">' + (overview.totalSpeakingSeconds || 0) + 's</div>' +
            '<div class="stat-note">Total airtime recorded so far</div>' +
            '</div>' +
            '<div class="stat-card">' +
            '<div class="stat-label">Realtime</div>' +
            '<div class="stat-value">' + connectedLabel + '</div>' +
            '<div class="stat-note">' + connectedNote + '</div>' +
            '</div>';
    }

    async function loadOverview() {
        try {
            currentOverview = await apiRequest('/teacher/sessions/' + sessionId + '/overview');
            qs('#sessionMeta').textContent = currentOverview.topic + ' - ' + currentOverview.status + ' - Joined ' + currentOverview.waitingRoomCount + ' - ' + (realtimeConnected ? 'Realtime connected' : 'Fallback mode');
            renderMonitorStats(currentOverview);
            if (analyticsTab === 'timeline' && currentOverview.status !== 'ENDED') {
                cachedTimeline = null;
            }
            qs('#overviewPanel').innerHTML =
                '<div class="detail-metric">' +
                '<div class="detail-metric-label">Session Status</div>' +
                '<div class="detail-metric-value">' + currentOverview.status + '</div>' +
                '</div>' +
                '<div class="detail-metric">' +
                '<div class="detail-metric-label">Joined</div>' +
                '<div class="detail-metric-value">' + (currentOverview.waitingRoomCount || 0) + '</div>' +
                '</div>' +
                '<div class="detail-metric">' +
                '<div class="detail-metric-label">Groups Ready</div>' +
                '<div class="detail-metric-value">' + (currentOverview.groupCount || 0) + '</div>' +
                '</div>' +
                '<div class="detail-metric">' +
                '<div class="detail-metric-label">Connection</div>' +
                '<div class="detail-metric-value">' + (realtimeConnected ? 'Live' : 'Fallback') + '</div>' +
                '</div>';
            renderAlerts(currentOverview);
            renderAnalytics(currentOverview);
            renderGroupStatus(currentOverview);
            if (!timerStarted && currentOverview.status === 'RUNNING') {
                timerStarted = true;
                initTimer(currentOverview);
            }
            if (currentOverview.status === 'ENDED') {
                if (overviewTimer) {
                    clearInterval(overviewTimer);
                    overviewTimer = null;
                }
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                qs('#timerText').textContent = 'Ended';
                qs('#timerProgress').style.width = '100%';
                loadSessionResult();
            }
        } catch (error) {
            qs('#sessionMeta').textContent = error.message;
        }
    }

    var SILENT_THRESHOLD_MS = 15000;

    function renderAlerts(overview) {
        if (!overview || overview.status === 'ENDED' || overview.status !== 'RUNNING' || !overview.startedAt) {
            qs('#alertPanel').innerHTML = '';
            return;
        }
        var now = Date.now();
        var silentGroups = (overview.groups || []).filter(function (group) {
            if ((currentSpeakers[group.groupId] || '') !== '') return false;
            var last = lastSpeakTime[group.groupId];
            if (!last) return (now - new Date(overview.startedAt).getTime()) > SILENT_THRESHOLD_MS;
            return (now - last) > SILENT_THRESHOLD_MS;
        });
        if (!silentGroups.length) {
            qs('#alertPanel').innerHTML = '<div class="detail-panel"><div class="detail-item-row"><strong>All groups active</strong><span class="status-chip status-active">Stable</span></div><div class="member-inline-meta">No silent groups detected right now.</div></div>';
            return;
        }
        qs('#alertPanel').innerHTML = silentGroups.map(function (group) {
            var last = lastSpeakTime[group.groupId];
            var silentSec = Math.round((now - (last || new Date(overview.startedAt).getTime())) / 1000);
            return '<div class="detail-panel monitor-alert-card">' +
                '<div class="detail-item-row">' +
                '<strong>' + escapeText(group.groupName || '') + '</strong>' +
                '<span class="status-chip status-warning">Silent ' + silentSec + 's</span>' +
                '</div>' +
                '<div class="member-inline-meta">This group has no active speaker and may need a prompt or teacher attention.</div>' +
                '</div>';
        }).join('');
    }

    function updateTabButtons() {
        var overview = currentOverview;
        var individualCount = 0;
        var timelineCount = cachedTimeline ? cachedTimeline.length : 0;
        if (overview && overview.groups) {
            overview.groups.forEach(function (g) {
                individualCount += (g.ranking || []).length;
            });
        }
        var tabs = [
            { id: '#tabGroup', key: 'group', label: 'Group', count: overview ? (overview.groupCount || 0) : 0 },
            { id: '#tabIndividual', key: 'individual', label: 'Individual', count: individualCount },
            { id: '#tabTimeline', key: 'timeline', label: 'Timeline', count: timelineCount }
        ];
        tabs.forEach(function (tab) {
            var btn = qs(tab.id);
            btn.className = analyticsTab === tab.key ? 'btn' : 'btn btn-outline';
            btn.textContent = tab.label + (tab.count > 0 ? ' (' + tab.count + ')' : '');
        });
    }

    qs('#tabGroup').addEventListener('click', function () {
        analyticsTab = 'group';
        updateTabButtons();
        renderAnalytics(currentOverview);
    });
    qs('#tabIndividual').addEventListener('click', function () {
        analyticsTab = 'individual';
        updateTabButtons();
        renderAnalytics(currentOverview);
    });
    qs('#tabTimeline').addEventListener('click', function () {
        analyticsTab = 'timeline';
        if (currentOverview && currentOverview.status !== 'ENDED') {
            cachedTimeline = null;
        }
        updateTabButtons();
        renderAnalytics(currentOverview);
    });
    updateTabButtons();

    function renderAnalytics(overview) {
        if (!overview) return;
        if (analyticsTab === 'group') {
            renderGroupTab(overview);
        } else if (analyticsTab === 'individual') {
            renderIndividualTab(overview);
        } else {
            renderTimelineTab(overview);
        }
    }

    var chartInstance = null;
    var currentChartTab = null;

    function disposeChart() {
        if (chartInstance) { chartInstance.dispose(); chartInstance = null; }
        currentChartTab = null;
    }

    function ensureChartContainer(minHeight) {
        var panel = qs('#analyticsPanel');
        var box = document.getElementById('echartsBox');
        if (chartInstance && currentChartTab === analyticsTab && box) {
            box.style.minHeight = minHeight + 'px';
            return chartInstance;
        }
        disposeChart();
        panel.innerHTML = '<div id="echartsBox" style="width:100%;min-height:' + minHeight + 'px;"></div>';
        chartInstance = echarts.init(document.getElementById('echartsBox'));
        currentChartTab = analyticsTab;
        return chartInstance;
    }

    window.addEventListener('resize', function () {
        if (chartInstance) chartInstance.resize();
    });

    function renderGroupTab(overview) {
        var groups = overview.groups || [];
        if (!groups.length) {
            disposeChart();
            qs('#analyticsPanel').innerHTML = '<div class="panel-empty">No data</div>';
            return;
        }
        var names = groups.map(function (g) { return g.groupName; }).reverse();
        var values = groups.map(function (g) { return g.speakingSeconds || 0; }).reverse();
        var colors = groups.map(function (g, i) { return groupColors[i % groupColors.length]; }).reverse();
        var isSingleGroup = groups.length === 1;
        var xAxisMax = isSingleGroup ? Math.max((values[0] || 0) * 2, 6) : null;
        var chart = ensureChartContainer(isSingleGroup ? 78 : Math.max(120, groups.length * 48));
        chart.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                textStyle: { color: '#1e293b' },
                extraCssText: 'backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 8px;',
                formatter: function (p) { return '<span style="font-weight:600;">' + p[0].name + '</span><br/>Speaking: ' + p[0].value + 's'; }
            },
            grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
            xAxis: { type: 'value', max: xAxisMax, axisLabel: { formatter: '{value}s', fontSize: 11, color: '#64748b' }, splitLine: { show: false } },
            yAxis: { type: 'category', data: names, axisLabel: { fontSize: 12, color: '#334155', fontWeight: 500 }, axisTick: { show: false }, axisLine: { show: false } },
            series: [{
                type: 'bar',
                data: values.map(function (v, i) {
                    return {
                        value: v,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                                { offset: 0, color: colors[i] },
                                { offset: 1, color: colors[i] + '80' }
                            ]),
                            borderRadius: [0, 6, 6, 0]
                        }
                    };
                }),
                barWidth: isSingleGroup ? 14 : null,
                barMaxWidth: isSingleGroup ? 14 : 28,
                label: { show: true, position: 'right', formatter: '{c}s', fontSize: 11, color: '#475569', fontWeight: 600 },
                animationDuration: 800,
                animationEasing: 'cubicOut'
            }]
        });
    }

    function renderIndividualTab(overview) {
        var groups = overview.groups || [];
        var ranking = [];
        groups.forEach(function (group, idx) {
            (group.ranking || []).forEach(function (item) {
                ranking.push({ name: item.name, score: item.score || 0, groupName: group.groupName, groupIdx: idx });
            });
        });
        ranking.sort(function (a, b) { return b.score - a.score; });
        if (!ranking.length) {
            disposeChart();
            qs('#analyticsPanel').innerHTML = '<div class="panel-empty">No data</div>';
            return;
        }
        var items = ranking.reverse();
        var names = items.map(function (r) { return r.groupName.replace('Group ', 'G') + '-' + r.name; });
        var values = items.map(function (r) { return r.score; });
        var colors = items.map(function (r) { return groupColors[r.groupIdx % groupColors.length]; });
        var chart = ensureChartContainer(Math.max(160, items.length * 32));
        chart.setOption({
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                textStyle: { color: '#1e293b' },
                extraCssText: 'backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 8px;',
                formatter: function (p) { return '<span style="font-weight:600;">' + p[0].name + '</span><br/>Speaking: ' + p[0].value + 's'; }
            },
            grid: { left: 10, right: 40, top: 28, bottom: 10, containLabel: true },
            xAxis: { type: 'category', data: names, axisLabel: { fontSize: 11, interval: 0, rotate: names.length > 8 ? 35 : 0, color: '#64748b' }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
            yAxis: { type: 'value', axisLabel: { formatter: '{value}s', fontSize: 11, color: '#64748b' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
            series: [{
                type: 'line',
                data: values,
                smooth: 0.4,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { width: 3, color: '#3b82f6', shadowColor: 'rgba(59,130,246,0.3)', shadowBlur: 10, shadowOffsetY: 4 },
                itemStyle: { color: '#3b82f6', borderColor: '#ffffff', borderWidth: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59,130,246,.3)' },
                        { offset: 1, color: 'rgba(59,130,246,.0)' }
                    ])
                },
                label: { show: true, position: 'top', formatter: '{c}s', fontSize: 10, color: '#475569', fontWeight: 600 },
                animationDuration: 800,
                animationEasing: 'cubicOut'
            }]
        });
    }

    async function renderTimelineTab(overview) {
        var panel = qs('#analyticsPanel');
        if (!cachedTimeline) {
            disposeChart();
            panel.innerHTML = '<div class="panel-empty">Loading timeline...</div>';
            try {
                cachedTimeline = await apiRequest('/teacher/sessions/' + sessionId + '/speaking-logs');
            } catch (error) {
                disposeChart();
                panel.innerHTML = '<div class="detail-error">Failed to load timeline.</div>';
                return;
            }
        }
        if (!cachedTimeline || !cachedTimeline.length) {
            disposeChart();
            panel.innerHTML = '<div class="panel-empty">No speaking data yet.</div>';
            return;
        }
        var startedAt = overview.startedAt ? new Date(overview.startedAt).getTime() : null;
        if (!startedAt) {
            disposeChart();
            panel.innerHTML = '<div class="panel-empty">Session not started yet.</div>';
            return;
        }
        var endedAt = overview.endedAt ? new Date(overview.endedAt).getTime() : null;
        var timeEnd = endedAt || Date.now();
        var groups = overview.groups || [];
        var groupIndexMap = {};
        groups.forEach(function (g, idx) { groupIndexMap[g.groupId] = idx; });
        var rows = [];
        var rowKeyMap = {};
        cachedTimeline.forEach(function (log) {
            var key = log.groupId + '-' + log.userId;
            if (!rowKeyMap[key]) {
                var gIdx = groupIndexMap[log.groupId] !== undefined ? groupIndexMap[log.groupId] : 0;
                var label = log.groupName.replace('Group ', 'G') + '-' + log.userName;
                rowKeyMap[key] = { label: label, groupIdx: gIdx, logs: [] };
                rows.push(rowKeyMap[key]);
            }
            rowKeyMap[key].logs.push(log);
        });
        rows.sort(function (a, b) { return a.groupIdx - b.groupIdx; });
        var legendData = rows.map(function (r) { return r.label; });
        var legendColors = {};
        rows.forEach(function (r) { legendColors[r.label] = groupColors[r.groupIdx % groupColors.length]; });
        var seriesMap = {};
        rows.forEach(function (r) { seriesMap[r.label] = []; });
        rows.forEach(function (row) {
            row.logs.forEach(function (log) {
                seriesMap[row.label].push([new Date(log.startTime).getTime(), log.durationSeconds]);
            });
        });
        var seriesList = legendData.map(function (name) {
            return {
                name: name,
                type: 'bar',
                data: seriesMap[name],
                barMaxWidth: 20,
                itemStyle: { color: legendColors[name], borderRadius: [3, 3, 0, 0], opacity: 0.85 },
                label: { show: true, position: 'top', formatter: function (p) { return p.value[1] + 's'; }, fontSize: 10, color: '#475569', fontWeight: 600 },
                emphasis: { itemStyle: { opacity: 1, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' } },
                animationDuration: 800,
                animationEasing: 'cubicOut'
            };
        });
        function fmtTime(val) {
            var sec = Math.round((val - startedAt) / 1000);
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
        var chart = ensureChartContainer(260);
        chart.setOption({
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                textStyle: { color: '#1e293b' },
                extraCssText: 'backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 8px;',
                formatter: function (p) {
                    return '<span style="font-weight:600;">' + p.seriesName + '</span><br/>At ' + fmtTime(p.value[0]) + '<br/>Duration: ' + p.value[1] + 's';
                }
            },
            legend: { data: legendData, top: 0, textStyle: { fontSize: 11, color: '#475569' } },
            grid: { left: 10, right: 20, top: 36, bottom: 10, containLabel: true },
            xAxis: {
                type: 'time',
                min: startedAt,
                max: timeEnd,
                axisLabel: {
                    fontSize: 10,
                    color: '#64748b',
                    formatter: function (val) { return fmtTime(val); }
                },
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLine: { lineStyle: { color: '#e2e8f0' } }
            },
            yAxis: {
                type: 'value',
                name: 'Duration (s)',
                nameTextStyle: { fontSize: 10, color: '#94a3b8' },
                axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}s' },
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLine: { show: false }
            },
            series: seriesList
        });
    }

    function initTimer(overview) {
        if (!overview.startedAt || !overview.durationMinutes || !overview.expectedEndAt || !overview.serverNow) return;
        var startedAt = new Date(overview.startedAt).getTime();
        var durationMs = overview.durationMinutes * 60 * 1000;
        var endTime = new Date(overview.expectedEndAt).getTime();
        var serverNow = new Date(overview.serverNow).getTime();
        var clientNow = Date.now();
        var serverOffsetMs = serverNow - clientNow;

        qs('#sessionTopic').textContent = overview.topic || '';
        qs('#timerBar').style.display = 'block';

        timerInterval = setInterval(function () {
            var now = Date.now() + serverOffsetMs;
            var remaining = Math.max(0, endTime - now);
            var elapsed = now - startedAt;
            var progress = Math.min(100, (elapsed / durationMs) * 100);

            var totalSec = Math.ceil(remaining / 1000);
            var min = Math.floor(totalSec / 60);
            var sec = totalSec % 60;
            qs('#timerText').textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
            qs('#timerProgress').style.width = progress + '%';

            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                qs('#timerText').textContent = 'Time is up';
                qs('#timerProgress').style.width = '100%';
            }
        }, 1000);
    }

    function renderGroupStatus(overview) {
        qs('#groupStatusPanel').innerHTML = (overview.groups || []).map(function (group) {
            var isSilent = (currentSpeakers[group.groupId] || '') === '';
            var ranking = group.ranking || [];
            var groupTotal = ranking.reduce(function (s, item) { return s + (item.score || 0); }, 0) || 1;
            var heatmapRows = ranking.map(function (item) {
                var pct = Math.min(100, Math.round(((item.score || 0) / groupTotal) * 100));
                var r, g;
                if (pct <= 50) {
                    r = 239;
                    g = Math.round(68 + (pct / 50) * (168 - 68));
                } else {
                    r = Math.round(239 - ((pct - 50) / 50) * (239 - 34));
                    g = Math.round(168 + ((pct - 50) / 50) * (197 - 168));
                }
                var color = 'rgb(' + r + ',' + g + ',68)';
                var avatarText = (item.name || '?').trim().charAt(0).toUpperCase();
                var safeAvatarText = escapeText(avatarText);
                var safeItemName = escapeText(item.name || '');
                return '<div class="monitor-heat-row">' +
                    '<span class="avatar-badge" style="background:' + color + ';color:#fff;flex-shrink:0;box-shadow:0 2px 8px ' + color.replace('rgb', 'rgba').replace(')', ',.35)') + ',0 0 0 2px rgba(255,255,255,.6);">' + safeAvatarText + '</span>' +
                    '<div class="monitor-heat-copy">' +
                    '<div class="monitor-heat-name">' + safeItemName + ' <span class="monitor-heat-score">' + item.score + 's</span></div>' +
                    '<div class="monitor-heat-bar"><div class="monitor-heat-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + color + ',rgba(139,92,246,.5));"></div></div>' +
                    '</div>' +
                    '<span class="monitor-heat-percent">' + pct + '%</span>' +
                    '</div>';
            }).join('');
            var safeGroupName = escapeText(group.groupName || '');
            var safeCurrentSpeaker = escapeText(currentSpeakers[group.groupId] || '-');
            return '<div class="monitor-group-card">' +
                '<div class="detail-item-row">' +
                '<strong>' + safeGroupName + '</strong>' +
                '<span class="status-chip ' + (isSilent ? 'status-warning' : 'status-active') + '">' + (isSilent ? 'Silent' : 'Active') + '</span>' +
                '</div>' +
                '<div class="monitor-group-meta">Current Speaker: <strong>' + safeCurrentSpeaker + '</strong><span class="meta-chip"><strong>' + (group.speakingSeconds || 0) + 's</strong> total</span></div>' +
                (heatmapRows || '<div class="panel-empty">No participation data yet.</div>') +
                '</div>';
        }).join('');
    }

    var resultLoaded = false;
    async function loadSessionResult() {
        if (resultLoaded) return;
        resultLoaded = true;
        try {
            var data = await apiRequest('/teacher/sessions/' + sessionId + '/result');
            var groups = data.groups || [];
            var totalSpeaking = 0;
            var totalParticipants = 0;
            var mostActiveGroup = null;
            var leastBalancedGroup = null;
            var analysisGroups = groups.map(function (group, index) {
                var members = (group.members || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
                var groupTotal = 0;
                members.forEach(function (m) { groupTotal += (m.score || 0); });
                totalSpeaking += groupTotal;
                totalParticipants += members.length;
                var topSpeaker = members[0] || null;
                var avgSpeaking = members.length ? Math.round(groupTotal / members.length) : 0;
                var topShare = topSpeaker && groupTotal ? Math.round(((topSpeaker.score || 0) / groupTotal) * 100) : 0;
                var balanceLabel = 'Balanced';
                if (topShare >= 60) {
                    balanceLabel = 'Highly Dominated';
                } else if (topShare >= 45) {
                    balanceLabel = 'Slightly Dominated';
                }
                var record = {
                    groupName: group.groupName || ('Group ' + (index + 1)),
                    members: members,
                    groupTotal: groupTotal,
                    avgSpeaking: avgSpeaking,
                    topSpeaker: topSpeaker,
                    topShare: topShare,
                    balanceLabel: balanceLabel
                };
                if (!mostActiveGroup || groupTotal > mostActiveGroup.groupTotal) {
                    mostActiveGroup = record;
                }
                if (!leastBalancedGroup || topShare > leastBalancedGroup.topShare) {
                    leastBalancedGroup = record;
                }
                return record;
            });

            qs('#resultSummaryCards').innerHTML =
                '<div class="stat-card">' +
                '<div class="stat-label">Participants</div>' +
                '<div class="stat-value">' + totalParticipants + '</div>' +
                '<div class="stat-note">Students included in the final result</div>' +
                '</div>' +
                '<div class="stat-card">' +
                '<div class="stat-label">Speaking</div>' +
                '<div class="stat-value">' + totalSpeaking + 's</div>' +
                '<div class="stat-note">Total discussion time recorded</div>' +
                '</div>' +
                '<div class="stat-card">' +
                '<div class="stat-label">Most Active Group</div>' +
                '<div class="stat-value">' + escapeText(mostActiveGroup ? mostActiveGroup.groupName : '-') + '</div>' +
                '<div class="stat-note">' + (mostActiveGroup ? (mostActiveGroup.groupTotal + 's total speaking') : 'No activity data') + '</div>' +
                '</div>' +
                '<div class="stat-card">' +
                '<div class="stat-label">Attention Group</div>' +
                '<div class="stat-value">' + escapeText(leastBalancedGroup ? leastBalancedGroup.groupName : '-') + '</div>' +
                '<div class="stat-note">' + (leastBalancedGroup ? (leastBalancedGroup.balanceLabel + ' - top share ' + leastBalancedGroup.topShare + '%') : 'No balance data') + '</div>' +
                '</div>';

            var medals = ['&#127942;', '&#129352;', '&#129353;'];
            qs('#resultRanking').innerHTML = (data.ranking || []).map(function (item, index) {
                var medal = index < 3 ? medals[index] : (index + 1);
                return '<div class="leaderboard-row">' +
                    '<div class="leaderboard-rank">' + medal + '</div>' +
                    '<div class="leaderboard-copy">' +
                    '<div class="leaderboard-name">' + escapeText(item.name || '') + '</div>' +
                    '<div class="leaderboard-score">' + (item.score || 0) + 's - ' + escapeText(item.groupName || '') + '</div>' +
                    '</div></div>';
            }).join('') || '<div class="panel-empty">No ranking data</div>';

            qs('#resultGroups').innerHTML = analysisGroups.map(function (group) {
                return '<div class="result-group-card">' +
                    '<div class="detail-item-row">' +
                    '<strong>' + escapeText(group.groupName) + '</strong>' +
                    '<span class="meta-chip"><strong>' + group.members.length + '</strong> members</span>' +
                    '</div>' +
                    '<div class="result-group-top">' +
                    '<div class="result-balance-card">' +
                    '<div class="result-balance-label">Teaching Signal</div>' +
                    '<div class="result-balance-value">' + group.balanceLabel + '</div>' +
                    '<div class="result-balance-note">Top share ' + group.topShare + '% of the group speaking time</div>' +
                    '</div>' +
                    '<div class="result-group-metrics">' +
                    '<div class="detail-metric"><div class="detail-metric-label">Total Speaking</div><div class="detail-metric-value">' + group.groupTotal + 's</div></div>' +
                    '<div class="detail-metric"><div class="detail-metric-label">Average</div><div class="detail-metric-value">' + group.avgSpeaking + 's</div></div>' +
                    '<div class="detail-metric"><div class="detail-metric-label">Top Speaker</div><div class="detail-metric-value">' + escapeText(group.topSpeaker ? group.topSpeaker.name : '-') + '</div></div>' +
                    '<div class="detail-metric"><div class="detail-metric-label">Top Share</div><div class="detail-metric-value">' + group.topShare + '%</div></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="result-member-bars">' +
                    (group.members.map(function (member) {
                        var pct = group.groupTotal ? Math.max(4, Math.round(((member.score || 0) / group.groupTotal) * 100)) : 4;
                        return '<div class="result-member-row">' +
                            '<div class="result-member-head"><span>' + escapeText(member.name || '') + '</span><span>' + (member.score || 0) + 's</span></div>' +
                            '<div class="monitor-heat-bar"><div class="monitor-heat-fill" style="width:' + pct + '%;background:linear-gradient(90deg, rgba(59,130,246,.95), rgba(139,92,246,.58));"></div></div>' +
                            '</div>';
                    }).join('') || '<div class="panel-empty">No members</div>') +
                    '</div>' +
                    '</div>';
            }).join('') || '<div class="panel-empty">No group data</div>';

            qs('#resultSection').style.display = '';
        } catch (error) {
            resultLoaded = false;
        }
    }

    function showNotification(title, body) {
        var overlay = qs('#notificationOverlay');
        var box = qs('#notificationBox');
        box.innerHTML = '';
        var titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        titleEl.textContent = title;
        var bodyEl = document.createElement('div');
        bodyEl.className = 'notification-body';
        bodyEl.textContent = body;
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;justify-content:center;';
        var stayBtn = document.createElement('button');
        stayBtn.className = 'btn';
        stayBtn.textContent = 'Stay';
        stayBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            overlay.style.display = 'none';
        });
        var backBtn = document.createElement('button');
        backBtn.className = 'btn btn-outline';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.location.href = './teacher-dashboard.html';
        });
        btnRow.appendChild(stayBtn);
        btnRow.appendChild(backBtn);
        box.appendChild(titleEl);
        box.appendChild(bodyEl);
        box.appendChild(btnRow);
        overlay.style.display = 'flex';
        loadOverview();
    }
});

