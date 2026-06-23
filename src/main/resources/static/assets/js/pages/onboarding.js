document.addEventListener('DOMContentLoaded', function () {
    const user = requireCurrentUser();
    if (!user) {
        return;
    }
    if (user.personality) {
        window.location.href = './waiting-room.html';
        return;
    }
    const message = qs('#message');
    qs('#userName').textContent = user.name;
    qs('#personalityForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        try {
            const personality = qs('input[name="personality"]:checked');
            if (!personality) {
                throw new Error('Please select E or I');
            }
            const updatedUser = await apiRequest('/students/personality', {
                method: 'POST',
                body: JSON.stringify({
                    personality: personality.value
                })
            });
            saveCurrentUser(updatedUser);
            showMessage(message, 'Selection saved');
            setTimeout(function () {
                window.location.href = './waiting-room.html';
            }, 600);
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });
});
