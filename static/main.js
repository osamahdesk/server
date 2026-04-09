// ======================================
// RYOKU WEBSITE SCRIPTS
// ======================================

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initScrollAnimations();
    initTerminalMockup();
    initChat();
});

// --- Particles ---
function initParticles() {
    const container = document.getElementById('particles');
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        
        const size = Math.random() * 3 + 1;
        const left = Math.random() * 100;
        const delay = Math.random() * 15;
        const duration = Math.random() * 10 + 10;
        
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${left}vw`;
        p.style.animationDelay = `${delay}s`;
        p.style.animationDuration = `${duration}s`;
        
        if (Math.random() > 0.5) p.style.background = 'var(--gold)';
        
        container.appendChild(p);
    }
}

// --- Scroll Animations ---
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-up').forEach(el => {
        observer.observe(el);
    });
}

// --- Terminal Typing Mockup ---
function initTerminalMockup() {
    const lines = [
        { text: "ryoku-engine --init", type: "prompt" },
        { text: "[OK] Booting AI modules...", type: "output" },
        { text: "[OK] Loading LLM context...", type: "output" },
        { text: "[OK] System ready.", type: "output" },
        { text: "ryoku-planner --generate-goal 'Learn Python' --days 7", type: "prompt" },
        { text: "Analyzing difficulty: MEDIUM", type: "gold" },
        { text: "> Generating day-by-day JSON schedule...", type: "blue" },
        { text: "> Injecting practice challenges...", type: "blue" },
        { text: "SUCCESS: Plan saved. Run ryoku --start to begin.", type: "green" }
    ];

    const termBox = document.getElementById('term-typing');
    if (!termBox) return;

    let lineIdx = 0;
    
    async function typeLine() {
        if (lineIdx >= lines.length) {
            // Add blinking cursor
            const c = document.createElement('span');
            c.className = 't-cursor';
            termBox.appendChild(c);
            return;
        }

        const lineData = lines[lineIdx];
        const lineDiv = document.createElement('div');
        lineDiv.className = 't-line';

        if (lineData.type === 'prompt') {
            lineDiv.innerHTML = `<span class="t-prompt">➜  ~</span><span class="t-text"></span>`;
            termBox.appendChild(lineDiv);
            
            const textSpan = lineDiv.querySelector('.t-text');
            await typeText(textSpan, lineData.text, 30);
        } else {
            let colorClass = 't-output';
            if (lineData.type === 'gold') colorClass = 't-gold';
            if (lineData.type === 'blue') colorClass = 't-blue';
            if (lineData.type === 'green') colorClass = 't-prompt';
            
            lineDiv.innerHTML = `<span class="${colorClass}">${lineData.text}</span>`;
            termBox.appendChild(lineDiv);
            await new Promise(r => setTimeout(r, 400)); // Pause after output
        }

        lineIdx++;
        setTimeout(typeLine, 200);
    }

    function typeText(element, text, speed) {
        return new Promise(resolve => {
            let i = 0;
            element.textContent = '';
            function type() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    resolve();
                }
            }
            type();
        });
    }

    // Start typing after a short delay
    setTimeout(typeLine, 1000);
}

// --- Live AI Chat Script ---
// Let's connect this to the actual Render API
const API_URL = window.location.origin; // Will use same origin when hosted on Render
// Use hardcoded URL for local dev if needed: const API_URL = 'https://ryoku-tutor-api.onrender.com';

let currentMode = 'study';
const userId = 'web_guest_' + Math.floor(Math.random() * 10000);

const modeDetails = {
    'study': { name: 'Professor Ryoku', emoji: '📚' },
    'life': { name: 'Coach Ryoku', emoji: '🌟' },
    'fitness': { name: 'Trainer Ryoku', emoji: '💪' }
};

function initChat() {
    initGoalPlanner(); // Initialize Goal planner too

    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const buttons = document.querySelectorAll('.persona-btn');
    
    // Mode Switching
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentMode = btn.dataset.mode;
            document.getElementById('chat-title').innerText = modeDetails[currentMode].name;
            document.getElementById('chat-emoji').innerText = modeDetails[currentMode].emoji;
            
            addSystemMessage(`Persona switched to: ${modeDetails[currentMode].name}`);
        });
    });

    // Sending messages
    sendBtn.addEventListener('click', submitMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitMessage();
    });
}

// Support CSS for buttons
document.head.insertAdjacentHTML('beforeend', `
<style>
.persona-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    padding: 6px 12px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
}
.persona-btn:hover { border-color: var(--blue); color: var(--white); }
.persona-btn.active {
    background: rgba(59,130,246,0.15);
    border-color: var(--blue);
    color: var(--blue);
}
</style>
`);

// --- Generate Goal Sequence ---
function initGoalPlanner() {
    const btn = document.getElementById('goal-generate-btn');
    const output = document.getElementById('goal-output');
    
    if (!btn || !output) return;

    btn.addEventListener('click', async () => {
        const name = document.getElementById('goal-name').value;
        const days = document.getElementById('goal-days').value;
        const diff = document.getElementById('goal-diff').value;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GENERATING...';
        output.style.color = "var(--muted)";
        output.innerText = "// Connecting to Ryoku Engine...\n// Analyzing goal: " + name + "\n// This takes 5-15 seconds depending on LLM...";

        try {
            const response = await fetch('/RyokuOS', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    goal_name: name,
                    duration_days: parseInt(days) || 3,
                    difficulty: diff,
                    importance: "High",
                    details: "A quick demo generated via web."
                })
            });

            if (!response.ok) throw new Error("API failed");

            const data = await response.json();
            output.style.color = "var(--green)";
            output.innerText = JSON.stringify(data.plan, null, 2);

        } catch (err) {
            output.style.color = "var(--red)";
            output.innerText = "// ERROR: Could not generate plan. \n// Details: " + err.message;
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-bolt"></i> GENERATE PLAN';
    });
}

function sendQuick(text) {
    const input = document.getElementById('chat-input');
    input.value = text;
    // Highlight the input briefly
    input.style.borderColor = 'var(--gold)';
    setTimeout(() => input.style.borderColor = '', 500);
}

async function submitMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const text = input.value.trim();
    
    if (!text) return;
    
    input.value = '';
    sendBtn.disabled = true;
    
    appendMessage(text, 'user');
    showTyping();
    
    try {
        // We use relative path so it works when deployed via Render
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                new_message: text,
                mode: currentMode
            })
        });
        
        if (!response.ok) throw new Error('API Error');
        
        const data = await response.json();
        removeTyping();
        appendMessage(data.answer, 'ai');
        
    } catch (err) {
        removeTyping();
        appendMessage('⚠️ Network error. Unable to reach Ryoku. If you are testing locally, ensure the backend is running.', 'ai');
        console.error(err);
    }
    
    sendBtn.disabled = false;
    input.focus();
}

function appendMessage(text, sender) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `msg msg-${sender}`;
    
    const label = sender === 'user' ? 'YOU' : 'RYOKU';
    
    // Simple markdown formatting for bold/lists
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold)">$1</strong>')
        .replace(/\n/g, '<br>');

    div.innerHTML = `
        <div class="msg-label">${label}</div>
        <div class="msg-bubble">${formattedText}</div>
    `;
    
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function addSystemMessage(text) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.fontSize = '9px';
    div.style.color = 'var(--muted)';
    div.style.margin = '10px 0';
    div.style.fontFamily = "'Press Start 2P', monospace";
    div.innerText = \`--- \${text} ---\`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function showTyping() {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'typing-indicator msg msg-ai';
    div.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function removeTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
}

