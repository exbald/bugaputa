(function(){
/*
 * Privacy contract: current-tab-only capture (Capture Handle per-session token)
 * ------------------------------------------------
 * Entering workspace does NOT request capture. Record click is the gesture.
 * Preference: getViewportMedia() if genuinely shipped (rare, origin trial),
 * otherwise getDisplayMedia with strongest hints:
 *   preferCurrentTab:true, selfBrowserSurface:'include',
 *   surfaceSwitching:'exclude', monitorTypeSurfaces:'exclude',
 *   systemAudio:'exclude', video:{displaySurface:'browser'}, audio:false
 * Hints alone cannot legally constrain the browser's chooser; we do not promise
 * more than the browser proves. After granting we validate:
 *   track.getSettings().displaySurface === 'browser'
 *   and, where available, track.getCaptureHandle() origin matches location.origin.
 * If unverifiable or not 'browser', route to unsupported + upload fallback —
 * never silently accept screen/window/other-tab. Audio is always false in
 * display capture; mic via separate getUserMedia({audio:true,video:false}) only
 * after explicit opt-in, OFF default, recoverable. Camera never requested.
 * See spike docs/spike/2026-09-15-viewport-vs-displaymedia.md + plan §5.
 * Mocked getDisplayMedia / synthetic streams are regression tests only, never
 * headed acceptance evidence.
 */
var CANDIDATES=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=av1,opus','video/webm','video/mp4;codecs=h264,aac','video/mp4'];
function getSupportedMime(){try{if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported)return'';for(var i=0;i<CANDIDATES.length;i++){try{if(MediaRecorder.isTypeSupported(CANDIDATES[i]))return CANDIDATES[i];}catch(_){}}}catch(_){}return'';}
function stopTracks(s){try{if(s)s.getTracks().forEach(function(t){try{t.stop();}catch(_){}});}catch(_){}}
var __bugaputaCaptureToken=null;
function setupCaptureHandle(){
  try{
    var tok='bugaputa-'+Math.random().toString(36).slice(2,10)+'-'+Date.now().toString(36);
    __bugaputaCaptureToken=tok;
    if(navigator.mediaDevices && typeof navigator.mediaDevices.setCaptureHandleConfig==='function'){
      try{ navigator.mediaDevices.setCaptureHandleConfig({exposeOrigin:true, handle:tok, permittedOrigins:[location.origin]}); }catch(_){}
    }
  }catch(_){}
  return __bugaputaCaptureToken;
}
function chooseCaptureStream(md){
  // Returns Promise<MediaStream>. Tries getViewportMedia first, else getDisplayMedia with strongest hints.
  if(md && typeof md.getViewportMedia==='function'){
    try{ return md.getViewportMedia({video:{displaySurface:'browser'}, audio:false}); }catch(e){ /* fall through to gDM */ }
  }
  try{ setupCaptureHandle(); }catch(_){}
  var gdmOpts={video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude',systemAudio:'exclude'};
  return md.getDisplayMedia(gdmOpts);
}
function validateIsCurrentTab(stream){
  try{
    var tracks=stream.getVideoTracks&&stream.getVideoTracks()||[];
    var t=tracks[0]||(stream.getTracks&&stream.getTracks()[0]);
    if(!t) return {ok:false, reason:'no track'};
    var settings=null;
    try{ settings=t.getSettings&&t.getSettings()||null; }catch(_){}
    if(settings && typeof settings.displaySurface==='string' && settings.displaySurface!=='browser'){
      return {ok:false, reason:'displaySurface is '+settings.displaySurface+' (need browser)'};
    }
    if(settings && typeof settings.displaySurface==='string' && settings.displaySurface==='browser'){
      var h=null; try{ if(t.getCaptureHandle) h=t.getCaptureHandle(); }catch(_){}
      var ho=(h&& (h.origin||h.handleOrigin))||'';
      var ht=(h&& (h.handle||h.captureHandle))||'';
      if(h){
        if(ho && ho!==location.origin) return {ok:false, reason:'handle origin mismatch'};
        if(__bugaputaCaptureToken && ht && ht!==__bugaputaCaptureToken) return {ok:false, reason:'handle token mismatch'};
        if(__bugaputaCaptureToken && !ht) return {ok:false, reason:'handle token missing — cannot verify this tab'};
      } else if(__bugaputaCaptureToken){
        return {ok:false, reason:'Capture Handle unavailable — cannot verify this tab — upload fallback'};
      } else {
        // No Capture Handle API on this browser — cannot prove this tab, honest fallback
        // displaySurface browser alone proves a tab, not this tab
        return {ok:false, reason:'cannot prove this-tab identity on this browser — upload fallback'};
      }
      return {ok:true};
    }
    var h2=null; try{ if(t.getCaptureHandle) h2=t.getCaptureHandle(); }catch(_){}
    if(h2!==null && h2!==undefined){
      var ho2=(h2.origin||h2.handleOrigin||''); if(ho2 && ho2!==location.origin) return {ok:false, reason:'handle origin mismatch'};
      var ht2=(h2.handle||h2.captureHandle||''); if(__bugaputaCaptureToken && ht2 && ht2!==__bugaputaCaptureToken) return {ok:false, reason:'handle token mismatch'};
      if(__bugaputaCaptureToken && !ht2) return {ok:false, reason:'handle token missing'};
      return {ok:true};
    }
    return {ok:false, reason:'cannot verify current-tab-only capture on this browser — upload fallback'};
  }catch(e){ return {ok:false, reason:'validation error'}; }
}
function startSession(opts){
 var mic=!!opts.micEnabled;
 var onReq=opts.onRequesting||function(){},onRec=opts.onRecording||function(){},onTick=opts.onTick||function(){},onPreview=opts.onPreview||function(){},onDenied=opts.onDenied||function(){},onUnsupported=opts.onUnsupported||function(){},onError=opts.onError||function(){};
 if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){onUnsupported('Screen recording not supported on this device — you can still upload a video file or use another feedback type.');return{cancel:function(){}};}
 var mime=getSupportedMime();
 if(!mime){onUnsupported('Screen recording not supported on this device — you can still upload a video file or use another feedback type.');return{cancel:function(){}};}
 onReq();
 var displayStream=null,micStream=null,recorder=null,chunks=[],timer=null,startTs=0,stopped=false;
 function cleanup(){stopped=true;if(timer){try{clearInterval(timer);}catch(_){}timer=null;}if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch(_){}}}
 function failDenied(m){cleanup();stopTracks(displayStream);stopTracks(micStream);onDenied(m||'Permission denied');}
 function failError(m){cleanup();stopTracks(displayStream);stopTracks(micStream);onError(m||'Recording failed');}
 chooseCaptureStream(navigator.mediaDevices).then(function(stream){
  displayStream=stream;
  var v=validateIsCurrentTab(stream);
  if(!v.ok){
    stopTracks(stream);
    onUnsupported('Recording this tab isn\u2019t supported in this browser — upload a video instead. ('+v.reason+')');
    return;
  }
  stream.getTracks().forEach(function(t){t.addEventListener('ended',function(){if(!stopped){try{if(recorder&&recorder.state==='recording')recorder.stop();}catch(_){}if(!recorder||recorder.state!=='recording'){stopTracks(displayStream);stopTracks(micStream);onDenied('Recording ended');}}});});
  function startRecorder(finalStream){
   var recMime=mime;
   try{recorder=new MediaRecorder(finalStream,{mimeType:mime});}catch(_){try{recorder=new MediaRecorder(finalStream);recMime=recorder.mimeType||mime;}catch(e){failError('Cannot start recorder');return;}}
   chunks=[];
   recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
   recorder.onerror=function(){failError('Recording error');};
   recorder.onstop=function(){
    if(timer){try{clearInterval(timer);}catch(_){}timer=null;}
    if(!chunks.length){stopTracks(displayStream);stopTracks(micStream);onError('Recording was empty — try again');return;}
    var blob=new Blob(chunks,{type:recMime});
    if(!blob.size){stopTracks(displayStream);stopTracks(micStream);onError('Recording was empty — try again');return;}
    if(blob.size>25*1024*1024){stopTracks(displayStream);stopTracks(micStream);onError('Video too large (max 25MB)');return;}
    var durMs=Date.now()-startTs;
    if(durMs>61000){stopTracks(displayStream);stopTracks(micStream);onError('Video too long — max 60s');return;}
    var ext=recMime.indexOf('mp4')!==-1?'.mp4':'.webm';
    var file;try{file=new File([blob],'recording'+ext,{type:recMime});}catch(_){blob.name='recording'+ext;file=blob;}
    var url='';try{url=URL.createObjectURL(file);}catch(_){}
    stopTracks(displayStream);stopTracks(micStream);
    onPreview(file,url,recMime,durMs);
   };
   try{recorder.start(200);}catch(e){failError('Cannot start recorder');return;}
   startTs=Date.now();
   onRec(finalStream,recorder,0);
   timer=setInterval(function(){var elapsed=Date.now()-startTs;if(elapsed>=60000){try{if(recorder&&recorder.state==='recording')recorder.stop();}catch(_){}try{clearInterval(timer);}catch(_){}timer=null;}else{onTick(elapsed);}},200);
  }
  if(mic){
   if(!navigator.mediaDevices.getUserMedia){
    cleanup();stopTracks(displayStream);stopTracks(micStream);
    onDenied('Microphone unavailable — you can retry, continue without microphone, or upload a video instead.');
    return;
   }
   navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(ms){
    micStream=ms;
    try{var at=ms.getAudioTracks()[0];if(at)displayStream.addTrack(at);}catch(_){}
    startRecorder(displayStream);
   }).catch(function(err){
    var n=(err&&err.name)||'';
    var isDenied=n==='NotAllowedError'||n==='PermissionDeniedError'||n==='SecurityError'||n==='AbortError';
    var msg=isDenied?'Microphone permission denied — you can retry, continue without microphone, or upload a video instead.':'Microphone failed — you can retry, continue without microphone, or upload a video instead.';
    cleanup();stopTracks(displayStream);stopTracks(micStream);onDenied(msg);
   });
  }else{startRecorder(displayStream);}
 }).catch(function(err){
  var n=(err&&err.name)||'';
  if(n==='NotAllowedError'||n==='AbortError'||n==='SecurityError')failDenied('Permission denied — you can retry or upload a video instead.');
  else if(n==='NotSupportedError'||n==='TypeError')onUnsupported('Screen recording not supported on this device — you can still upload a video file or use another feedback type.');
  else if(n==='NotFoundError')onUnsupported('Screen recording not supported on this device — you can still upload a video file or use another feedback type.');
  else failDenied('Permission denied — you can retry or upload a video instead.');
 });
 return{stop:function(){try{if(recorder&&recorder.state==='recording')recorder.stop();}catch(_){}},cancel:function(){cleanup();stopTracks(displayStream);stopTracks(micStream);}};
}
window.__bugaputaVideoCapture={CANDIDATES:CANDIDATES,getSupportedMime:getSupportedMime,stopTracks:stopTracks,startSession:startSession,chooseCaptureStream:chooseCaptureStream,validateIsCurrentTab:validateIsCurrentTab, _getCaptureToken:function(){return __bugaputaCaptureToken;}};
})();

