const KB=window.ORKEN_KB||[];
const messages=document.getElementById("messages");
const input=document.getElementById("messageInput");
const language=document.getElementById("language");
const voiceBtn=document.getElementById("voiceBtn");
const voiceStatus=document.getElementById("voiceStatus");

const GOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/AKfycbxXnpRWOVT8j8ojKA3-UGzBbyHx9AI9hVycsfTZjZpWFkmz_PeXZKcCNssW4e98vlrv/exec";

let pendingContactQuestion=null;
let waitingForContact=false;
let typingTimer=null;

function getLang(){return language.value==="ur"?"ur":"en"}

function addMessage(text,who="bot",speakable=true){
 const row=document.createElement("div");
 row.className="msg "+who;
 const bubble=document.createElement("div");
 bubble.className="bubble";
 const textNode=document.createElement("span");
 textNode.textContent=String(text||"");
 bubble.appendChild(textNode);

 if(who==="bot"&&speakable){
  const actions=document.createElement("div");
  actions.className="bubble-actions";
  const btn=document.createElement("button");
  btn.className="read-btn";
  btn.type="button";
  btn.textContent="🔊 Read";
  btn.onclick=()=>{
   if("speechSynthesis" in window&&speechSynthesis.speaking){
    speechSynthesis.cancel(); btn.textContent="🔊 Read"; return;
   }
   speak(String(text||""),btn);
  };
  actions.appendChild(btn);
  bubble.appendChild(actions);
 }
 row.appendChild(bubble);
 messages.appendChild(row);
 messages.scrollTop=messages.scrollHeight;
 return row;
}

function normalizeQuestion(q){
 return String(q||"").toLowerCase()
  .replace(/[?!.،,;:()\\-_/]/g," ")
  .replace(/\s+/g," ")
  .trim();
}

function findAnswer(q){
 const normalized=normalizeQuestion(q);
 if(!normalized)return null;

 const greetingWords=["hi","hello","hey","salam","assalam","assalam o alaikum","good morning","good afternoon","good evening"];
 if(greetingWords.some(g=>normalized===g||normalized.startsWith(g+" "))){
  const greeting=KB.find(item=>Array.isArray(item.keys)&&item.keys.includes("hello"));
  return greeting?greeting[getLang()]:null;
 }

 let best=null,bestScore=0;
 for(const item of KB){
  if(!Array.isArray(item.keys))continue;
  let score=0;
  for(const rawKey of item.keys){
   const key=normalizeQuestion(rawKey);
   if(!key)continue;
   if(normalized===key)score+=10;
   else if(normalized.includes(key))score+=key.split(" ").length>1?6:3;
  }
  if(score>bestScore){bestScore=score;best=item}
 }
 return bestScore>=3&&best?best[getLang()]:null;
}

function reply(q){
 const answer=findAnswer(q);
 if(answer)return answer;
 pendingContactQuestion=q;
 waitingForContact=true;
 return getLang()==="ur"
  ?"Is sawal ka jawab meri available Orken AI profile mein nahi hai. Main apne manager se baat karta hoon. Barah-e-karam apna mobile/contact number dein."
  :"I don't have this information in the available Orken AI profile. I'll talk to our manager about it. Please provide your contact number.";
}

function isContactNumber(value){
 return /(?:\+?\d[\d\s().-]{6,}\d|\b0\d{9,12}\b)/.test(String(value).trim());
}

async function saveToGoogleSheet(question,contact){
 try{
  const dateTime=new Date().toLocaleString("en-PK",{timeZone:"Asia/Karachi",dateStyle:"medium",timeStyle:"medium"});
  const body=new URLSearchParams({question:question||"",contactNumber:contact||"",dateTime,status:"New",source:"Orken AI Website Chatbot"}).toString();
  await fetch(GOOGLE_SHEET_WEBHOOK_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body,cache:"no-store",keepalive:true});
  return true;
 }catch(error){
  console.error("Google Sheet save error:",error);
  return false;
 }
}

function showTyping(){
 removeTyping();
 const row=document.createElement("div");
 row.id="typingIndicator";
 row.className="msg typing";
 const bubble=document.createElement("div");
 bubble.className="bubble";
 bubble.textContent="Typing...";
 row.appendChild(bubble);
 messages.appendChild(row);
 messages.scrollTop=messages.scrollHeight;
}

