(function(){
/*
 * Privacy contract: current-tab-only capture
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
function chooseCaptureStream(md){
  // Returns Promise<MediaStream>. Tries getViewportMedia first, else getDisplayMedia with strongest hints.
  if(md && typeof md.getViewportMedia==='function'){
    try{ return md.getViewportMedia({video:{displaySurface:'browser'}, audio:false}); }catch(e){ /* fall through to gDM */ }
  }
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
      // Chrome verifiable path: explicit browser surface -> ok (handle optional)
      var handle=null; try{ if(t.getCaptureHandle) handle=t.getCaptureHandle(); }catch(_){}
      if(handle){ var origin=(handle.origin||handle.handleOrigin||''); if(origin && origin!==location.origin) return {ok:false, reason:'handle origin mismatch'}; }
      return {ok:true};
    }
    var handle2=null;
    try{ if(t.getCaptureHandle) handle2=t.getCaptureHandle(); }catch(_){}
    if(handle2!==null && handle2!==undefined){
      var origin2=(handle2.origin||handle2.handleOrigin||'');
      if(origin2 && origin2!==location.origin) return {ok:false, reason:'handle origin mismatch'};
      return {ok:true};
    }
    if(!settings || typeof settings.displaySurface!=='string'){
      return {ok:false, reason:'cannot verify current-tab-only capture on this browser — upload fallback'};
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
window.__bugaputaVideoCapture={CANDIDATES:CANDIDATES,getSupportedMime:getSupportedMime,stopTracks:stopTracks,startSession:startSession,chooseCaptureStream:chooseCaptureStream,validateIsCurrentTab:validateIsCurrentTab};
})();
