// 替換為上課實際的術語清單 (Replace this with the actual terms from the class)
const dictionary = [
    { term: "LLM", meaning: "透過海量文本資料訓練出的 AI 模型，能夠理解並生成自然語言（例如 ChatGPT 就是基於大型語言模型）。" },
    { term: "Prompt Engineering", meaning: "設計與最佳化輸入給 AI 的指令（Prompt）的技術，用以引導 AI 產出更精確、符合預期的結果。" },
    { term: "Context Engineering", meaning: "在與 AI 互動時，精心設計並提供適當的背景資訊或上下文，讓 AI 能根據特定情境給出更切題的回答。" },
    { term: "RAG", meaning: "一種結合「資訊檢索」與「AI 文本生成」的技術。系統會先從外部資料庫找出相關資訊，再交由 AI 生成回答，能大幅減少 AI 胡說八道的機率。" },
    { term: "Fine Tuning", meaning: "在一個已具備基礎能力的 AI 模型上，使用特定領域（如醫療、法律）的資料進行進一步訓練，使其在該特定任務上表現得更專業。" },
    { term: "MCP", meaning: "一種標準化介面，旨在讓 AI 模型能夠安全、一致地連接並存取外部的資料來源與工具。" },
    { term: "Pre Training", meaning: "AI 模型訓練的第一階段。在這個階段，工程師會使用海量且未標註的資料，讓模型學習語言的基礎邏輯、文法和廣泛的世界知識。" },
    { term: "Harness Engineering", meaning: "建構自動化測試環境或評估框架的工程技術，用來系統化地衡量、測試和驗證 AI 模型的效能與準確性。" },
    { term: "Reinforcement Learning", meaning: "一種機器學習方法，讓 AI 透過在環境中不斷「試錯」，並根據得到的「獎勵」或「懲罰」來調整行為策略，最終學會如何達成目標。" },
    { term: "Agent", meaning: "具備高度自主性的 AI 系統。它不僅能對話，還能理解目標、拆解任務，並自行呼叫外部工具（如搜尋網路、執行程式碼）來自動完成複雜的工作。" },
    { term: "SKILLS", meaning: "AI Agent 為了完成自主任務所配備的具體工具與能力，例如上網搜尋、執行程式碼或呼叫外部 API 等操作權限。" }
];

// 遊戲狀態變數
let gameTerms = [];
let currentQuestion = null;
let playerScore = 0;
let aiScore = 0;
let roundCount = 0;
const MAX_ROUNDS = 10;
const ROUND_TIME = 15; // 15秒

let timerInterval;
let timeLeft = ROUND_TIME;
let isTyping = false;
let typeInterval;
let aiTimeout;

