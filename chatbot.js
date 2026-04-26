// chatbot.js
let conversationHistory = [];
let isLoading = false;
let chatWindow = null;
let chatInput = null;
let sendBtn = null;
let quickReplies = null;
let typingIndicator = null;
let currentUser = null;

const LOGIN_PAGE_URL = "login.html";
const CHAT_API_URL =
    typeof API_CONFIG !== "undefined" && API_CONFIG.BASE_URL
        ? `${API_CONFIG.BASE_URL}/chat`
        : "http://localhost:5000/api/chat";

document.addEventListener("DOMContentLoaded", async function () {
    chatWindow = document.getElementById("chat-window");
    chatInput = document.getElementById("user-chat-input");
    sendBtn = document.getElementById("send-btn");
    quickReplies = document.getElementById("quick-replies");
    typingIndicator = document.getElementById("typing-indicator");

    const clearBtn = document.getElementById("clear-btn");
    const infoBtn = document.getElementById("info-btn");

    if (clearBtn) clearBtn.addEventListener("click", clearChat);
    if (infoBtn) infoBtn.addEventListener("click", showInfoPopup);

    const user = await checkUserLogin();
    if (!user) return;

    loadChatHistory();
    setUserGreeting();

    if (chatInput) {
        chatInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                sendChat();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener("click", sendChat);
    }
});

async function checkUserLogin() {
    try {
        const savedUser = getStoredCurrentUser();

        if (savedUser && savedUser.email) {
            currentUser = savedUser;
            return currentUser;
        }

        const fallbackUser = getFallbackUserFromUsers();
        if (fallbackUser && fallbackUser.email) {
            currentUser = fallbackUser;
            localStorage.setItem("healingHub_currentUser", JSON.stringify(currentUser));
            return currentUser;
        }

        window.location.href = LOGIN_PAGE_URL;
        return null;
    } catch (error) {
        console.error("User session error:", error);
        window.location.href = LOGIN_PAGE_URL;
        return null;
    }
}

function getStoredCurrentUser() {
    try {
        const raw = localStorage.getItem("healingHub_currentUser");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.email) return null;
        return parsed;
    } catch (error) {
        return null;
    }
}

function getFallbackUserFromUsers() {
    try {
        const users = JSON.parse(localStorage.getItem("healingHub_users") || "[]");
        if (!Array.isArray(users) || !users.length) return null;
        return users[users.length - 1];
    } catch (error) {
        return null;
    }
}

function getCurrentUser() {
    return currentUser;
}

function getChatStorageKey() {
    const user = getCurrentUser();
    const email = user && user.email ? user.email.toLowerCase() : "guest";
    return `healingHub_chatHistory_${email}`;
}

async function sendChat() {
    if (!chatInput || !sendBtn) return;

    const message = chatInput.value.trim();
    if (!message || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;

    addUserMessage(message);
    chatInput.value = "";

    if (quickReplies) {
        quickReplies.classList.add("hidden");
    }

    showTypingIndicator();

    try {
        const reply = await getAIReplyFromBackend(message);
        removeTypingIndicator();
        addBotMessage(reply);
        saveChatHistory();
    } catch (error) {
        console.error("Chat error:", error);
        removeTypingIndicator();
        addBotMessage(`Chat error: ${error.message}`);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        if (chatInput) chatInput.focus();
    }
}

function sendQuickReply(message) {
    if (!chatInput) return;
    chatInput.value = message;
    sendChat();
}

async function getAIReplyFromBackend(message) {
    let response;

    try {
        response = await fetch(CHAT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                message,
                history: conversationHistory.slice(-8)
            })
        });
    } catch (networkError) {
        throw new Error("Could not connect to backend. Make sure server is running on port 5000.");
    }

    let data = null;

    try {
        data = await response.json();
    } catch (parseError) {
        throw new Error(`Backend returned invalid response (status ${response.status}).`);
    }

    if (!response.ok) {
        throw new Error(data?.message || `Backend error ${response.status}`);
    }

    if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("Backend did not return a valid reply.");
    }

    return data.reply.trim();
}

function addUserMessage(text, shouldStore = true, timestamp = null) {
    if (!chatWindow) return;

    const user = getCurrentUser();
    const userInitial =
        user && user.firstName ? user.firstName.charAt(0).toUpperCase() :
        user && user.name ? user.name.charAt(0).toUpperCase() :
        "U";

    const messageEl = document.createElement("div");
    messageEl.className = "chat-message user-message";
    messageEl.innerHTML = `
        <div class="message-avatar user-avatar">${userInitial}</div>
        <div class="message-bubble">
            <p>${escapeHtml(text)}</p>
            <span class="message-time">${formatMessageTime(timestamp)}</span>
        </div>
    `;

    chatWindow.appendChild(messageEl);
    scrollToBottom();

    if (shouldStore) {
        conversationHistory.push({
            role: "user",
            content: text,
            timestamp: timestamp || new Date().toISOString()
        });
    }
}

