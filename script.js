const KB=window.ORKEN_KB||[];
const messages=document.getElementById("messages");
const input=document.getElementById("messageInput");
const language=document.getElementById("language");
const voiceBtn=document.getElementById("voiceBtn");
const voiceStatus=document.getElementById("voiceStatus");

function getLang(){return language.value==="ur"?"ur":"en"}
function addMessage(text,who="bot",speakable=true){
 const row=document.createElement("div"); row.className="msg "+who;
 const bubble=document.createElement("div"); bubble.className="bubble";
 bubble.textContent=text;
 if(who==="bot"&&speakable){
  const actions=document.createElement("div"); actions.className="bubble-actions";
  const btn=document.createElement("button"); btn.className="read-btn"; btn.type="button"; btn.textContent="🔊 Read";
  btn.onclick=()=>speak(text); actions.appendChild(btn); bubble.appendChild(actions);
 }
 row.appendChild(bubble); messages.appendChild(row); messages.scrollTop=messages.scrollHeight;
}
function findAnswer(q){
 const normalized=q.toLowerCase().replace(/[?!.،,]/g," ");
 let best=null,score=0;
 for(const item of KB){
  let s=0;
  for(const key of item.keys){if(normalized.includes(key.toLowerCase())) s+=key.length>4?2:1}
  if(s>score){score=s;best=item}
 }
 return best?best[getLang()]:null;
}
function reply(q){
 const answer=findAnswer(q);
 if(answer) return answer;
 return getLang()==="ur"
 ? "Main sirf Orken AI ki information provide karta hoon. Aap Orken AI ke services, AI agents, pricing, process, integrations, voice agents ya privacy ke bare mein sawal pooch sakte hain."
 : "I only provide Orken AI information. You can ask about Orken AI services, AI agents, pricing, process, integrations, voice agents, or privacy.";
}
function submitQuestion(q){
 q=q.trim(); if(!q)return;
 addMessage(q,"user",false); input.value="";
 setTimeout(()=>addMessage(reply(q),"bot",true),250);
}
function speak(text){
 if(!("speechSynthesis" in window)){voiceStatus.textContent=getLang()==="ur"?"Is browser mein text-to-speech available nahi.":"Text-to-speech is not available in this browser.";return}
 speechSynthesis.cancel();
 const utter=new SpeechSynthesisUtterance(text);
 utter.lang=getLang()==="ur"?"ur-PK":"en-US";
 utter.rate=.95;
 speechSynthesis.speak(utter);
}
document.getElementById("chatForm").addEventListener("submit",e=>{e.preventDefault();submitQuestion(input.value)});
document.querySelectorAll(".quick-actions button").forEach(b=>b.addEventListener("click",()=>submitQuestion(b.dataset.q)));
document.getElementById("clearBtn").addEventListener("click",()=>{messages.innerHTML="";welcome()});
language.addEventListener("change",()=>{
 document.getElementById("introText").textContent=getLang()==="ur"?"Orken AI ke services, AI agents, process, pricing, integrations ya privacy ke bare mein poochein.":"Ask about Orken AI services, AI agents, process, pricing, integrations, or privacy.";
 input.placeholder=getLang()==="ur"?"Orken AI ke bare mein sawal poochein...":"Ask about Orken AI...";
 welcome();
});
function welcome(){addMessage(getLang()==="ur"?"Assalam-o-alaikum! Main Orken AI Assistant hoon. Orken AI ke bare mein sawal poochein.":"Hello! I’m the Orken AI Assistant. Ask me anything about Orken AI.","bot",true)}
let recognition=null;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
 recognition=new SpeechRecognition(); recognition.interimResults=false; recognition.continuous=false;
 recognition.onstart=()=>{voiceBtn.classList.add("listening");voiceStatus.textContent=getLang()==="ur"?"Sun raha hoon... boliye.":"Listening... speak now."};
 recognition.onresult=e=>{input.value=e.results[0][0].transcript;voiceStatus.textContent=getLang()==="ur"?"Aapka sawal mil gaya.":"Question captured.";submitQuestion(input.value)};
 recognition.onerror=e=>{voiceStatus.textContent="Voice error: "+e.error};
 recognition.onend=()=>voiceBtn.classList.remove("listening");
 voiceBtn.addEventListener("click",()=>{recognition.lang=getLang()==="ur"?"ur-PK":"en-US";recognition.start()});
}else{
 voiceBtn.disabled=true; voiceBtn.title="Voice input is not supported in this browser";
}
welcome();