// DOM Elements
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const ui = {
    playerScore: document.getElementById('player-score'),
    aiScore: document.getElementById('ai-score'),
    timerFill: document.getElementById('timer-fill'),
    meaningDisplay: document.getElementById('meaning-display'),
    cardContainerTop: document.getElementById('card-container-top'),
    cardContainerBottom: document.getElementById('card-container-bottom'),
    finalScore: document.getElementById('final-score'),
    aiResult: document.getElementById('ai-result'),
    aiStats: document.getElementById('ai-stats'),
    voiceEnable: document.getElementById('voice-enable'),
    aiOpponent: document.getElementById('ai-opponent'),
    feedbackOverlay: document.getElementById('feedback-overlay'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackTerm: document.getElementById('feedback-term'),
    feedbackMeaning: document.getElementById('feedback-meaning'),
    btnNext: document.getElementById('btn-next')
};

const synth = window.speechSynthesis;
let utterance = null;

// 初始化
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', resetToStart);
document.getElementById('btn-next').addEventListener('click', () => {
    ui.feedbackOverlay.classList.add('hidden');
    nextRound();
});

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function startGame() {
    playerScore = 0;
    aiScore = 0;
    roundCount = 0;
    updateScores();
    
    if (ui.aiOpponent.checked) {
        ui.aiStats.style.display = 'flex';
    } else {
        ui.aiStats.style.display = 'none';
    }

    // 複製並洗牌題庫
    gameTerms = [...dictionary].sort(() => 0.5 - Math.random());
    
    switchScreen('game');
    nextRound();
}

function nextRound() {
    if (roundCount >= MAX_ROUNDS || gameTerms.length === 0) {
        endGame();
        return;
    }
    
    roundCount++;
    clearTimeout(aiTimeout);
    clearInterval(timerInterval);
    clearInterval(typeInterval);
    if(synth.speaking) synth.cancel();

    // 取出目前的題目
    currentQuestion = gameTerms.pop();
    
    // 準備選項 (1個正確 + 5個錯誤)
    let options = [currentQuestion];
    let pool = dictionary.filter(item => item.term !== currentQuestion.term);
    pool.sort(() => 0.5 - Math.random());
    
    for(let i=0; i<5 && i<pool.length; i++) {
        options.push(pool[i]);
    }
    
    // 洗牌選項
    options.sort(() => 0.5 - Math.random());
    
    renderCards(options);
    
    // 顯示題目 (打字機效果)
    ui.meaningDisplay.innerHTML = "";
    typeWriter(currentQuestion.meaning);
    
    // 語音朗讀
    if (ui.voiceEnable.checked) {
        speakText(currentQuestion.meaning);
    }
    
    // 開始計時
    startTimer();
    
    // AI 對手邏輯
    if (ui.aiOpponent.checked) {
        startAILogic();
    }
}

function renderCards(options) {
    ui.cardContainerTop.innerHTML = '';
    ui.cardContainerBottom.innerHTML = '';
    
    options.forEach((opt, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = opt.term;
        card.dataset.term = opt.term;
        
        // Randomize rotation and position
        const rot = (Math.random() * 30 - 15); // -15 to 15 deg
        const tx = (Math.random() * 40 - 20); // -20 to 20 px
        const ty = (Math.random() * 40 - 20);
        card.style.setProperty('--rot', `${rot}deg`);
        card.style.setProperty('--tx', `${tx}px`);
        card.style.setProperty('--ty', `${ty}px`);
        
        card.addEventListener('click', () => handlePlayerClick(card, opt.term));
        
        if (index < Math.ceil(options.length / 2)) {
            ui.cardContainerTop.appendChild(card);
        } else {
            ui.cardContainerBottom.appendChild(card);
        }
    });
}

function typeWriter(text) {
    isTyping = true;
    let i = 0;
    ui.meaningDisplay.textContent = "";
    
    typeInterval = setInterval(() => {
        if (i < text.length) {
            ui.meaningDisplay.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(typeInterval);
            isTyping = false;
        }
    }, 100); // 每個字100ms
}

function speakText(text) {
    if(synth.speaking) synth.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.0;
    synth.speak(utterance);
}

function startTimer() {
    timeLeft = ROUND_TIME;
    updateTimerUI();
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        updateTimerUI();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 100);
}

function updateTimerUI() {
    const percentage = Math.max(0, (timeLeft / ROUND_TIME) * 100);
    ui.timerFill.style.width = percentage + '%';
    
    if (percentage < 30) {
        ui.timerFill.classList.add('warning');
    } else {
        ui.timerFill.classList.remove('warning');
    }
}

function showFeedback(reason, isCorrect) {
    ui.feedbackOverlay.classList.remove('hidden');
    ui.feedbackTerm.textContent = currentQuestion.term;
    ui.feedbackMeaning.textContent = currentQuestion.meaning;
    
    if (reason === 'timeup') {
        ui.feedbackIcon.textContent = '⏱️';
        ui.feedbackTitle.textContent = '時間到！';
        ui.feedbackTitle.className = 'feedback-title wrong';
    } else if (reason === 'ai') {
        ui.feedbackIcon.textContent = '🤖';
        ui.feedbackTitle.textContent = isCorrect ? '系統 AI 搶答正確！' : '系統 AI 搶答錯誤！';
        // AI correct is bad for player (red), AI wrong is good for player (green)
        ui.feedbackTitle.className = isCorrect ? 'feedback-title wrong' : 'feedback-title correct'; 
    } else {
        ui.feedbackIcon.textContent = isCorrect ? '✓' : '✕';
        ui.feedbackTitle.textContent = isCorrect ? '判斷正確！' : '判斷錯誤！';
        ui.feedbackTitle.className = isCorrect ? 'feedback-title correct' : 'feedback-title wrong';
    }
}

