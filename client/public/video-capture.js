(function(){
/* Privacy: current-tab-only (Capture Handle token). Enter≠request; Record=request. Prefer getViewportMedia else getDisplayMedia {preferCurrentTab,selfBrowserSurface,surfaceSwitching,monitorTypeSurfaces,systemAudio,displaySurface:browser,audio:false} + validate displaySurface+handle else fallback. Hints alone cannot legally constrain the browser. See docs/spike/2026-09-15-viewport-vs-displaymedia.md. */
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

// Live workspace: doc-relative via getDocPoint, RAF
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
// Live workspace must NOT hide body overflow: brief #8 - restores original overflow so
// normal wheel/trackpad/touch scroll works (programmatic scrollTo already worked; this
// unlocks real user input). Hand (select) uses pointerEvents none + touchAction pan-x pan-y
// to let wheel/touch reach the document; draw modes keep wheel bubbling (no preventDefault)
// and rely on this restore. After drawing, one-tap Hand restores wheel scroll.
try{ document.body.style.overflow=(overlay&&overlay._prevOverflow!=null?overlay._prevOverflow:''); }catch(_){}
var ex=document.getElementById('bugaputa-live-video'); if(ex) ex.remove();
var et=document.getElementById('bugaputa-live-toolbar'); if(et) et.remove();
var W=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth||0,window.innerWidth);
var H=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight||0,window.innerHeight);
var wrap=h('div',{id:'bugaputa-live-video'}); wrap.style.width=W+'px'; wrap.style.height=H+'px';
var cvs=document.createElement('canvas'); cvs.id='bugaputa-live-canvas'; cvs.width=W; cvs.height=H; cvs.style.cssText='position:absolute;left:0;top:0;pointer-events:auto';
wrap.appendChild(cvs); document.body.appendChild(wrap);
var tb=h('div',{id:'bugaputa-live-toolbar',role:'toolbar','aria-label':'Recording tools'});
var drag=h('div',{id:'bugaputa-ann-drag',title:'Drag'}); drag.textContent='\u2637'; drag.style.cursor='grab';
var _micOff='<svg class="bugaputa-live-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 19v4"/><path d="M8 23h8"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',_micOn='<svg class="bugaputa-live-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 19v4"/><path d="M8 23h8"/></svg>';var rec=h('button',{id:'bugaputa-live-record',type:'button','aria-label':'Record',title:'Record',html:'<svg class="bugaputa-live-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg><span style="margin-left:6px">Record</span>'}), cnt=h('span',{id:'bugaputa-live-countdown',style:'display:none;font-weight:700'}), tim=h('span',{id:'bugaputa-live-timer',style:'display:none'}), stp=h('button',{id:'bugaputa-live-stop',type:'button','aria-label':'Stop recording',title:'Stop',html:'<svg class="bugaputa-live-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor"/></svg><span style="margin-left:6px">Stop</span>',style:'display:none'}), mic=h('button',{id:'bugaputa-live-mic',type:'button','aria-pressed':'false','aria-label':'Microphone off',title:'Microphone off',html:_micOff});
var _svgP='<svg class="bugaputa-live-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',_svgS='</svg>';var _ico={select:_svgP+'<path d="M5 3l14 9-7 1-3 7z"/><path d="M12 13l-3 7"/>'+_svgS,pen:_svgP+'<path d="M17 3a2.8 2.8 0 0 1 4 4L7 21l-4 1 1-4z"/><path d="M15 5l4 4"/>'+_svgS,arrow:_svgP+'<path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>'+_svgS,rect:_svgP+'<rect x="3" y="3" width="18" height="18" rx="2"/>'+_svgS,text:_svgP+'<path d="M4 5h10v2H9v9H7v-9H4z"/><rect x="10" y="13" width="7" height="2" rx="0.5"/>'+_svgS};
var _labels={select:'Hand',pen:'Pen',arrow:'Arrow',rect:'Rect',text:'Text'};
function _sep(){var s=document.createElement('span');s.className='bugaputa-live-sep';s.setAttribute('aria-hidden','true');return s}
var tools=['select','pen','arrow','rect','text'], btns={};
tools.forEach(function(id){ var b=h('button',{type:'button','aria-label':_labels[id],title:_labels[id],html:_ico[id]}); b.dataset.tool=id; b.style.cssText='min-width:44px;min-height:44px'; b.addEventListener('click',function(){ __liveState.tool=id; Object.keys(btns).forEach(function(k){ var on=k===id; btns[k].setAttribute('aria-pressed',on?'true':'false'); }); cvs.style.cursor=id==='select'?'default':'crosshair'; updatePointer(); }); btns[id]=b; tb.appendChild(b); });
var undo=h('button',{type:'button','aria-label':'Undo',title:'Undo',html:_svgP+'<path d="M9 8H5v5"/><path d="M13 10H5a6 6 0 1 1 2.2-4.6"/><path d="M5 8l-2 2 2 2" fill="currentColor" stroke="none"/>'+_svgS}), redo=h('button',{type:'button','aria-label':'Redo',title:'Redo',html:_svgP+'<path d="M15 8h4v5"/><path d="M11 10h8a6 6 0 1 0-2.2-4.6"/><path d="M19 8l2 2-2 2" fill="currentColor" stroke="none"/>'+_svgS}), del=h('button',{type:'button','aria-label':'Delete selected',title:'Delete selected',html:_svgP+'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'+_svgS}), clr=h('button',{type:'button','aria-label':'Clear all annotations',title:'Clear all annotations',html:_svgP+'<path d="M3 6h18"/><path d="M19 6l-1 14H6L5 6"/><path d="M2 18h20l-3 3H5z" fill="currentColor" stroke="none" opacity="0.9"/>'+_svgS}), done=h('button',{type:'button','aria-label':'Done',title:'Done',html:'Done'}), cancel=h('button',{type:'button','aria-label':'Cancel',title:'Cancel',html:'Cancel'});
try{ btns.select.setAttribute('aria-pressed','true'); Object.keys(btns).forEach(function(k){ if(k!=='select') btns[k].setAttribute('aria-pressed','false'); }); }catch(_){}
[undo,redo,del,clr].forEach(function(b){ b.style.cssText='min-width:44px;min-height:44px'; });
done.style.cssText='min-width:44px;min-height:44px'; cancel.style.cssText='min-width:44px;min-height:44px';
done.className='bugaputa-live-primary'; cancel.className='';
del.classList.add('bugaputa-live-danger');
tb.appendChild(_sep()); tb.appendChild(undo); tb.appendChild(redo); tb.appendChild(del); tb.appendChild(clr);
var ob=h('button',{id:'bugaputa-live-overflow',type:'button','aria-label':'More tools','aria-expanded':'false',title:'More',html:'&#8230;'}); ob.addEventListener('click',function(){ var on=ob.getAttribute('aria-expanded')==='true'; ob.setAttribute('aria-expanded',on?'false':'true'); if(!on) tb.scrollTo({left:tb.scrollWidth,behavior:'smooth'}); else tb.scrollTo({left:0,behavior:'smooth'}); });
tb.appendChild(_sep()); tb.appendChild(drag); tb.appendChild(rec); tb.appendChild(cnt); tb.appendChild(tim); tb.appendChild(stp); tb.appendChild(mic); tb.appendChild(_sep()); tb.appendChild(done); tb.appendChild(cancel); tb.appendChild(ob); document.body.appendChild(tb);
function so(){ try{ ob.style.display=tb.scrollWidth>tb.clientWidth+8?'':'none'; }catch(_){} }
setTimeout(so,80); try{ window.addEventListener('resize',so,{passive:true}); }catch(_){}
(function(){ var sx=0,sy=0,ox=0,oy=0,dg=false; drag.addEventListener('pointerdown',function(e){ dg=true; drag.setPointerCapture(e.pointerId); sx=e.clientX; sy=e.clientY; var r=tb.getBoundingClientRect(); ox=r.left; oy=r.top; drag.style.cursor='grabbing'; tb.setAttribute('aria-grabbed','true'); e.preventDefault(); }); drag.addEventListener('pointermove',function(e){ if(!dg) return; var nx=ox+(e.clientX-sx), ny=oy+(e.clientY-sy); nx=Math.max(8,Math.min(window.innerWidth-tb.offsetWidth-8,nx)); ny=Math.max(8,Math.min(window.innerHeight-tb.offsetHeight-8,ny)); tb.style.left=nx+'px'; tb.style.right='auto'; tb.style.bottom='auto'; tb.style.top=ny+'px'; tb.style.transform='none'; }); function up(e){ dg=false; drag.style.cursor='grab'; tb.removeAttribute('aria-grabbed'); try{drag.releasePointerCapture(e.pointerId);}catch(_){} } drag.addEventListener('pointerup',up); drag.addEventListener('pointercancel',up); })();
__liveState={tool:'select',color:'#ef4444',annotations:[],selectedId:null,undoStack:[],redoStack:[],nextPin:1};
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
undo.addEventListener('click',doUndo); redo.addEventListener('click',doRedo); del.addEventListener('click',function(){ if(!__liveState.selectedId) return; pushU(); __liveState.annotations=__liveState.annotations.filter(function(a){return a.id!==__liveState.selectedId;}); __liveState.selectedId=null; draw(); }); clr.addEventListener('click',function(){ if(!__liveState.annotations.length) return; if(!confirm('Clear all annotations?')) return; pushU(); __liveState.annotations=[]; __liveState.selectedId=null; draw(); });
var ctx=cvs.getContext('2d'), raf=0; function draw(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; ctx.clearRect(0,0,W,H); __liveState.annotations.forEach(function(a){ ctx.save(); ctx.strokeStyle=a.color; ctx.fillStyle=a.color; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round'; if(a.type==='rect') ctx.strokeRect(Math.min(a.x,a.x2),Math.min(a.y,a.y2),Math.abs(a.x2-a.x),Math.abs(a.y2-a.y)); else if(a.type==='arrow'){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(a.x2,a.y2); ctx.stroke(); var ang=Math.atan2(a.y2-a.y,a.x2-a.x),L=14; ctx.beginPath(); ctx.moveTo(a.x2,a.y2); ctx.lineTo(a.x2-L*Math.cos(ang-Math.PI/6),a.y2-L*Math.sin(ang-Math.PI/6)); ctx.lineTo(a.x2-L*Math.cos(ang+Math.PI/6),a.y2-L*Math.sin(ang+Math.PI/6)); ctx.closePath(); ctx.fill(); } else if(a.type==='pen'&&a.points.length>=2){ ctx.beginPath(); ctx.moveTo(a.points[0][0],a.points[0][1]); for(var i=1;i<a.points.length;i++) ctx.lineTo(a.points[i][0],a.points[i][1]); ctx.stroke(); } else if(a.type==='text'){ ctx.font='14px Inter,system-ui'; ctx.fillText(a.text||'',a.x,a.y); } ctx.restore(); }); }); }
// W/H doc-sized via scrollWidth/scrollHeight
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
mic.addEventListener('click',function(){ var on=mic.getAttribute('aria-pressed')==='true'; var next=!on; mic.setAttribute('aria-pressed',next?'true':'false'); mic.setAttribute('aria-label',next?'Microphone on':'Microphone off'); mic.setAttribute('title',next?'Microphone on':'Microphone off'); mic.innerHTML=next?_micOn:_micOff; if(next) mic.classList.add('bugaputa-live-mic-on'); else mic.classList.remove('bugaputa-live-mic-on'); });
function startLiveRec(){ var micOn=mic.getAttribute('aria-pressed')==='true'; tim.style.display=''; tim.textContent='00:00 / 01:00'; rec.style.display='none'; stp.style.display=''; cnt.style.display='none'; try{ensureHalo(); document.addEventListener('pointermove',movePointerHalo); document.addEventListener('click',haloClickRipple);}catch(_){} var vc=window.__bugaputaVideoCapture; if(!vc){ tim.textContent='Load failed'; return; } window.__bugaputaActiveVideoSession=vc.startSession({micEnabled:micOn,onRequesting:function(){ tim.textContent='Waiting for permission\u2026'; },onRecording:function(){},onTick:function(e){ try{ if(window.__bugaputaVideoLive) window.__bugaputaVideoLive._elapsed=e; }catch(_){} tim.textContent=fmtVideoTime(e)+' / 01:00'; },onPreview:function(f,u,m,d){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); stp.style.display='none'; closeLive(); renderVideoPreview(f,u,m,d); },onDenied:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoDenied(msg); },onUnsupported:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoUnsupported(msg); },onError:function(msg){ try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); tim.style.display='none'; stp.style.display='none'; rec.style.display=''; renderVideoRecovery(msg); }}); }
stp.addEventListener('click',function(){ try{ if(window.__bugaputaActiveVideoSession&&window.__bugaputaActiveVideoSession.stop) window.__bugaputaActiveVideoSession.stop(); }catch(_){} try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); });
cancel.addEventListener('click',function(){ closeLive(); var ov=document.getElementById('bugaputa-overlay'); if(ov){ ov.style.display='flex'; var ch=document.getElementById('bugaputa-chooser'); if(ch) ch.style.display='block'; }});
done.addEventListener('click',function(){ closeLive(); var ov=document.getElementById('bugaputa-overlay'); if(ov){ ov.style.display='flex'; var ch=document.getElementById('bugaputa-chooser'); if(ch) ch.style.display='block'; }});
function closeLive(){ __liveActive=false; try{ if(window.__bugaputaLiveActiveSetter) window.__bugaputaLiveActiveSetter(false);}catch(_){} window.removeEventListener('scroll',onScroll); try{document.removeEventListener('pointermove',movePointerHalo);}catch(_){} hidePointerHalo(); var w=document.getElementById('bugaputa-live-video'); if(w) w.remove(); var t=document.getElementById('bugaputa-live-toolbar'); if(t) t.remove(); }
window.__bugaputaCloseLiveWorkspace=closeLive;
}
window.__bugaputaVideoLive={open:openLive, isActive:isLiveActive, close:function(){ try{ if(window.__bugaputaCloseLiveWorkspace) window.__bugaputaCloseLiveWorkspace(); }catch(_){} }, _elapsed:0};
})();
