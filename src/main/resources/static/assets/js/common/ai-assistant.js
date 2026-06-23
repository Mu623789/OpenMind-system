(function () {
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof getAccessToken !== 'function' || !getAccessToken()) {
            return;
        }

        var root = document.createElement('div');
        root.className = 'floating-ai';
        root.innerHTML =
            '<button id="floatingAiToggle" class="floating-ai-toggle" type="button" aria-label="Open AI assistant">' +
            '<img src="../assets/images/ai-assistant-robot.png" alt="AI assistant">' +
            '</button>' +
            '<div id="floatingAiPanel" class="floating-ai-panel" aria-live="polite">' +
            '<div class="floating-ai-head">' +
            '<div class="floating-ai-title"><img src="../assets/images/ai-assistant-robot.png" alt="">MEET OMI</div>' +
            '<button id="floatingAiClose" class="floating-ai-close" type="button" aria-label="Close AI assistant">x</button>' +
            '</div>' +
            '<div id="floatingAiMessages" class="floating-ai-messages">' +
            "<div class=\"floating-ai-message bot\">I'm Omi, your helper in OpenMind. I can stay with you while you explore sessions, groups, profiles, speaking logs, and results.</div>" +
            "<div class=\"floating-ai-message bot\">Ask me what to do next, where to find something, or how a page works.</div>" +
            '</div>' +
            '<form id="floatingAiForm" class="floating-ai-form">' +
            '<input id="floatingAiInput" class="floating-ai-input" maxlength="600" placeholder="Ask a question..." autocomplete="off">' +
            '<button class="floating-ai-send" type="submit">Send</button>' +
            '</form>' +
            '</div>';
        document.body.appendChild(root);

        var panel = qs('#floatingAiPanel');
        var toggle = qs('#floatingAiToggle');
        var close = qs('#floatingAiClose');
        var form = qs('#floatingAiForm');
        var input = qs('#floatingAiInput');
        var messages = qs('#floatingAiMessages');
        var dragState = null;
        var movedDuringDrag = false;
        var suppressNextClick = false;

        restorePosition();

        toggle.addEventListener('click', function () {
            if (suppressNextClick || movedDuringDrag) {
                suppressNextClick = false;
                movedDuringDrag = false;
                return;
            }
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                input.focus();
                updatePanelAlignment();
            }
        });

        toggle.addEventListener('pointerdown', function (event) {
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                rootX: root.getBoundingClientRect().left,
                rootY: root.getBoundingClientRect().top,
                dragging: false
            };
            toggle.setPointerCapture(event.pointerId);
        });

        toggle.addEventListener('pointermove', function (event) {
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }
            var dx = event.clientX - dragState.startX;
            var dy = event.clientY - dragState.startY;
            if (!dragState.dragging && Math.sqrt(dx * dx + dy * dy) < 6) {
                return;
            }
            dragState.dragging = true;
            movedDuringDrag = true;
            root.classList.add('dragging');
            var size = root.getBoundingClientRect();
            var nextX = clamp(dragState.rootX + dx, 8, window.innerWidth - size.width - 8);
            var nextY = clamp(dragState.rootY + dy, 8, window.innerHeight - size.height - 8);
            setPosition(nextX, nextY);
        });

        toggle.addEventListener('pointerup', finishDrag);
        toggle.addEventListener('pointercancel', finishDrag);

        close.addEventListener('click', function () {
            panel.classList.remove('open');
        });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            var text = input.value.trim();
            if (!text) {
                return;
            }
            input.value = '';
            appendMessage(text, 'user');
            var loading = appendMessage('Thinking...', 'bot loading');
            try {
                var result = await apiRequest('/ai/chat', {
                    method: 'POST',
                    body: JSON.stringify({
                        message: text,
                        page: document.title || window.location.pathname
                    })
                });
                loading.textContent = result.content || 'I could not find an answer right now.';
                loading.classList.remove('loading');
            } catch (error) {
                loading.textContent = error.message || 'AI assistant is unavailable right now.';
                loading.classList.remove('loading');
                loading.classList.add('error');
            }
            messages.scrollTop = messages.scrollHeight;
        });

        function appendMessage(text, type) {
            var node = document.createElement('div');
            node.className = 'floating-ai-message ' + type;
            node.textContent = text;
            messages.appendChild(node);
            messages.scrollTop = messages.scrollHeight;
            return node;
        }

        function finishDrag(event) {
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }
            if (dragState.dragging) {
                var rect = root.getBoundingClientRect();
                suppressNextClick = true;
                localStorage.setItem('openmindOmiPosition', JSON.stringify({
                    left: Math.round(rect.left),
                    top: Math.round(rect.top)
                }));
                setTimeout(function () {
                    suppressNextClick = false;
                    movedDuringDrag = false;
                }, 350);
            }
            root.classList.remove('dragging');
            dragState = null;
        }

        function restorePosition() {
            try {
                var raw = localStorage.getItem('openmindOmiPosition');
                if (!raw) {
                    updatePanelAlignment();
                    return;
                }
                var pos = JSON.parse(raw);
                var size = root.getBoundingClientRect();
                var left = clamp(Number(pos.left) || 22, 8, window.innerWidth - size.width - 8);
                var top = clamp(Number(pos.top) || 22, 8, window.innerHeight - size.height - 8);
                setPosition(left, top);
            } catch (error) {
                updatePanelAlignment();
            }
        }

        function setPosition(left, top) {
            root.style.left = left + 'px';
            root.style.top = top + 'px';
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            updatePanelAlignment();
        }

        function updatePanelAlignment() {
            var rect = root.getBoundingClientRect();
            root.classList.toggle('align-left', rect.left < 370);
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }
    });
})();
