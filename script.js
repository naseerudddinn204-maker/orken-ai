const KB=window.ORKEN_KB||[];
const messages=document.getElementById("messages");
const input=document.getElementById("messageInput");
const language=document.getElementById("language");
const voiceBtn=document.getElementById("voiceBtn");
const voiceStatus=document.getElementById("voiceStatus");

// Add your deployed Google Apps Script / Google Sheets webhook URL here.
// Example: https://script.google.com/macros/s/XXXXXXXX/exec
const GOOGLE_SHEET_WEBHOOK_URL="";

let pendingContactQuestion=null;
let waitingForContact=false;

function getLang(){return language.value==="ur"?"ur":"en"}

function addMessage(text,who="bot",speakable=true){
 const row=document.createElement("div");
 row.className="msg "+who;
 const bubble=document.createElement("div");
 bubble.className="bubble";
 const textNode=document.createElement("span");
 textNode.textContent=text;
 bubble.appendChild(textNode);

 if(who==="bot"&&speakable){
  const actions=document.createElement("div");
  actions.className="bubble-actions";
  const btn=document.createElement("button");
  btn.className="read-btn";
  btn.type="button";
  btn.textContent="🔊 Read";
  btn.setAttribute("aria-label","Read answer aloud");

  btn.onclick=()=>{
   if("speechSynthesis" in window && speechSynthesis.speaking){
    speechSynthesis.cancel();
    btn.textContent="🔊 Read";
    btn.setAttribute("aria-label","Read answer aloud");
    return;
   }
   speak(text,btn);
  };

  actions.appendChild(btn);
  bubble.appendChild(actions);
 }
 row.appendChild(bubble);
 messages.appendChild(row);
 messages.scrollTop=messages.scrollHeight;
}

function findAnswer(q){
 const normalized=q.toLowerCase().replace(/[?!.،,]/g," ");
 let best=null,score=0;
 for(const item of KB){
  let s=0;
  for(const key of item.keys){
   if(normalized.includes(key.toLowerCase())) s+=key.length>4?2:1;
  }
  if(s>score){score=s;best=item}
 }
 return best?best[getLang()]:null;
}

function reply(q){
 const answer=findAnswer(q);
 if(answer) return answer;

 // Unknown/non-Orken question: collect the visitor's contact number.
 pendingContactQuestion=q;
 waitingForContact=true;
 return getLang()==="ur"
 ? "Main is sawal ke bare mein apne manager se baat karta hoon. Barah-e-karam apna mobile/contact number dein."
 : "I’ll talk to our manager about this. Please provide your contact number.";
}

function isContactNumber(value){
 return /(?:\\+?\\d[\\d\\s().-]{6,}\\d|\\b0\\d{9,12}\\b)/.test(value.trim());
}

async function saveToGoogleSheet(question,contact){
 if(!GOOGLE_SHEET_WEBHOOK_URL){
  return false;
 }

 try{
  const response=await fetch(GOOGLE_SHEET_WEBHOOK_URL,{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    question,
    contactNumber:contact,
    source:"Orken AI Website Chatbot",
    timestamp:new Date().toISOString()
   })
  });
  return response.ok;
 }catch(error){
  return false;
 }
}

async function submitQuestion(q){
 q=q.trim();
 if(!q)return;
 addMessage(q,"user",false);
 input.value="";

 // If the visitor was asked for a number, treat the next valid phone number
 // as the contact for the original unrelated question.
 if(waitingForContact && isContactNumber(q)){
  const question=pendingContactQuestion;
  const saved=await saveToGoogleSheet(question,q);

  if(saved){
   pendingContactQuestion=null;
   waitingForContact=false;
   addMessage(
    getLang()==="ur"
     ? "Shukriya! Aapka contact number record ho gaya hai. Hamara manager jald aapse baat karega."
     : "Thank you! Your contact number has been recorded. Our manager will talk to you soon.",
    "bot",
    true
   );
  }else{
   addMessage(
    getLang()==="ur"
     ? "Contact number save nahi ho saka. Barah-e-karam apna mobile number dobara bhejein."
     : "I couldn't record the contact number just now. Please provide your mobile number again.",
    "bot",
    true
   );
  }
  return;
 }

 // If a number was requested but the visitor sends something else,
 // keep the conversation focused on collecting the contact number.
 if(waitingForContact){
  addMessage(
   getLang()==="ur"
    ? "Barah-e-karam apna mobile/contact number dein taake manager aapse baat kar sake."
    : "Please provide your mobile/contact number so our manager can talk to you.",
   "bot",
   true
  );
  return;
 }

 setTimeout(()=>addMessage(reply(q),"bot",true),250);
}