// Live video workspace: shared annotation workspace for recording (brief #1, plan SS7)
// Document-relative vector layer via getDocPoint, RAF, nested scroll compensation
(function(){
var __liveActive=false, __liveState=null, __ctx=null;
function isLiveActive(){ return __liveActive; }
function openLive(ctx){
  __ctx=ctx||{};
  var getDocPoint=__ctx.getDocPoint||function(e){return {x:(e.clientX||0)+(window.scrollX||0),y:(e.clientY||0)+(window.scrollY||0)};};
  var fmtVideoTime=__ctx.fmtVideoTime||function(ms){var s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
  var ensureHalo=__ctx.ensureHalo||function(){}, movePointerHalo=__ctx.movePointerHalo||function(){}, haloClickRipple=__ctx.haloClickRipple||function(){}, hidePointerHalo=__ctx.hidePointerHalo||function(){};
  var renderVideoPreview=__ctx.renderVideoPreview||function(){}, renderVideoDenied=__ctx.renderVideoDenied||function(){}, renderVideoUnsupported=__ctx.renderVideoUnsupported||function(){}, renderVideoRecovery=__ctx.renderVideoRecovery||function(){};
  function h(tag,attrs,children){var el=document.createElement(tag); if(attrs) Object.keys(attrs).forEach(function(k){ if(k==='class') el.className=attrs[k]; else if(k==='text') el.textContent=attrs[k]; else if(k==='html') el.innerHTML=attrs[k]; else el.setAttribute(k,attrs[k]); }); if(children) (Array.isArray(children)?children:[children]).forEach(function(c){ if(c) el.appendChild(typeof c==='string'?document.createTextNode(c):c); }); return el; }
  var overlay=document.getElementById('bugaputa-overlay');
  __liveActive=true; try{ if(window.__bugaputaLiveActiveSetter) window.__bugaputaLiveActiveSetter(true);}catch(_){}
  if(overlay) overlay.style.display='none';
  document.body.style.overflow='hidden';
  var ex=document.getElementById('bugaputa-live-video'); if(ex) ex.remove();
  var et=document.getElementById('bugaputa-live-toolbar'); if(et) et.remove();
  var W=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth||0,window.innerWidth);
  var H=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight||0,window.innerHeight);
  var wrap=h('div',{id:'bugaputa-live-video'}); wrap.style.width=W+'px'; wrap.style.height=H+'px';
  var cvs=document.createElement('canvas'); cvs.id='bugaputa-live-canvas'; cvs.width=W; cvs.height=H; cvs.style.cssText='position:absolute;left:0;top:0;pointer-events:auto';
  wrap.appendChild(cvs); document.body.appendChild(wrap);
  var tb=h('div',{id:'bugaputa-live-toolbar',role:'toolbar','aria-label':'Recording tools'});
  var drag=h('div',{id:'bugaputa-ann-drag',title:'Drag'}); drag.textContent='\u2637'; drag.style.cursor='grab';
  var rec=h('button',{id:'bugaputa-live-record',type:'button',text:'Record','aria-label':'Record'}), cnt=h('span',{id:'bugaputa-live-countdown',style:'display:none;font-weight:700'}), tim=h('span',{id:'bugaputa-live-timer',style:'display:none'}), stp=h('button',{id:'bugaputa-live-stop',type:'button',text:'Stop','aria-label':'Stop recording',style:'display:none'}), mic=h('button',{id:'bugaputa-live-mic',type:'button',text:'Mic off','aria-pressed':'false',title:'Mic off by default'});
  var tools=['select','pen','arrow','rect','text'], btns={};
  tools.forEach(function(id){ var b=h('button',{type:'button','aria-label':id,title:id}); b.textContent=id==='select'?'Hand':id; b.dataset.tool=id; b.style.cssText='min-width:44px;min-height:44px'; b.addEventListener('click',function(){ __liveState.tool=id; Object.keys(btns).forEach(function(k){ btns[k].setAttribute('aria-pressed',k===id?'true':'false'); btns[k].style.background=k===id?'#a3e635':'#fff'; }); cvs.style.cursor=id==='select'?'default':'crosshair'; updatePointer(); }); btns[id]=b; tb.appendChild(b); });
  var undo=h('button',{type:'button',text:'Undo','aria-label':'Undo'}), redo=h('button',{type:'button',text:'Redo','aria-label':'Redo'}), del=h('button',{type:'button',text:'Del','aria-label':'Delete selected'}), clr=h('button',{type:'button',text:'Clear','aria-label':'Clear all'}), done=h('button',{type:'button',text:'Done','aria-label':'Done'}), cancel=h('button',{type:'button',text:'Cancel','aria-label':'Cancel'});
  [undo,redo,del,clr,done,cancel].forEach(function(b){ b.style.cssText='min-width:44px;min-height:44px'; });
  tb.appendChild(drag); tb.appendChild(rec); tb.appendChild(cnt); tb.appendChild(tim); tb.appendChild(stp); tb.appendChild(mic); tb.appendChild(undo); tb.appendChild(redo); tb.appendChild(del); tb.appendChild(clr); tb.appendChild(done); tb.appendChild(cancel); document.body.appendChild(tb);
  (function(){ var sx=0,sy=0,ox=0,oy=0,dg=false; drag.addEventListener('pointerdown',function(e){ dg=true; drag.setPointerCapture(e.pointerId); sx=e.clientX; sy=e.clientY; var r=tb.getBoundingClientRect(); ox=r.left; oy=r.top; drag.style.cursor='grabbing'; tb.setAttribute('aria-grabbed','true'); e.preventDefault(); }); drag.addEventListener('pointermove',function(e){ if(!dg) return; var nx=ox+(e.clientX-sx), ny=oy+(e.clientY-sy); nx=Math.max(8,Math.min(window.innerWidth-tb.offsetWidth-8,nx)); ny=Math.max(8,Math.min(window.innerHeight-tb.offsetHeight-8,ny)); tb.style.left=nx+'px'; tb.style.right='auto'; tb.style.bottom='auto'; tb.style.top=ny+'px'; tb.style.transform='none'; }); function up(e){ dg=false; drag.style.cursor='grab'; tb.removeAttribute('aria-grabbed'); try{drag.releasePointerCapture(e.pointerId);}catch(_){} } drag.addEventListener('pointerup',up); drag.addEventListener('pointercancel',up); })();
  __liveState={tool:'pen',color:'#ef4444',annotations:[],selectedId:null,undoStack:[],redoStack:[],nextPin:1};
  var PALETTE=['#ef4444','#f59e0b','#22c55e','#3b82f6','#ec4899'];
  var paletteWrap=h('div',{style:'display:flex;gap:4px;align-items:center'});
  PALETTE.forEach(function(c){
    var b=h('button',{type:'button','aria-label':'Color '+c, title:'Color '+c});
    b.style.background=c; b.style.width='28px'; b.style.height='28px'; b.style.borderRadius='999px'; b.style.border='2px solid transparent'; b.style.cursor='pointer';
    b.style.minWidth='28px'; b.style.minHeight='28px';
    if(c===__liveState.color) b.style.borderColor='#0f172a';
    b.addEventListener('click', function(){ __liveState.color=c; Array.prototype.slice.call(paletteWrap.children).forEach(function(ch){ ch.style.borderColor='transparent'; }); b.style.borderColor='#0f172a'; });
    paletteWrap.appendChild(b);
  });
  // Insert palette after tools, before undo group
  tb.insertBefore(paletteWrap, undo);
  function pushU(){ __liveState.undoStack.push(JSON.stringify(__liveState.annotations)); if(__liveState.undoStack.length>40) __liveState.undoStack.shift(); __liveState.redoStack=[]; }
  function doUndo(){ if(!__liveState.undoStack.length) return; __liveState.redoStack.push(JSON.stringify(__liveState.annotations)); __liveState.annotations=JSON.parse(__liveState.undoStack.pop()); __liveState.selectedId=null; draw(); }
  function doRedo(){ if(!__liveState.redoStack.length) return; __liveState.undoStack.push(JSON.stringify(__liveState.annotations)); __liveState.annotations=JSON.parse(__liveState.redoStack.pop()); __liveState.selectedId=null; draw(); }
  undo.addEventListener('click',doUndo); redo.addEventListener('click',doRedo); del.addEventListener('click',function(){ if(!__liveState.selectedId) return; pushU(); __liveState.annotations=__liveState.annotations.filter(function(a){return a.id!==__liveState.selectedId;}); __liveState.selectedId=null; draw(); }); clr.addEventListener('click',function(){ if(!__liveState.annotations.length) return; if(!confirm('Clear?')) return; pushU(); __liveState.annotations=[]; __liveState.selectedId=null; draw(); });
  var ctx=cvs.getContext('2d'), raf=0; function draw(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; ctx.clearRect(0,0,W,H); __liveState.annotations.forEach(function(a){ ctx.save(); ctx.strokeStyle=a.color; ctx.fillStyle=a.color; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round'; if(a.type==='rect') ctx.strokeRect(Math.min(a.x,a.x2),Math.min(a.y,a.y2),Math.abs(a.x2-a.x),Math.abs(a.y2-a.y)); else if(a.type==='arrow'){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(a.x2,a.y2); ctx.stroke(); var ang=Math.atan2(a.y2-a.y,a.x2-a.x),L=14; ctx.beginPath(); ctx.moveTo(a.x2,a.y2); ctx.lineTo(a.x2-L*Math.cos(ang-Math.PI/6),a.y2-L*Math.sin(ang-Math.PI/6)); ctx.lineTo(a.x2-L*Math.cos(ang+Math.PI/6),a.y2-L*Math.sin(ang+Math.PI/6)); ctx.closePath(); ctx.fill(); } else if(a.type==='pen'&&a.points.length>=2){ ctx.beginPath(); ctx.moveTo(a.points[0][0],a.points[0][1]); for(var i=1;i<a.points.length;i++) ctx.lineTo(a.points[i][0],a.points[i][1]); ctx.stroke(); } else if(a.type==='text'){ ctx.font='14px Inter,system-ui'; ctx.fillText(a.text||'',a.x,a.y); } ctx.restore(); }); }); }
  var ro=null;
  var onScroll=function(){ draw(); }; window.addEventListener('scroll',onScroll,{passive:true});
  function updatePointer(){
    var isSel=__liveState.tool==='select';
    cvs.style.pointerEvents=isSel?'none':'auto';
    if(isSel){
      // Pointer mode allows normal page interaction and preserves wheel/trackpad scrolling
      cvs.style.touchAction='pan-x pan-y';
    } else {
      cvs.style.touchAction='none';
    }
  }
  updatePointer();
  var drawing=null,isDown=false;
  cvs.addEventListener('pointerdown',function(e){ var pt=getDocPoint(e); if(__liveState.tool==='select'){ var hit=null; for(var i=__liveState.annotations.length-1;i>=0;i--){ var a=__liveState.annotations[i]; if(a.type==='rect'&&pt.x>=Math.min(a.x,a.x2)&&pt.x<=Math.max(a.x,a.x2)&&pt.y>=Math.min(a.y,a.y2)&&pt.y<=Math.max(a.y,a.y2)){ hit=a; break; } if(a.type==='pen') for(var p=0;p<a.points.length;p++) if(Math.hypot(a.points[p][0]-pt.x,a.points[p][1]-pt.y)<14){ hit=a; break; } if(hit) break; } if(hit) __liveState.selectedId=hit.id; else __liveState.selectedId=null; draw(); return; } if(__liveState.tool==='text'){ var t=prompt('Enter text:',''); if(t===null) return; t=String(t).slice(0,200); if(!t.trim()) return; pushU(); __liveState.annotations.push({id:'a_'+Math.random().toString(36).slice(2,9),type:'text',x:pt.x,y:pt.y,text:t,color:__liveState.color}); draw(); return; } pushU(); isDown=true; try{cvs.setPointerCapture(e.pointerId);}catch(_){} if(__liveState.tool==='pen') drawing={id:'a_'+Math.random().toString(36).slice(2,9),type:'pen',color:__liveState.color,points:[[pt.x,pt.y]]}; else if(__liveState.tool==='rect') drawing={id:'a_'+Math.random().toString(36).slice(2,9),type:'rect',color:__liveState.color,x:pt.x,y:pt.y,x2:pt.x,y2:pt.y}; else if(__liveState.tool==='arrow') drawing={id:'a_'+Math.random().toString(36).slice(2,9),type:'arrow',color:__liveState.color,x:pt.x,y:pt.y,x2:pt.x,y2:pt.y}; if(drawing) __liveState.annotations.push(drawing); draw(); });
  cvs.addEventListener('pointermove',function(e){ if(!isDown||!drawing) return; var pt=getDocPoint(e); if(drawing.type==='pen') drawing.points.push([pt.x,pt.y]); else{ drawing.x2=pt.x; drawing.y2=pt.y; } draw(); });
  function endLive(e){ if(!isDown) return; isDown=false; if(drawing&&((drawing.type==='rect'||drawing.type==='arrow')&&Math.hypot(drawing.x2-drawing.x,drawing.y2-drawing.y)<6)) __liveState.annotations=__liveState.annotations.filter(function(a){return a.id!==drawing.id;}); else if(drawing) __liveState.selectedId=drawing.id; drawing=null; draw(); try{cvs.releasePointerCapture(e.pointerId);}catch(_){} }
  cvs.addEventListener('pointerup',endLive); cvs.addEventListener('pointercancel',endLive);
  var cdTimer=null; rec.addEventListener('click',function(){ if(rec.disabled) return; var s=3; rec.style.display='none'; cnt.style.display=''; cnt.textContent=String(s); var iv=setInterval(function(){ s--; if(s<=0){ clearInterval(iv); cdTimer=null; cnt.style.display='none'; startLiveRec(); } else cnt.textContent=String(s); },1000); cdTimer=iv; cnt.addEventListener('click',function h(){ clearInterval(iv); cdTimer=null; cnt.style.display='none'; rec.style.display=''; cnt.removeEventListener('click',h); }); var esc=function(e){ if(e.key==='Escape'){ clearInterval(iv); cdTimer=null; cnt.style.display='none'; rec.style.display=''; document.removeEventListener('keydown',esc); }}; document.addEventListener('keydown',esc); setTimeout(function(){ document.removeEventListener('keydown',esc); },4000); });
  mic.addEventListener('click',function(){ var on=mic.getAttribute('aria-pressed')==='true'; mic.setAttribute('aria-pressed',on?'false':'true'); mic.textContent=on?'Mic off':'Mic on'; });
  function startLiveRec(){ var micOn=mic.getAttribute('aria-pressed')==='true'; tim.style.display=''; tim.textContent='00:00 / 01:00'; rec.style.display='none'; stp.style.display=''; cnt.style.display='none'; try{ensureHalo(); document.addEventListener('pointermove',movePointerHalo); document.addEventListener('click',haloClickRipple);}catch(_){} var vc=window.__bugaputaVideoCapture; if(!vc){ tim.textContent='Load failed'; return; } window.__bugaputaActiveVideoSession=vc.startSession({micEnabled:micOn,onRequesting:function(){ tim.textContent='Waiting for permission\u2026'; },onRecording:function(){},onTick:function(e){ try{ if(window.__bugaputaVideoLive) window.__bugaputaVideoLive._elapsed=e; }catch(_){} tim.textContent=fmtVideoTime(e)+' / 01:00'; },onPreview:function(f,u,m,d){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); stp.style.display='none'; closeLive(); renderVideoPreview(f,u,m,d); },onDenied:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoDenied(msg); },onUnsupported:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoUnsupported(msg); },onError:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoRecovery(msg); }}); }
  stp.addEventListener('click',function(){ try{ if(window.__bugaputaActiveVideoSession&&window.__bugaputaActiveVideoSession.stop) window.__bugaputaActiveVideoSession.stop(); }catch(_){} try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); });
  cancel.addEventListener('click',function(){ closeLive(); var ov=document.getElementById('bugaputa-overlay'); if(ov){ ov.style.display='flex'; var ch=document.getElementById('bugaputa-chooser'); if(ch) ch.style.display='block'; }});
  done.addEventListener('click',function(){ closeLive(); var ov=document.getElementById('bugaputa-overlay'); if(ov){ ov.style.display='flex'; var ch=document.getElementById('bugaputa-chooser'); if(ch) ch.style.display='block'; }});
  function closeLive(){ __liveActive=false; try{ if(window.__bugaputaLiveActiveSetter) window.__bugaputaLiveActiveSetter(false);}catch(_){} try{ if(ro) ro.disconnect();}catch(_){} window.removeEventListener('scroll',onScroll); try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); var w=document.getElementById('bugaputa-live-video'); if(w) w.remove(); var t=document.getElementById('bugaputa-live-toolbar'); if(t) t.remove(); document.body.style.overflow=''; }
  window.__bugaputaCloseLiveWorkspace=closeLive;
}
window.__bugaputaVideoLive={open:openLive, isActive:isLiveActive, close:function(){ try{ if(window.__bugaputaCloseLiveWorkspace) window.__bugaputaCloseLiveWorkspace(); }catch(_){} }, _elapsed:0};
})();