function addBotMessage(text, shouldStore = true, timestamp = null) {
    if (!chatWindow) return;

    const messageEl = document.createElement("div");
    messageEl.className = "chat-message bot-message";
    messageEl.innerHTML = `
        <div class="message-avatar bot-avatar">
            <i class="fas fa-heart"></i>
        </div>
        <div class="message-bubble">
            ${formatResponse(text)}
            <span class="message-time">${formatMessageTime(timestamp)}</span>
        </div>
    `;

    chatWindow.appendChild(messageEl);
    scrollToBottom();

    if (shouldStore) {
        conversationHistory.push({
            role: "assistant",
            content: text,
            timestamp: timestamp || new Date().toISOString()
        });
    }
}

function formatResponse(text) {
    const safeText = escapeHtml(text);
    const lines = safeText.split("\n").filter(line => line.trim());

    let html = "";
    let inList = false;

    lines.forEach(line => {
        const trimmed = line.trim();

        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
            if (!inList) {
                html += "<ul>";
                inList = true;
            }
            html += `<li>${trimmed.replace(/^[-•]\s*/, "")}</li>`;
        } else {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            html += `<p>${trimmed}</p>`;
        }
    });

    if (inList) html += "</ul>";

    return html || "<p>I’m here with you.</p>";
}

function showTypingIndicator() {
    if (!typingIndicator) return;
    typingIndicator.classList.remove("hidden");
    scrollToBottom();
}

function removeTypingIndicator() {
    if (!typingIndicator) return;
    typingIndicator.classList.add("hidden");
}

function scrollToBottom() {
    if (!chatWindow) return;
    setTimeout(() => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }, 50);
}

function setUserGreeting() {
    const sidebarName = document.getElementById("sidebar-name");
    if (!sidebarName) return;

    const user = getCurrentUser();
    const hour = new Date().getHours();

    let greeting = "Welcome";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";

    sidebarName.textContent = user && user.firstName ? `${greeting}, ${user.firstName}` : greeting;
}

function clearChat() {
    conversationHistory = [];
    localStorage.removeItem(getChatStorageKey());

    if (chatWindow) {
        chatWindow.innerHTML = `
            <div class="chat-message bot-message">
                <div class="message-avatar bot-avatar">
                    <i class="fas fa-heart"></i>
                </div>
                <div class="message-bubble">
                    <p>Hello! I’m your Healing Hub AI Assistant.</p>
                    <p class="sub-message">How are you feeling today?</p>
                    <span class="message-time">Just now</span>
                </div>
            </div>
        `;
    }

    if (quickReplies) {
        quickReplies.classList.remove("hidden");
    }
}

function saveChatHistory() {
    try {
        localStorage.setItem(getChatStorageKey(), JSON.stringify(conversationHistory));
    } catch (error) {
        console.warn("Could not save chat history", error);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(getChatStorageKey());
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        conversationHistory = parsed;

        if (chatWindow) {
            chatWindow.innerHTML = "";
        }

        conversationHistory.forEach(msg => {
            if (msg.role === "user") {
                addUserMessage(msg.content, false, msg.timestamp);
            } else if (msg.role === "assistant") {
                addBotMessage(msg.content, false, msg.timestamp);
            }
        });

        if (quickReplies) {
            quickReplies.classList.add("hidden");
        }
    } catch (error) {
        console.warn("Could not load chat history", error);
    }
}

function showInfoPopup() {
    if (typeof showPopup === "function") {
        showPopup({
            type: "info",
            title: "About Your AI Assistant",
            message: "This assistant offers emotional support, gentle coping ideas, and reflective conversation. It is not a replacement for a licensed mental health professional or emergency support.",
            buttons: [
                {
                    text: "Got it",
                    className: "primary",
                    onClick: function () {
                        if (typeof hidePopup === "function") hidePopup();
                    }
                }
            ]
        });
    } else {
        alert("This assistant offers supportive conversation and coping guidance, but it is not a substitute for professional help.");
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatMessageTime(timestamp) {
    if (!timestamp) return "Just now";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Just now";

    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function handleLogout() {
    if (typeof showConfirmPopup === "function") {
        showConfirmPopup({
            type: "warning",
            icon: "👋",
            title: "Logout from Healing Hub?",
            message: "You can come back anytime and continue your wellness journey.",
            confirmText: "Logout",
            cancelText: "Stay Here",
            onConfirm: async function () {
                try {
                    if (typeof logoutUser === "function") {
                        await logoutUser();
                    }
                } catch (error) {
                    console.error("Logout function error:", error);
                } finally {
                    localStorage.removeItem("healingHub_currentUser");
                    localStorage.removeItem("healingHub_token");
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("token");
                    window.location.href = LOGIN_PAGE_URL;
                }
            }
        });
        return;
    }

    try {
        if (typeof logoutUser === "function") {
            logoutUser();
        }
    } catch (error) {
        console.error("Logout function error:", error);
    } finally {
        localStorage.removeItem("healingHub_currentUser");
        localStorage.removeItem("healingHub_token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("token");
        window.location.href = LOGIN_PAGE_URL;
    }
}