function speak(text,button=null){
 if(!("speechSynthesis" in window)){
  voiceStatus.textContent=getLang()==="ur"?"Is browser mein text-to-speech available nahi.":"Text-to-speech is not available in this browser.";
  return;
 }
 speechSynthesis.cancel();
 const utter=new SpeechSynthesisUtterance(text);
 utter.lang=getLang()==="ur"?"ur-PK":"en-US";
 utter.rate=.95;
 if(button){
  button.textContent="🔇 Stop";
  button.setAttribute("aria-label","Stop reading");
  utter.onend=()=>{
   button.textContent="🔊 Read";
   button.setAttribute("aria-label","Read answer aloud");
  };
 }
 speechSynthesis.speak(utter);
}

document.getElementById("chatForm").addEventListener("submit",e=>{
 e.preventDefault();
 submitQuestion(input.value);
});

document.querySelectorAll(".quick-actions button").forEach(b=>
 b.addEventListener("click",()=>submitQuestion(b.dataset.q))
);

document.getElementById("clearBtn").addEventListener("click",()=>{
 if("speechSynthesis" in window)speechSynthesis.cancel();
 messages.innerHTML="";
 welcome();
});

language.addEventListener("change",()=>{
 document.getElementById("introText").textContent=getLang()==="ur"
  ?"Orken AI ke services, AI agents, process, pricing, integrations ya privacy ke bare mein poochein."
  :"Ask about Orken AI services, AI agents, process, pricing, integrations, or privacy.";
 input.placeholder=getLang()==="ur"?"Orken AI ke bare mein sawal poochein...":"Ask about Orken AI...";
 welcome();
});

function welcome(){
 addMessage(
  getLang()==="ur"
   ?"Assalam-o-alaikum! Main Orken AI Assistant hoon. Orken AI ke bare mein sawal poochein."
   :"Hello! I’m the Orken AI Assistant. Ask me anything about Orken AI.",
  "bot",
  true
 );
}

let recognition=null;
let isListening=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

if(SpeechRecognition){
 recognition=new SpeechRecognition();
 recognition.interimResults=false;
 recognition.continuous=false;
 recognition.maxAlternatives=1;

 recognition.onstart=()=>{
  isListening=true;
  voiceBtn.classList.add("listening");
  voiceBtn.textContent="⏹️";
  voiceStatus.textContent=getLang()==="ur"?"Sun raha hoon... boliye. Dobara click karke stop karein.":"Listening... speak now. Click again to stop.";
 };

 recognition.onresult=e=>{
  const transcript=e.results[0][0].transcript.trim();
  if(!transcript)return;

  // Voice is converted to text, placed in the input, then sent as a normal chat message.
  input.value=transcript;
  voiceStatus.textContent=getLang()==="ur"?"Voice ko text mein convert kar diya gaya.":"Voice converted to text.";
  submitQuestion(transcript);
 };

 recognition.onerror=e=>{
  isListening=false;
  voiceBtn.classList.remove("listening");
  voiceBtn.textContent="🎙️";
  voiceStatus.textContent=e.error==="no-speech"
   ?(getLang()==="ur"?"Koi voice detect nahi hui.":"No speech was detected.")
   :"Voice error: "+e.error;
 };

 recognition.onend=()=>{
  isListening=false;
  voiceBtn.classList.remove("listening");
  voiceBtn.textContent="🎙️";
 };

 voiceBtn.addEventListener("click",()=>{
  if(isListening){
   recognition.stop();
   return;
  }

  if("speechSynthesis" in window)speechSynthesis.cancel();

  recognition.lang=getLang()==="ur"?"ur-PK":"en-US";
  voiceStatus.textContent=getLang()==="ur"?"Recording shuru ho rahi hai...":"Starting voice recording...";
  try{
   recognition.start();
  }catch(err){
   voiceStatus.textContent=getLang()==="ur"?"Voice dobara start nahi ho saki.":"Voice could not be started again.";
  }
 });
}else{
 voiceBtn.disabled=true;
 voiceBtn.title="Voice input is not supported in this browser";
 voiceStatus.textContent=getLang()==="ur"?"Is browser mein voice input supported nahi.":"Voice input is not supported in this browser.";
}

welcome();