function removeTyping(){
 if(typingTimer){clearTimeout(typingTimer);typingTimer=null}
 const row=document.getElementById("typingIndicator");
 if(row)row.remove();
}

async function submitQuestion(q){
 q=String(q||"").trim();
 if(!q)return;

 addMessage(q,"user",false);
 input.value="";

 if(waitingForContact&&isContactNumber(q)){
  const question=pendingContactQuestion;
  showTyping();
  try{
   const saved=await saveToGoogleSheet(question,q);
   removeTyping();
   if(saved){
    pendingContactQuestion=null;
    waitingForContact=false;
    addMessage(getLang()==="ur"
     ?"Shukriya! Aapka contact number record ho gaya hai. Hamara manager jald aapse baat karega."
     :"Thank you! Your contact number has been recorded. Our manager will talk to you soon.","bot",true);
   }else{
    addMessage(getLang()==="ur"
     ?"Contact number save nahi ho saka. Barah-e-karam apna mobile number dobara bhejein."
     :"I couldn't record the contact number just now. Please provide your mobile number again.","bot",true);
   }
  }catch(error){
   removeTyping();
   addMessage("Sorry, something went wrong. Please try again.","bot",true);
  }
  return;
 }

 if(waitingForContact){
  addMessage(getLang()==="ur"
   ?"Barah-e-karam apna mobile/contact number dein taake manager aapse baat kar sake."
   :"Please provide your mobile/contact number so our manager can talk to you.","bot",true);
  return;
 }

 showTyping();
 typingTimer=setTimeout(()=>{
  typingTimer=null;
  removeTyping();
  addMessage(reply(q),"bot",true);
 },2000);
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
  utter.onend=()=>{button.textContent="🔊 Read"};
 }
 speechSynthesis.speak(utter);
}

document.getElementById("chatForm").addEventListener("submit",e=>{
 e.preventDefault();
 submitQuestion(input.value);
});

document.querySelectorAll(".quick-actions button").forEach(b=>{
 b.addEventListener("click",()=>submitQuestion(b.dataset.q));
});

language.addEventListener("change",()=>{
 input.placeholder=getLang()==="ur"?"Orken AI ke bare mein sawal poochein...":"Type or speak your question...";
});

function welcome(){
 if(!messages.children.length){
  addMessage(getLang()==="ur"
   ?"Assalam-o-alaikum! Main Orken AI Assistant hoon. Orken AI ke bare mein sawal poochein."
   :"Hello! I’m the Orken AI Assistant. Ask me anything about Orken AI.","bot",true);
 }
}

let recognition=null,isListening=false;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
 recognition=new SpeechRecognition();
 recognition.interimResults=false;
 recognition.continuous=false;
 recognition.maxAlternatives=1;
 recognition.onstart=()=>{
  isListening=true;voiceBtn.classList.add("listening");voiceBtn.textContent="⏹️";
  voiceStatus.textContent=getLang()==="ur"?"Sun raha hoon... boliye. Dobara click karke stop karein.":"Listening... speak now. Click again to stop.";
 };
 recognition.onresult=e=>{
  const transcript=e.results[0][0].transcript.trim();
  if(!transcript)return;
  input.value=transcript;
  voiceStatus.textContent=getLang()==="ur"?"Voice ko text mein convert kar diya gaya.":"Voice converted to text.";
  submitQuestion(transcript);
 };
 recognition.onerror=e=>{
  isListening=false;voiceBtn.classList.remove("listening");voiceBtn.textContent="🎙️";
  voiceStatus.textContent=e.error==="no-speech"?(getLang()==="ur"?"Koi voice detect nahi hui.":"No speech was detected."):"Voice error: "+e.error;
 };
 recognition.onend=()=>{
  isListening=false;voiceBtn.classList.remove("listening");voiceBtn.textContent="🎙️";
 };
 voiceBtn.addEventListener("click",()=>{
  if(isListening){recognition.stop();return}
  if("speechSynthesis" in window)speechSynthesis.cancel();
  recognition.lang=getLang()==="ur"?"ur-PK":"en-US";
  try{recognition.start()}catch(err){voiceStatus.textContent="Voice could not be started again."}
 });
}else{
 voiceBtn.disabled=true;
 voiceBtn.title="Voice input is not supported in this browser";
}

welcome();