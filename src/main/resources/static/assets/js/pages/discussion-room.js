document.addEventListener('DOMContentLoaded', function () {
    const user = requireCurrentUser();
    const group = storage.get('currentGroup');
    if (!user || !group) {
        window.location.href = './waiting-room.html';
        return;
    }
    let speaking = false;
    let stoppingSpeaking = false;
    let fallbackTimer = null;
    let realtimeConnected = false;
    let timerInterval = null;
    let timerBootstrapTimeout = null;
    let resultRedirectTimer = null;
    let resultRedirected = false;
    let activeSpeakers = {};
    let aiGuideBubbleTimer = null;
    let summaryPromptRequested = false;
    let sessionFinished = false;
    let aiCompanionMood = 'idle';
    let sessionDurationSeconds = 0;
    var speakingTimeline = [];
    var speakingStartTimes = {};
    var speakCountMap = {};
    var raceCoinMilestones = {};
    var avatarPool = [
        '../assets/images/icons/bat.svg',
        '../assets/images/icons/bird.svg',
        '../assets/images/icons/drawing.svg',
        '../assets/images/icons/fox.svg',
        '../assets/images/icons/giraffe.svg',
        '../assets/images/icons/kitty.svg'
    ];
    var groupAvatarAssignments = {};

    qs('#groupName').textContent = group.groupName;
    qs('#sessionIdText').textContent = group.sessionId || '-';
    qs('#sessionStatusText').textContent = 'Waiting';
    storage.remove('manualDiscussionReturn');
    syncGroupAvatarAssignments(group.members || []);
    renderMembers(group.members || []);
    renderRanking(group.members || []);
    renderRaceTrack(group.members || []);
    initTimer(group.sessionId);
    updateAiCompanion('idle', 'Ask for a prompt when the discussion slows down, or keep speaking to energise the room.');

    qs('#backToWaitingButton').addEventListener('click', function () {
        storage.set('manualDiscussionReturn', true);
        window.location.href = './waiting-room.html';
    });

    function loadSpeakingLog() {
        var btn = qs('#refreshLogButton');
        if (btn) btn.disabled = true;
        return apiRequest('/students/speaking-log?sessionId=' + group.sessionId).then(function (logs) {
            speakingTimeline = [];
            speakCountMap = {};
            if (Array.isArray(logs)) {
                logs.forEach(function (log) {
                    var uid = log.userId;
                    speakCountMap[uid] = (speakCountMap[uid] || 0) + 1;
                    speakingTimeline.push({
                        userId: uid,
                        name: log.userName || '',
                        duration: log.durationSeconds || 0,
                        time: new Date(log.startTime)
                    });
                });
            }
            renderTimeline();
            renderMembers(group.members || []);
        }).catch(function () {}).finally(function () {
            if (btn) btn.disabled = false;
        });
    }

    loadSpeakingLog();

    qs('#refreshLogButton').addEventListener('click', loadSpeakingLog);
    qs('#viewAllSpeakingLogsBtn').addEventListener('click', function () {
        renderAllSpeakingLogs();
        qs('#allSpeakingLogsOverlay').style.display = 'flex';
    });
    qs('#closeAllSpeakingLogsBtn').addEventListener('click', function () {
        qs('#allSpeakingLogsOverlay').style.display = 'none';
    });
    qs('#allSpeakingLogsOverlay').addEventListener('click', function (event) {
        if (event.target === qs('#allSpeakingLogsOverlay')) {
            qs('#allSpeakingLogsOverlay').style.display = 'none';
        }
    });

    connectDiscussionSocket(group.sessionId, function (message) {
        if (message.type === 'SESSION_ENDED') {
            setSessionEndedUi();
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            showNotification('Session Ended', 'The discussion has ended. Redirecting to results...', true);
            return;
        }
        if (message.groupId !== group.groupId) {
            return;
        }
        if (message.ranking) {
            const ranking = message.ranking.map(function (item) {
                return { userId: item.userId, name: item.name, score: item.score };
            });
            renderRanking(ranking);
            mergeScores(group.members, ranking);
            renderMembers(group.members || []);
            restoreSpeakingHighlights();
            storage.set('currentGroup', group);
        }
        if (message.payload && message.payload.userId) {
            var uid = message.payload.userId;
            var isSpeaking = !!message.payload.speaking;
            activeSpeakers[uid] = isSpeaking;
            highlightSpeaker(uid, isSpeaking);
            if (isSpeaking) {
                speakingStartTimes[uid] = Date.now();
            } else {
                var start = speakingStartTimes[uid];
                if (start) {
                    delete speakingStartTimes[uid];
                    var dur = Math.max(1, Math.round((Date.now() - start) / 1000));
                    speakCountMap[uid] = (speakCountMap[uid] || 0) + 1;
                    speakingTimeline.push({
                        userId: uid,
                        name: message.payload.userName || '',
                        duration: dur,
                        time: new Date()
                    });
                    renderTimeline();
                    renderMembers(group.members || []);
                }
            }
        }
        if (message.type === 'AI_GUIDE' && message.payload && message.payload.content) {
            showAiGuideBubble(message.payload.content);
        }
    }, {
        onOpen: function () {
            realtimeConnected = true;
            stopFallbackPolling();
            qs('#message').textContent = '';
        },
        onError: function () {
            realtimeConnected = false;
            startFallbackPolling();
            showMessage(qs('#message'), 'Realtime connection is unstable. Fallback polling is active.', true, true);
        },
        onClose: function () {
            realtimeConnected = false;
            startFallbackPolling();
            showMessage(qs('#message'), 'Realtime connection lost. Fallback polling is active.', true, true);
        }
    });

    qs('#speakButton').addEventListener('mousedown', startSpeaking);
    qs('#speakButton').addEventListener('mouseup', stopSpeaking);
    qs('#speakButton').addEventListener('touchstart', startSpeaking);
    qs('#speakButton').addEventListener('touchend', stopSpeaking);
    var noop = { preventDefault: function(){} };
    document.addEventListener('mouseup', function () { if (speaking && voiceStartTime && (Date.now() - voiceStartTime > 200)) stopSpeaking(noop); });
    document.addEventListener('touchend', function () { if (speaking && voiceStartTime && (Date.now() - voiceStartTime > 200)) stopSpeaking(noop); });

    qs('#aiGuideButton').addEventListener('click', async function () {
        if (sessionFinished) {
            showMessage(qs('#message'), 'This discussion has already ended.', true);
            return;
        }
        try {
            const guide = await apiRequest('/students/ai-guide?sessionId=' + group.sessionId + '&groupId=' + group.groupId + '&triggerType=GROUP_SILENT');
            if (sessionFinished) {
                return;
            }
            showAiGuideBubble(guide.content);
        } catch (error) {
            showMessage(qs('#message'), error.message, true);
        }
    });

    async function requestSummaryGuide() {
        if (summaryPromptRequested) {
            return;
        }
        summaryPromptRequested = true;
        try {
            const guide = await apiRequest('/students/ai-guide?sessionId=' + group.sessionId + '&groupId=' + group.groupId + '&triggerType=SUMMARY');
            if (sessionFinished) {
                return;
            }
            showNotification('Discussion Wrapping Up', guide.content || 'Please summarize your key points.', false);
        } catch (error) {
            summaryPromptRequested = false;
            showMessage(qs('#message'), error.message, true);
        }
    }

    window.addEventListener('beforeunload', function () {
        stopFallbackPolling();
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        if (timerBootstrapTimeout) {
            clearTimeout(timerBootstrapTimeout);
        }
        if (resultRedirectTimer) {
            clearTimeout(resultRedirectTimer);
        }
        if (aiGuideBubbleTimer) {
            clearTimeout(aiGuideBubbleTimer);
        }
        disconnectDiscussionSocket();
    });

    function showAiGuideBubble(content) {
        if (sessionFinished) {
            return;
        }
        updateAiCompanion('guiding', content || 'Fresh guidance is ready for your team.');
        qs('#aiGuideContent').textContent = content;
        qs('#aiGuideBubble').style.display = 'block';
        if (aiGuideBubbleTimer) {
            clearTimeout(aiGuideBubbleTimer);
        }
        aiGuideBubbleTimer = setTimeout(function () {
            qs('#aiGuideBubble').style.display = 'none';
            aiGuideBubbleTimer = null;
            if (!sessionFinished) {
                updateAiCompanion('idle', 'I am hovering nearby if your group needs another nudge.');
            }
        }, 10000);
    }

    function updateAiCompanion(state, hint) {
        aiCompanionMood = state || 'idle';
        var moodNode = qs('#aiCompanionMood');
        var hintNode = qs('#aiCompanionHint');
        var dotNode = qs('#aiStatusDot');
        var panelNode = document.querySelector('.ai-companion-panel');
        if (!moodNode || !hintNode || !dotNode || !panelNode) {
            return;
        }
        var labels = {
            idle: 'Ready to cheer your team on.',
            listening: 'Listening to the room in real time.',
            guiding: 'Sharing a new idea spark.',
            ending: 'Wrapping up and preparing the final takeaway.'
        };
        moodNode.textContent = labels[aiCompanionMood] || labels.idle;
        hintNode.textContent = hint || 'Ask for a prompt when the discussion slows down, or keep speaking to energise the room.';
        panelNode.setAttribute('data-mood', aiCompanionMood);
        dotNode.className = 'ai-status-dot ai-status-' + aiCompanionMood;
    }

    function createStableSeed() {
        return [group.sessionId || '', group.groupId || '', group.groupName || ''].join('|');
    }

    function hashString(value) {
        var input = String(value || '');
        var hash = 0;
        for (var i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function syncGroupAvatarAssignments(members) {
        var normalizedMembers = (members || []).filter(function (member) {
            return member && member.userId != null;
        }).slice().sort(function (a, b) {
            if (a.userId !== b.userId) {
                return Number(a.userId) - Number(b.userId);
            }
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        var avatarOrder = avatarPool.slice().sort(function (a, b) {
            return hashString(createStableSeed() + '|' + a) - hashString(createStableSeed() + '|' + b);
        });

        groupAvatarAssignments = {};
        normalizedMembers.forEach(function (member, index) {
            groupAvatarAssignments[String(member.userId)] = avatarOrder[index % avatarOrder.length];
        });
    }

    function resolveAvatarIndex(userId, name) {
        if (typeof userId === 'number' && !isNaN(userId)) {
            return Math.abs(userId) % avatarPool.length;
        }

        let seed = 0;
        const str = String(name || 'user');
        for (let i = 0; i < str.length; i++) {
            seed = (seed << 5) - seed + str.charCodeAt(i);
            seed |= 0;
        }
        return Math.abs(seed) % avatarPool.length;
    }

    function getAssignedAvatarSrc(userId, name) {
        var key = userId != null ? String(userId) : '';
        if (key && groupAvatarAssignments[key]) {
            return groupAvatarAssignments[key];
        }
        return avatarPool[resolveAvatarIndex(userId, name)];
    }

    function buildAvatarHtml(userId, name, personality, sizePx) {
        var avatarSrc = getAssignedAvatarSrc(userId, name);
        var cls = 'avatar-badge avatar-animal';
        if (personality) {
            cls += ' personality-' + String(personality).toLowerCase();
        }
        return '<span class="' + cls + '" style="width:' + sizePx + 'px;height:' + sizePx + 'px;"><img src="' + avatarSrc + '" alt="avatar"></span>';
    }

    function buildCharacterAvatarHtml(userId, name, personality) {
        var avatarSrc = getAssignedAvatarSrc(userId, name);
        var cls = 'member-character';
        if (personality) {
            cls += ' personality-' + String(personality).toLowerCase();
        }
        return '<div class="' + cls + '">' +
            '<div class="member-character-glow"></div>' +
            '<img src="../assets/images/playful/star.svg" alt="" class="member-character-star">' +
            '<img src="' + avatarSrc + '" alt="avatar" class="member-character-image">' +
            '</div>';
    }

    var voiceTimerInterval = null;
    var voiceStartTime = null;

    function showVoiceOverlay() {
        voiceStartTime = Date.now();
        qs('#voiceTimer').textContent = '0:00';
        qs('#voiceOverlay').style.display = 'flex';
        qs('#speakButton').classList.add('active');
        voiceTimerInterval = setInterval(function () {
            var elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
            var m = Math.floor(elapsed / 60);
            var s = elapsed % 60;
            qs('#voiceTimer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
        }, 200);
    }

    function hideVoiceOverlay() {
        qs('#voiceOverlay').style.display = 'none';
        qs('#speakButton').classList.remove('active');
        if (voiceTimerInterval) {
            clearInterval(voiceTimerInterval);
            voiceTimerInterval = null;
        }
        voiceStartTime = null;
    }

    function setSessionEndedUi() {
        sessionFinished = true;
        speaking = false;
        stoppingSpeaking = false;
        hideVoiceOverlay();
        updateAiCompanion('ending', 'The session has ended. You can stay briefly or head to the result page.');
        qs('#sessionStatusText').textContent = 'Ended';
        qs('#timerBar').style.display = 'block';
        qs('#timerText').textContent = 'Ended';
        qs('#timerProgress').style.width = '100%';
        qs('#timerProgress').className = 'progress-bar';
        qs('#timerProgress').style.backgroundColor = 'var(--emerald-500)';
        qs('#speakButton').disabled = true;
        qs('#speakButton').classList.remove('active');
        qs('#speakButton').style.opacity = '0.55';
        qs('#speakButton').style.cursor = 'not-allowed';
        qs('#aiGuideButton').disabled = true;
        qs('#aiGuideButton').style.opacity = '0.55';
        qs('#aiGuideButton').style.cursor = 'not-allowed';
        qs('#aiGuideBubble').style.display = 'none';
        if (aiGuideBubbleTimer) {
            clearTimeout(aiGuideBubbleTimer);
            aiGuideBubbleTimer = null;
        }
    }

    async function refreshGroupState() {
        const latestGroup = await apiRequest('/students/group?sessionId=' + group.sessionId);
        group.members = latestGroup.members || [];
        group.groupId = latestGroup.groupId;
        group.groupName = latestGroup.groupName;
        group.sessionId = latestGroup.sessionId || group.sessionId;
        qs('#groupName').textContent = group.groupName;
        syncGroupAvatarAssignments(group.members || []);
        const latestRanking = (group.members || []).slice().sort(function (a, b) {
            return (b.score || 0) - (a.score || 0);
        });
        renderMembers(group.members || []);
        renderRanking(latestRanking);
        restoreSpeakingHighlights();
        storage.set('currentGroup', group);
    }

    async function startSpeaking(event) {
        event.preventDefault();
        if (speaking || sessionFinished) {
            return;
        }
        speaking = true;
        updateAiCompanion('listening', 'Nice, the floor is active. Keep your idea clear and concise.');
        showVoiceOverlay();
        try {
            await apiRequest('/students/speaking/start', {
                method: 'POST',
                body: JSON.stringify({ sessionId: group.sessionId })
            });
        } catch (error) {
            speaking = false;
            hideVoiceOverlay();
            updateAiCompanion('idle', 'I am still here if you want another prompt.');
            showMessage(qs('#message'), error.message, true);
        }
    }

    async function stopSpeaking(event) {
        event.preventDefault();
        if (!speaking || stoppingSpeaking) {
            return;
        }
        stoppingSpeaking = true;
        hideVoiceOverlay();
        try {
            await apiRequest('/students/speaking/stop', {
                method: 'POST',
                body: JSON.stringify({ sessionId: group.sessionId })
            });
            speaking = false;
            if (!sessionFinished) {
                updateAiCompanion('idle', 'Great turn. Another teammate can jump in now.');
            }
            await Promise.allSettled([refreshGroupState(), loadSpeakingLog()]);
        } catch (error) {
            speaking = false;
            updateAiCompanion('idle', 'I am still here if you want another prompt.');
            showMessage(qs('#message'), error.message, true);
        } finally {
            stoppingSpeaking = false;
        }
    }

    function renderMembers(members) {
        const container = qs('#memberList');
        syncGroupAvatarAssignments(members || []);
        const totalScore = members.reduce(function (sum, member) { return sum + (member.score || 0); }, 0) || 1;
        container.innerHTML = members.map(function (member) {
            const score = member.score || 0;
            const width = Math.min(100, Math.round((score / totalScore) * 100));
            const memberName = escapeText(member.name || '');
            const memberPersonality = escapeText(member.personality || '-');
            const turns = speakCountMap[member.userId] || 0;
            const turnsHtml = turns > 0 ? '<span class="mini-chip muted">' + turns + ' turn' + (turns > 1 ? 's' : '') + '</span>' : '';
            const tagHtml = '<div class="member-badges">' +
                '<span class="mini-chip">' + memberPersonality + '</span>' +
                turnsHtml +
                '</div>';

            return '<div class="member-card" data-user-id="' + member.userId + '">' +
                '<div class="avatar-line">' +
                buildAvatarHtml(member.userId, member.name, member.personality, 42) +
                '<div class="member-name">' +
                '<span style="font-size:15px;color:var(--text-1);font-weight:800;">' + memberName + '</span>' +
                tagHtml +
                '</div>' +
                '</div>' +
                '<div class="row" style="justify-content:space-between;align-items:center;gap:8px;margin-top:auto;">' +
                '<div class="progress" style="flex:1;height:6px;"><div class="progress-bar" style="width:' + width + '%;border-radius:3px;"></div></div>' +
                '<span style="font-size:13px;font-weight:600;color:var(--blue-600);white-space:nowrap;">' + score + 's</span>' +
                '</div>' +
                '</div>';
        }).join('');
        applyStagger(container);
        renderRaceTrack(members || []);
    }
    function renderTimeline() {
        var container = qs('#speakingTimeline');
        if (!container) return;
        syncGroupAvatarAssignments(group.members || []);
        if (!speakingTimeline.length) {
            container.innerHTML = '<div class="panel-empty">No speaking events yet.</div>';
            qs('#speakingLogMeta').textContent = '';
            qs('#viewAllSpeakingLogsBtn').style.display = 'none';
            return;
        }
        var totalTurns = speakingTimeline.length;
        qs('#speakingLogMeta').textContent = totalTurns + ' turn' + (totalTurns > 1 ? 's' : '');
        var recent = speakingTimeline.slice().reverse();
        var preview = recent.slice(0, 2);
        container.innerHTML = renderTimelineRows(preview);
        qs('#viewAllSpeakingLogsBtn').style.display = recent.length > preview.length ? 'inline-flex' : 'none';
    }

    function renderAllSpeakingLogs() {
        var container = qs('#allSpeakingLogsList');
        if (!container) return;
        var recent = speakingTimeline.slice().reverse();
        container.innerHTML = recent.length ? renderTimelineRows(recent) : '<div class="panel-empty">No speaking events yet.</div>';
    }

    function renderTimelineRows(entries) {
        return entries.map(function (entry) {
            var h = entry.time.getHours().toString().padStart(2, '0');
            var m = entry.time.getMinutes().toString().padStart(2, '0');
            var s = entry.time.getSeconds().toString().padStart(2, '0');
            return '<div class="timeline-row">' +
                buildAvatarHtml(entry.userId, entry.name, null, 28) +
                '<div style="min-width:0;">' +
                '<div class="timeline-name">' + escapeText(entry.name) + '</div>' +
                '<div class="timeline-meta">' + entry.duration + 's speaking time</div>' +
                '</div>' +
                '<span class="timeline-time">' + h + ':' + m + ':' + s + '</span>' +
                '</div>';
        }).join('');
    }
    function renderRanking(ranking) {
        const container = qs('#rankingList');
        container.innerHTML = ranking.map(function (member, index) {
            var medal = index < 3 ? ['1', '2', '3'][index] : (index + 1);
            return '<div class="leaderboard-row">' +
                '<div class="leaderboard-rank">' + medal + '</div>' +
                buildAvatarHtml(member.userId, member.name, null, 34) +
                '<div class="leaderboard-copy">' +
                '<div class="leaderboard-name">' + escapeText(member.name || '') + '</div>' +
                '<div class="leaderboard-score">' + (member.score || 0) + ' seconds total</div>' +
                '</div>' +
                '</div>';
        }).join('');
        applyStagger(container);
    }

    function renderRaceTrack(members) {
        var container = qs('#raceTrackBoard');
        if (!container) {
            return;
        }
        var safeMembers = (members || []).slice().sort(function (a, b) {
            return (b.score || 0) - (a.score || 0);
        });
        var totalDuration = sessionDurationSeconds || 1;
        if (!safeMembers.length) {
            container.innerHTML = '<div class="panel-empty">No racers yet.</div>';
            updateCurrentRaceCoins([], totalDuration);
            return;
        }
        var pendingCoinPopups = [];
        container.innerHTML = safeMembers.map(function (member) {
            var score = member.score || 0;
            var progress = Math.max(2, Math.min(100, Math.round((score / totalDuration) * 1000) / 10));
            var coins = calculateRaceCoins(progress);
            var flagCount = calculatePassedFlagCount(progress);
            var previousFlagCount = raceCoinMilestones[member.userId];
            if (previousFlagCount === undefined) {
                raceCoinMilestones[member.userId] = flagCount;
            } else if (flagCount > previousFlagCount) {
                for (var flagIndex = previousFlagCount + 1; flagIndex <= flagCount; flagIndex++) {
                    pendingCoinPopups.push({
                        userId: member.userId,
                        checkpoint: [20, 40, 60, 80][flagIndex - 1]
                    });
                }
                raceCoinMilestones[member.userId] = flagCount;
            } else if (flagCount < previousFlagCount) {
                raceCoinMilestones[member.userId] = flagCount;
            }
            return '<div class="race-row" data-user-id="' + member.userId + '">' +
                '<div class="race-runner-meta">' +
                buildAvatarHtml(member.userId, member.name, member.personality, 34) +
                '<div class="race-runner-copy">' +
                '<div class="race-runner-name">' + escapeText(member.name || '') + '</div>' +
                '<div class="race-runner-score">' + score + 's / ' + totalDuration + 's</div>' +
                '</div>' +
                '<div class="race-coin-badge" title="Coins earned from flags"><img src="../assets/images/playful/star-coin.png" alt=""> ' + coins + '</div>' +
                '</div>' +
                '<div class="race-lane">' +
                '<div class="race-lane-line"></div>' +
                '<div class="race-lane-fill" style="width:' + progress + '%;"></div>' +
                '<span class="race-flag-marker race-flag-20"><img src="../assets/images/playful/flag.svg" alt=""></span>' +
                '<span class="race-flag-marker race-flag-40"><img src="../assets/images/playful/flag.svg" alt=""></span>' +
                '<span class="race-gold-marker"><img src="../assets/images/playful/gold-ingots.svg" alt=""></span>' +
                '<span class="race-flag-marker race-flag-60"><img src="../assets/images/playful/flag.svg" alt=""></span>' +
                '<span class="race-flag-marker race-flag-80"><img src="../assets/images/playful/flag.svg" alt=""></span>' +
                '<span class="race-success-marker"><img src="../assets/images/playful/success.svg" alt=""></span>' +
                '<span class="race-firework-marker"><img src="../assets/images/playful/firework.svg" alt=""></span>' +
                '<span class="race-treasure-marker"><img src="../assets/images/playful/treasure-chest.svg" alt=""></span>' +
                '<div class="race-runner" style="left:calc(' + progress + '% - 22px);">' +
                buildCharacterAvatarHtml(member.userId, member.name, member.personality) +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');
        showRaceCoinPopups(pendingCoinPopups);
        updateCurrentRaceCoins(safeMembers, totalDuration);
    }

    function calculateRaceCoins(progress) {
        return calculatePassedFlagCount(progress) * 10;
    }

    function calculatePassedFlagCount(progress) {
        return [20, 40, 60, 80].filter(function (checkpoint) {
            return progress >= checkpoint;
        }).length;
    }

    function showRaceCoinPopups(popups) {
        (popups || []).forEach(function (popup) {
            var row = document.querySelector('.race-row[data-user-id="' + popup.userId + '"]');
            var lane = row ? row.querySelector('.race-lane') : null;
            if (!lane) {
                return;
            }
            var node = document.createElement('div');
            node.className = 'race-coin-popup';
            node.style.left = popup.checkpoint + '%';
            node.innerHTML = '<img src="../assets/images/playful/coin.png" alt=""> <span>+10</span>';
            lane.appendChild(node);
            window.setTimeout(function () {
                node.remove();
            }, 1300);
        });
    }

    function updateCurrentRaceCoins(members, totalDuration) {
        var coinNode = qs('#raceCurrentCoins');
        if (!coinNode) {
            return;
        }
        var current = (members || []).find(function (member) {
            return Number(member.userId) === Number(user.id);
        });
        var score = current ? (current.score || 0) : 0;
        var progress = Math.max(0, Math.min(100, Math.round((score / (totalDuration || 1)) * 1000) / 10));
        coinNode.querySelector('span').textContent = calculateRaceCoins(progress);
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

    function restoreSpeakingHighlights() {
        Object.keys(activeSpeakers).forEach(function (userId) {
            if (activeSpeakers[userId]) {
                highlightSpeaker(Number(userId), true);
            }
        });
    }

    function highlightSpeaker(userId, speaking) {
        var nodes = document.querySelectorAll('[data-user-id="' + userId + '"]');
        if (!nodes.length) {
            return;
        }
        nodes.forEach(function (node) {
            node.classList.toggle('speaking', speaking);
        });
        if (speaking) {
            updateAiCompanion('listening', 'A teammate is speaking now. Watch the race track update in real time.');
        } else if (!sessionFinished && !Object.keys(activeSpeakers).some(function (id) { return activeSpeakers[id]; })) {
            updateAiCompanion('idle', 'The room is calm again. Invite another voice or ask AI for help.');
        }
    }

    function mergeScores(members, ranking) {
        members.forEach(function (member) {
            const matched = ranking.find(function (item) {
                return item.userId === member.userId;
            });
            if (matched) {
                member.score = matched.score;
            }
        });
    }

    function startFallbackPolling() {
        if (fallbackTimer) {
            return;
        }
        fallbackTimer = setInterval(async function () {
            if (realtimeConnected) {
                stopFallbackPolling();
                return;
            }
            try {
                const latestGroup = await apiRequest('/students/group?sessionId=' + group.sessionId);
                group.members = latestGroup.members || [];
                group.groupId = latestGroup.groupId;
                group.groupName = latestGroup.groupName;
                group.sessionId = latestGroup.sessionId || group.sessionId;
                syncGroupAvatarAssignments(group.members || []);
                var fallbackRanking = (group.members || []).slice().sort(function (a, b) {
                    return (b.score || 0) - (a.score || 0);
                });
                renderMembers(group.members || []);
                renderRanking(fallbackRanking);
                storage.set('currentGroup', group);
            } catch (error) {
                console.warn('fallback group poll failed', error);
            }
            try {
                const latestSession = await apiRequest('/sessions/' + group.sessionId);
                if (latestSession.status === 'ENDED') {
                    stopFallbackPolling();
                    setSessionEndedUi();
                    showNotification('Session Ended', 'The discussion has ended. Redirecting to results...', true);
                }
            } catch (error) {
                console.warn('fallback session poll failed', error);
            }
        }, 5000);
    }

    function stopFallbackPolling() {
        if (fallbackTimer) {
            clearInterval(fallbackTimer);
            fallbackTimer = null;
        }
    }

    function redirectToResult(delayMs) {
        if (resultRedirected || resultRedirectTimer) {
            return;
        }
        resultRedirectTimer = setTimeout(function () {
            resultRedirectTimer = null;
            resultRedirected = true;
            window.location.href = './session-result.html?sessionId=' + group.sessionId + '&from=discussion-room';
        }, delayMs || 0);
    }

    function initTimer(sessionId) {
        if (!sessionId) return;
        apiRequest('/sessions/' + sessionId).then(function (sessionData) {
            qs('#timerBar').style.display = 'block';
            qs('#sessionTopic').textContent = sessionData.topic || '';
            qs('#sessionStatusText').textContent = sessionData.status || 'Waiting';
            
            if (sessionData.status === 'ENDED') {
                setSessionEndedUi();
                return;
            }
            if (sessionData.status !== 'RUNNING') {
                timerBootstrapTimeout = setTimeout(function () {
                    initTimer(sessionId);
                }, 3000);
                return;
            }
            var start = new Date(sessionData.startedAt);
            sessionDurationSeconds = Math.max(1, (sessionData.durationMinutes || 0) * 60);
            renderRaceTrack(group.members || []);
            var expectedEnd = new Date(start.getTime() + (sessionData.durationMinutes * 60000));
            var totalMs = expectedEnd - start;

            timerInterval = setInterval(function () {
                if (sessionFinished) {
                    clearInterval(timerInterval);
                    return;
                }
                var now = new Date();
                var remaining = expectedEnd - now;
                var passed = now - start;
                var progress = Math.min(100, Math.round((passed / totalMs) * 1000) / 10);
                
                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    setSessionEndedUi();
                    showNotification('Time\'s Up', 'The discussion time has ended. Redirecting to results...', true);
                    return;
                }
                var minutes = Math.floor(remaining / 60000);
                var seconds = Math.floor((remaining % 60000) / 1000);
                
                const pBar = qs('#timerProgress');
                if (remaining < 60000) {
                    pBar.className = 'progress-bar warning-flash';
                    pBar.style.backgroundColor = 'var(--red-500)';
                } else if (progress > 50) {
                    pBar.className = 'progress-bar';
                    pBar.style.backgroundColor = 'var(--emerald-500)';
                } else {
                    pBar.className = 'progress-bar';
                    pBar.style.backgroundColor = 'var(--blue-500)';
                }
                
                qs('#timerText').textContent = minutes + ':' + seconds.toString().padStart(2, '0');
                qs('#timerProgress').style.width = progress + '%';
                
                if (progress >= 80 && !summaryPromptRequested && !sessionFinished) {
                    requestSummaryGuide();
                }
            }, 100);
        }).catch(function (error) {
            console.error('Failed to init timer:', error);
            timerBootstrapTimeout = setTimeout(function () {
                initTimer(sessionId);
            }, 5000);
        });
    }

    var notificationTimer = null;

    function showNotification(title, body, redirect) {
        var overlay = qs('#notificationOverlay');
        var box = qs('#notificationBox');
        box.innerHTML = '';
        var titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        titleEl.textContent = title;
        var bodyEl = document.createElement('div');
        bodyEl.className = 'notification-body';
        bodyEl.textContent = body;
        box.appendChild(titleEl);
        box.appendChild(bodyEl);
        if (redirect) {
            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;justify-content:center;';
            var stayBtn = document.createElement('button');
            stayBtn.className = 'btn';
            stayBtn.textContent = 'Stay';
            stayBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                overlay.style.display = 'none';
            });
            var resultBtn = document.createElement('button');
            resultBtn.className = 'btn btn-outline';
            resultBtn.textContent = 'View Result';
            resultBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                redirectToResult(0);
            });
            btnRow.appendChild(stayBtn);
            btnRow.appendChild(resultBtn);
            box.appendChild(btnRow);
        } else {
            if (notificationTimer) {
                clearTimeout(notificationTimer);
            }
            overlay.addEventListener('click', function dismiss() {
                overlay.style.display = 'none';
                overlay.removeEventListener('click', dismiss);
                if (notificationTimer) {
                    clearTimeout(notificationTimer);
                    notificationTimer = null;
                }
            });
            notificationTimer = setTimeout(function () {
                overlay.style.display = 'none';
                notificationTimer = null;
            }, 8000);
        }
        overlay.style.display = 'flex';
    }

});
