const KB = window.ORKEN_KB || [];
const messages = document.getElementById("messages");
const input = document.getElementById("messageInput");
const language = document.getElementById("language");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const chatForm = document.getElementById("chatForm");

const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxXnpRWOVT8j8ojKA3-UGzBbyHx9AI9hVycsfTZjZpWFkmz_PeXZKcCNssW4e98vlrv/exec";

let pendingContactQuestion = null;
let waitingForContact = false;
let typingTimer = null;
let busy = false;

function getLang() {
  return language && language.value === "ur" ? "ur" : "en";
}

function addMessage(text, who = "bot", speakable = true) {
  const row = document.createElement("div");
  row.className = "msg " + who;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const textNode = document.createElement("span");
  textNode.textContent = String(text || "");
  bubble.appendChild(textNode);

  if (who === "bot" && speakable) {
    const actions = document.createElement("div");
    actions.className = "bubble-actions";

    const btn = document.createElement("button");
    btn.className = "read-btn";
    btn.type = "button";
    btn.textContent = "🔊 Read";
    btn.onclick = function () {
      if ("speechSynthesis" in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
        btn.textContent = "🔊 Read";
        return;
      }
      speak(String(text || ""), btn);
    };

    actions.appendChild(btn);
    bubble.appendChild(actions);
  }

  row.appendChild(bubble);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
}

