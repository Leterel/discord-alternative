const $ = id => document.getElementById(id);
let socket, peer, selfId, iceServers = [];
let micStream, cameraStream, screenStream, remoteState = {}, remoteCamera, remoteScreen;
const remoteAudio = document.createElement('audio'); remoteAudio.autoplay = true; document.body.append(remoteAudio);
const note = text => { $('notice').textContent = text; };
const alive = current => peer === current && current?.pc.signalingState !== 'closed';
const stopStream = stream => stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
const streamFor = kind => ({mic:micStream,camera:cameraStream,screen:screenStream}[kind]);
function setStream(kind, stream) {
  if (kind === 'mic') micStream = stream;
  if (kind === 'camera') cameraStream = stream;
  if (kind === 'screen') screenStream = stream;
}
const signal = (current, data) => {
  if (alive(current) && socket === current.socket && socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({type:'signal',data}));
};
function channelSend(data) {
  const dc = peer?.channel;
  if (dc?.readyState !== 'open' || dc.bufferedAmount > 256 * 1024) return false;
  try { dc.send(JSON.stringify(data)); return true; } catch { return false; }
}
const localState = () => ({mic:!!micStream,camera:!!cameraStream,screen:!!screenStream});
function controls(connected) {
  for (const id of ['mic','camera','screen']) $(id).disabled = !connected && !streamFor(id);
  for (const id of ['message','send']) $(id).disabled = !connected;
  $('leave').disabled = !socket;
}
function updateMedia() {
  $('mic').textContent = micStream ? '♩  Mikro aus' : '♩  Mikro an';
  $('camera').textContent = cameraStream ? '▣  Kamera aus' : '▣  Kamera an';
  $('screen').textContent = screenStream ? '▱  Teilen beenden' : '▱  Bildschirm';
  for (const [id,active] of Object.entries(localState())) $(id).setAttribute('aria-pressed',String(active));
  const stream = screenStream || cameraStream;
  $('local-video').srcObject = stream || null;
  $('local-video').toggleAttribute('data-active',!!stream);
  channelSend({type:'media',...localState()});
}
function renderRemote() {
  const stream = remoteState.screen ? remoteScreen : remoteState.camera ? remoteCamera : null;
  $('remote-video').srcObject = stream || null;
  $('remote-video').toggleAttribute('data-active',!!stream);
  $('remote-placeholder').hidden = !!stream;
  if (stream) $('remote-video').play().catch(()=>{});
}
function appendMessage(name,text,self=false) {
  $('chat-empty')?.remove();
  const row = document.createElement('div'); row.className = 'msg' + (self?' self':'');
  const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  const by = document.createElement('b'); by.textContent = name;
  const body = document.createElement('span'); body.textContent = text;
  row.append(time,by,body); $('messages').append(row);
  while ($('messages').children.length > 300) $('messages').firstElementChild.remove();
  $('messages').scrollTop = $('messages').scrollHeight;
}
function bindChannel(current, dc) {
  if (!alive(current) || current.channel) { dc.close(); return; }
  current.channel = dc;
  dc.onopen = () => {
    if (!alive(current)) return;
    controls(true); $('badge').textContent = '● Zusammen online'; $('badge').classList.add('online');
    note('Ihr seid verbunden. Mikro, Kamera und Bildschirm bleiben unter eurer Kontrolle.');
    $('remote-title').textContent = 'Da bist du ja.'; $('remote-description').textContent = 'Kamera aus. Gesellschaft an.';
    channelSend({type:'media',...localState()});
  };
  dc.onclose = () => { if (alive(current)) { controls(false); note('Chatverbindung beendet. Bitte den Raum neu betreten.'); } };
  dc.onerror = () => { if (alive(current)) note('Chatverbindung gestört. Bitte den Raum neu betreten.'); };
  dc.onmessage = event => {
    if (!alive(current) || typeof event.data !== 'string' || event.data.length > 20000) return;
    try {
      const data = JSON.parse(event.data);
      if (data?.type==='chat' && typeof data.text==='string' && data.text.length<=4000) appendMessage($('peer-name').textContent,data.text);
      if (data?.type==='media') { remoteState={mic:!!data.mic,camera:!!data.camera,screen:!!data.screen}; renderRemote(); }
    } catch { /* Ignore malformed peer data. */ }
  };
}
function createPeer(id, name, initiate) {
  closePeer();
  $('peer-name').textContent=name; $('remote-label').textContent=name;
  const pc = new RTCPeerConnection({iceServers});
  const current = peer = {id,pc,socket,channel:null,makingOffer:false,ignoreOffer:false,settingAnswer:false,candidates:[],signals:Promise.resolve(),busy:false};
  pc.onicecandidate=event=>{if(event.candidate) signal(current,{candidate:event.candidate});};
  pc.onnegotiationneeded=async()=>{
    try {
      current.makingOffer=true;
      await pc.setLocalDescription();
      if (alive(current)) signal(current,{description:pc.localDescription});
    } catch(error) { if (alive(current)) note('Verbindungsaufbau: '+error.message); }
    finally { current.makingOffer=false; }
  };
  pc.ontrack=event=>{
    if (!alive(current)) return;
    const stream=new MediaStream([event.track]);
    if(event.track.kind==='audio') {
      remoteAudio.srcObject=stream;
      remoteAudio.play().catch(()=>{if(alive(current)) note('Bitte einmal in die App klicken, um Audio zu erlauben.');});
    } else {
      // Sender order is fixed by the initial offer: audio, camera, screen.
      const videos=pc.getTransceivers().filter(t=>t.receiver.track.kind==='video');
      if (event.transceiver===videos[1]) remoteScreen=stream;
      else remoteCamera=stream;
    }
    renderRemote();
  };
  pc.ondatachannel=event=>bindChannel(current,event.channel);
  pc.onconnectionstatechange=()=>{
    if (!alive(current)) return;
    const status={new:'Verbindung wird vorbereitet',connecting:'Verbindet …',connected:'● Direktverbindung aktiv',disconnected:'Verbindung unterbrochen',failed:'Verbindung fehlgeschlagen',closed:'Verbindung beendet'};
    $('connection').textContent=status[pc.connectionState]||pc.connectionState;
    if(pc.connectionState==='connected') controls(current.channel?.readyState==='open');
    if(['failed','disconnected'].includes(pc.connectionState)) {
      controls(false); note('Verbindung unterbrochen. Bei verschiedenen Heimnetzen braucht ihr eventuell TURN. Bei anhaltendem Fehler verlassen und neu verbinden.');
    }
  };
  // Only the existing room member creates the initial media sections. The other
  // member uses the transceivers created by the offer, avoiding duplicate tracks.
  if (initiate) {
    pc.addTransceiver('audio',{direction:'sendrecv'});
    pc.addTransceiver('video',{direction:'sendrecv'});
    pc.addTransceiver('video',{direction:'sendrecv'});
    bindChannel(current,pc.createDataChannel('sofa-chat',{ordered:true}));
  }
}
async function addCandidate(current, candidate) {
  if (!alive(current)) return;
  // A candidate from a rolled-back offer must not be applied to a new ICE session.
  if (candidate.usernameFragment && !current.pc.remoteDescription.sdp.includes('a=ice-ufrag:'+candidate.usernameFragment+'\r\n')) return;
  try { await current.pc.addIceCandidate(candidate); }
  catch(error) { if(!current.ignoreOffer) throw error; }
}
async function handleSignal(current, data) {
  if(!alive(current) || !data || typeof data!=='object') return;
  const pc=current.pc, polite=selfId > current.id;
  try {
    if(data.description) {
      const ready=!current.makingOffer && (pc.signalingState==='stable'||current.settingAnswer);
      const collision=data.description.type==='offer'&&!ready;
      current.ignoreOffer=!polite&&collision; if(current.ignoreOffer)return;
      current.settingAnswer=data.description.type==='answer';
      await pc.setRemoteDescription(data.description);
      current.settingAnswer=false;
      if (!alive(current)) return;
      if(data.description.type==='offer') {
        for (const transceiver of pc.getTransceivers()) transceiver.direction='sendrecv';
        await pc.setLocalDescription();
        if (!alive(current)) return;
        signal(current,{description:pc.localDescription});
      }
      for (const candidate of current.candidates.splice(0)) await addCandidate(current,candidate);
    } else if(data.candidate && !current.ignoreOffer) {
      if (!pc.remoteDescription) {
        if (current.candidates.length < 128) current.candidates.push(data.candidate);
      } else await addCandidate(current,data.candidate);
    }
  } catch(error) { if (alive(current)) note('Verbindungsfehler: '+error.message); }
  finally { current.settingAnswer=false; }
}
function closePeer() {
  const old=peer; peer=null;
  for (const stream of [micStream,cameraStream,screenStream]) stopStream(stream);
  micStream=cameraStream=screenStream=null;
  if (old) {
    old.pc.onconnectionstatechange=old.pc.onnegotiationneeded=old.pc.onicecandidate=old.pc.ontrack=old.pc.ondatachannel=null;
    if(old.channel){old.channel.onopen=old.channel.onclose=old.channel.onmessage=old.channel.onerror=null;old.channel.close();}
    old.pc.close();
  }
  if ($('screens').open) $('screens').close();
  window.desktop?.cancelScreen();
  remoteCamera=remoteScreen=null;remoteState={};remoteAudio.srcObject=null;
  controls(false);updateMedia();renderRemote();
}
function disconnect(message='Du hast das Sofa verlassen.') {
  const old=socket;socket=null;
  if(old){old.onopen=old.onmessage=old.onerror=old.onclose=null;old.close();}
  closePeer();selfId=null;iceServers=[];$('setup').hidden=false;$('join').disabled=false;$('leave').disabled=true;
  $('badge').textContent='● Offline';$('badge').classList.remove('online');$('connection').textContent='Nicht verbunden';
  $('peer-name').textContent='Warte auf Gesellschaft';$('remote-label').textContent='Dein Kollege';$('remote-title').textContent='Noch ein Platz frei.';
  $('remote-description').textContent='Gemeinsam ist sogar Nichtstun besser.';note(message);
}
$('join-form').addEventListener('submit',event=>{
  event.preventDefault(); if(socket)return;
  let url;try{url=new URL($('server').value);}catch{return note('Bitte eine gültige Serveradresse eingeben.');}
  if(!['ws:','wss:'].includes(url.protocol))return note('Die Serveradresse muss mit ws:// oder wss:// beginnen.');
  if(url.username || url.password) return note('Die Serveradresse darf keine Zugangsdaten enthalten. Nutze das Raumschlüssel-Feld.');
  if(url.protocol==='ws:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return note('Für entfernte Server bitte wss:// mit gültigem TLS-Zertifikat verwenden.');
  $('join').disabled=true;note('Sofa wird aufgeschlossen …');
  let current;
  try { current=socket=new WebSocket(url.href); }
  catch(error) { $('join').disabled=false; return note('Serveradresse nicht verwendbar: '+error.message); }
  $('leave').disabled=false;
  current.onopen=()=>{if(socket===current)current.send(JSON.stringify({type:'join',name:$('name').value.trim(),room:$('room').value,secret:$('secret').value}));};
  current.onmessage=event=>{
    if (socket!==current) return;
    let msg;try{msg=JSON.parse(event.data);}catch{return;}
    if(!msg || typeof msg!=='object')return;
    if(msg.type==='joined'){
      selfId=msg.id;iceServers=Array.isArray(msg.iceServers)?msg.iceServers:[];$('setup').hidden=true;$('leave').disabled=false;
      $('badge').textContent='● Im Raum';$('badge').classList.add('online');
      note(msg.hasTurn?'Warte auf deinen Kollegen. TURN ist verfügbar.':'Warte auf deinen Kollegen. Ohne TURN funktionieren manche Heimnetz-Kombinationen nicht.');
      if(msg.peers?.[0])createPeer(msg.peers[0].id,msg.peers[0].name,false);
    }
    if(msg.type==='peer-joined')createPeer(msg.id,msg.name,true);
    if(msg.type==='signal' && peer && msg.from===peer.id) {
      const target=peer;
      // Serialize asynchronous SDP work so candidates cannot overtake it.
      target.signals=target.signals.then(()=>handleSignal(target,msg.data));
    }
    if(msg.type==='peer-left' && peer?.id===msg.id){closePeer();$('peer-name').textContent='Warte auf Gesellschaft';$('badge').textContent='● Im Raum';$('connection').textContent='Kollege hat verlassen';note('Dein Kollege ist gegangen. Mikro, Kamera und Teilen wurden gestoppt.');}
  };
  current.onerror=()=>{if(socket===current)note('Server nicht erreichbar. Adresse und Serverstart prüfen.');};
  current.onclose=event=>{if(socket===current)disconnect(event.reason||'Verbindung zum Server beendet. Bitte erneut verbinden.');};
});
$('leave').onclick=()=>disconnect();
$('chat-form').addEventListener('submit',event=>{
  event.preventDefault();const text=$('message').value.trim();if(!text||text.length>4000)return;
  if (!channelSend({type:'chat',text})) return note('Nachricht konnte nicht gesendet werden. Bitte gleich erneut versuchen.');
  appendMessage($('name').value.trim(),text,true);$('message').value='';
});
async function toggle(kind) {
  const current=peer;
  if(!current || current.busy)return;
  current.busy=true;
  const previous=streamFor(kind);
  let next=null;
  try {
    const index={mic:0,camera:1,screen:2}[kind];
    const sender=current.pc.getTransceivers()[index]?.sender;
    if (!sender) throw new Error('Medienverbindung noch nicht bereit.');
    if(previous) {
      // Stop capture immediately, including while the network is disconnected.
      setStream(kind,null);stopStream(previous);updateMedia();
      await sender.replaceTrack(null);
    } else {
      if (current.channel?.readyState!=='open') return;
      if(kind==='screen') next=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:false});
      else next=await navigator.mediaDevices.getUserMedia(kind==='mic'?{audio:{echoCancellation:true,noiseSuppression:true},video:false}:{video:{width:{ideal:1280},height:{ideal:720}},audio:false});
      if(!alive(current)){stopStream(next);return;}
      const track=next.getTracks()[0];
      if (!track || track.readyState==='ended') throw new Error('Die Freigabe wurde beendet.');
      await sender.replaceTrack(track);
      if(!alive(current)){stopStream(next);return;}
      if (track.readyState==='ended') { await sender.replaceTrack(null); throw new Error('Die Freigabe wurde beendet.'); }
      setStream(kind,next);
      track.onended=()=>{
        if (!alive(current) || streamFor(kind)!==next) return;
        setStream(kind,null);stopStream(next);
        sender.replaceTrack(null).catch(()=>{});updateMedia();
      };
      updateMedia();
    }
  } catch(error){
    stopStream(next);
    if(alive(current)) { updateMedia();note('Nicht gestartet: '+error.message+' Prüfe die Gerätefreigabe in deinem Betriebssystem.'); }
  } finally{
    current.busy=false;
    if (alive(current)) {
      // A native picker timeout/failure can reject while our source dialog is
      // still open. Dismiss it so the user can retry or leave the room.
      if (kind==='screen') $('screens').close();
      controls(current.channel?.readyState==='open' && current.pc.connectionState==='connected');
    }
  }
}
for(const kind of ['mic','camera','screen'])$(kind).onclick=()=>toggle(kind);
$('cancel-screen').onclick=()=>{$('screens').close();window.desktop?.chooseScreen(null);};
$('screens').addEventListener('cancel',()=>window.desktop?.chooseScreen(null));
window.desktop?.onScreens(options=>{
  if (!peer?.busy) { window.desktop.chooseScreen(null); return; }
  $('screen-list').replaceChildren();
  for(const source of options){const button=document.createElement('button');const image=document.createElement('img');image.src=source.thumbnail;image.alt='';const label=document.createElement('span');label.textContent=source.name;button.append(image,label);button.onclick=()=>{$('screens').close();window.desktop.chooseScreen(source.id);};$('screen-list').append(button);}
  if (!$('screens').open) $('screens').showModal();
});
window.addEventListener('pointerdown',()=>{if(remoteAudio.srcObject)remoteAudio.play().catch(()=>{});});
window.addEventListener('beforeunload',()=>disconnect());
controls(false);