function handlePlayerClick(cardElement, selectedTerm) {
    // 防止重複點擊
    if (cardElement.classList.contains('disabled')) return;
    
    // 停止計時與AI
    clearInterval(timerInterval);
    clearTimeout(aiTimeout);
    
    // 禁用所有卡片
    disableAllCards();
    
    const isCorrect = selectedTerm === currentQuestion.term;
    
    if (isCorrect) {
        cardElement.classList.remove('disabled');
        cardElement.classList.add('correct');
        playerScore += Math.ceil(timeLeft * 10); // 剩餘時間越多分數越高
        playSound('correct');
    } else {
        cardElement.classList.remove('disabled');
        cardElement.classList.add('wrong');
        // 標示正確答案
        highlightCorrectCard();
        playerScore = Math.max(0, playerScore - 20);
        playSound('wrong');
    }
    
    updateScores();
    
    // 延遲後跳出資訊卡
    setTimeout(() => showFeedback('player', isCorrect), 1200);
}

function handleTimeUp() {
    clearTimeout(aiTimeout);
    disableAllCards();
    highlightCorrectCard();
    playSound('wrong');
    setTimeout(() => showFeedback('timeup', false), 1200);
}

function startAILogic() {
    // AI會在 3 到 12 秒之間作答
    const thinkTime = (Math.random() * 9 + 3) * 1000;
    
    aiTimeout = setTimeout(() => {
        clearInterval(timerInterval);
        disableAllCards();
        
        // AI 有 80% 機率答對
        const isCorrect = Math.random() < 0.8;
        
        if (isCorrect) {
            highlightCorrectCard('ai-correct');
            aiScore += Math.ceil(timeLeft * 10);
            playSound('correct');
        } else {
            // AI 選錯
            const cards = document.querySelectorAll('.card');
            const wrongCards = Array.from(cards).filter(c => c.dataset.term !== currentQuestion.term);
            if(wrongCards.length > 0) {
                const randomWrong = wrongCards[Math.floor(Math.random() * wrongCards.length)];
                randomWrong.classList.remove('disabled');
                randomWrong.classList.add('wrong');
            }
            highlightCorrectCard();
            playSound('wrong');
        }
        
        updateScores();
        setTimeout(() => showFeedback('ai', isCorrect), 1200);
    }, thinkTime);
}

function disableAllCards() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(c => c.classList.add('disabled'));
}

function highlightCorrectCard(customClass = 'correct') {
    const cards = document.querySelectorAll('.card');
    cards.forEach(c => {
        if (c.dataset.term === currentQuestion.term) {
            c.classList.remove('disabled');
            c.classList.add(customClass);
        }
    });
}

function updateScores() {
    ui.playerScore.textContent = playerScore.toString().padStart(3, '0');
    ui.aiScore.textContent = aiScore.toString().padStart(3, '0');
}

function endGame() {
    if(synth.speaking) synth.cancel();
    
    ui.finalScore.textContent = playerScore;
    
    if (ui.aiOpponent.checked) {
        if (playerScore > aiScore) {
            ui.aiResult.innerHTML = `你擊敗了系統AI！<br>AI 得分: ${aiScore}`;
            ui.aiResult.style.color = 'var(--primary)';
        } else if (playerScore < aiScore) {
            ui.aiResult.innerHTML = `系統AI勝出！<br>AI 得分: ${aiScore}`;
            ui.aiResult.style.color = 'var(--accent)';
        } else {
            ui.aiResult.innerHTML = `平手！<br>AI 得分: ${aiScore}`;
            ui.aiResult.style.color = 'var(--text-main)';
        }
    } else {
        ui.aiResult.innerHTML = "演習完成！表現優異。";
    }
    
    switchScreen('end');
}

function resetToStart() {
    switchScreen('start');
}

// 簡單音效佔位 (可擴充實際 Web Audio API)
function playSound(type) {
    // 這裡可以加入實際的音效播放程式碼
    // 例如： new Audio('correct.mp3').play();
}