function normalizeQuestion(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[?!.،,;:()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findAnswer(q) {
  const normalized = normalizeQuestion(q);
  if (!normalized) return null;

  let best = null;
  let bestScore = 0;

  for (const item of KB) {
    if (!Array.isArray(item.keys)) continue;

    let score = 0;

    for (const rawKey of item.keys) {
      const key = normalizeQuestion(rawKey);
      if (!key) continue;

      if (normalized === key) score += 20;
      else if (normalized.includes(key)) score += key.split(" ").length > 1 ? 8 : 4;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore > 0 && best ? best[getLang()] : null;
}

function reply(q) {
  const answer = findAnswer(q);

  if (answer) return answer;

  pendingContactQuestion = q;
  waitingForContact = true;

  return getLang() === "ur"
    ? "Is sawal ka jawab meri available Orken AI profile mein nahi hai. Main apne manager se baat karta hoon. Barah-e-karam apna mobile/contact number dein."
    : "I don't have this information in the available Orken AI profile. I'll talk to our manager about it. Please provide your contact number.";
}

function isContactNumber(value) {
  const cleaned = String(value || "").trim();
  return /(?:\+?\d[\d\s().-]{6,}\d|\b0\d{9,12}\b)/.test(cleaned);
}

async function saveToGoogleSheet(question, contact) {
  try {
    const dateTime = new Date().toLocaleString("en-PK", {
      timeZone: "Asia/Karachi",
      dateStyle: "medium",
      timeStyle: "medium"
    });

    const body = new URLSearchParams({
      question: question || "",
      contactNumber: contact || "",
      dateTime,
      status: "New",
      source: "Orken AI Website Chatbot"
    }).toString();

    await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      cache: "no-store",
      keepalive: true
    });

    return true;
  } catch (error) {
    console.error("Google Sheet save error:", error);
    return false;
  }
}

function showTyping() {
  removeTyping(false);

  const row = document.createElement("div");
  row.id = "typingIndicator";
  row.className = "msg typing";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "Typing...";

  row.appendChild(bubble);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping(clearTimer = true) {
  if (clearTimer && typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }

  const row = document.getElementById("typingIndicator");
  if (row) row.remove();
}

function setBusy(value) {
  busy = value;
  if (chatForm) {
    const send = chatForm.querySelector('button[type="submit"]');
    if (send) send.disabled = value;
  }
  if (input) input.disabled = value;
}

async function submitQuestion(q) {
  q = String(q || "").trim();
  if (!q || busy) return;

  addMessage(q, "user", false);
  input.value = "";

  if (waitingForContact) {
    if (isContactNumber(q)) {
      const question = pendingContactQuestion;
      setBusy(true);
      showTyping();

      const saved = await saveToGoogleSheet(question, q);

      removeTyping(false);
      setBusy(false);

      if (saved) {
        pendingContactQuestion = null;
        waitingForContact = false;
        addMessage(
          getLang() === "ur"
            ? "Shukriya! Aapka contact number record ho gaya hai. Hamara manager jald aapse baat karega."
            : "Thank you! Your contact number has been recorded. Our manager will talk to you soon.",
          "bot",
          true
        );
      } else {
        addMessage(
          getLang() === "ur"
            ? "Contact number save nahi ho saka. Barah-e-karam apna mobile number dobara bhejein."
            : "I couldn't record the contact number just now. Please provide your mobile number again.",
          "bot",
          true
        );
      }
      return;
    }

    addMessage(
      getLang() === "ur"
        ? "Barah-e-karam apna mobile/contact number dein taake manager aapse baat kar sake."
        : "Please provide your mobile/contact number so our manager can talk to you.",
      "bot",
      true
    );
    return;
  }

  setBusy(true);
  showTyping();

  typingTimer = setTimeout(function () {
    typingTimer = null;
    removeTyping(false);
    addMessage(reply(q), "bot", true);
    setBusy(false);
  }, 2000);
}

function speak(text, button) {
  if (!("speechSynthesis" in window)) {
    voiceStatus.textContent =
      getLang() === "ur"
        ? "Is browser mein text-to-speech available nahi."
        : "Text-to-speech is not available in this browser.";
    return;
  }

  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = getLang() === "ur" ? "ur-PK" : "en-US";
  utter.rate = 0.95;

  if (button) {
    button.textContent = "🔇 Stop";
    utter.onend = function () {
      button.textContent = "🔊 Read";
    };
    utter.onerror = function () {
      button.textContent = "🔊 Read";
    };
  }

  speechSynthesis.speak(utter);
}

if (chatForm) {
  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitQuestion(input.value);
  });
}

document.querySelectorAll(".quick-actions button").forEach(function (button) {
  button.addEventListener("click", function () {
    submitQuestion(button.dataset.q || button.textContent);
  });
});

language.addEventListener("change", function () {
  input.placeholder =
    getLang() === "ur"
      ? "Orken AI ke bare mein sawal poochein..."
      : "Type or speak your question...";
});

function welcome() {
  if (!messages.children.length) {
    addMessage(
      getLang() === "ur"
        ? "Assalam-o-alaikum! Main Orken AI Assistant hoon. Orken AI ke bare mein sawal poochein."
        : "Hello! I’m the Orken AI Assistant. Ask me anything about Orken AI.",
      "bot",
      true
    );
  }
}

let recognition = null;
let isListening = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = function () {
    isListening = true;
    voiceBtn.classList.add("listening");
    voiceBtn.textContent = "⏹️";
    voiceStatus.textContent =
      getLang() === "ur"
        ? "Sun raha hoon... boliye. Dobara click karke stop karein."
        : "Listening... speak now. Click again to stop.";
  };

  recognition.onresult = function (e) {
    const transcript = e.results[0][0].transcript.trim();
    if (!transcript) return;

    input.value = transcript;
    voiceStatus.textContent =
      getLang() === "ur"
        ? "Voice ko text mein convert kar diya gaya."
        : "Voice converted to text.";

    submitQuestion(transcript);
  };

  recognition.onerror = function (e) {
    isListening = false;
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎙️";
    voiceStatus.textContent =
      e.error === "no-speech"
        ? (getLang() === "ur" ? "Koi voice detect nahi hui." : "No speech was detected.")
        : "Voice error: " + e.error;
  };

  recognition.onend = function () {
    isListening = false;
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎙️";
  };

  voiceBtn.addEventListener("click", function () {
    if (isListening) {
      recognition.stop();
      return;
    }

    if ("speechSynthesis" in window) speechSynthesis.cancel();

    recognition.lang = getLang() === "ur" ? "ur-PK" : "en-US";

    try {
      recognition.start();
    } catch (err) {
      voiceStatus.textContent =
        getLang() === "ur"
          ? "Voice dobara start nahi ho saki."
          : "Voice could not be started again.";
    }
  });
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Voice input is not supported in this browser";
}

welcome();