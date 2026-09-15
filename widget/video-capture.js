(function(){
var CANDIDATES=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=av1,opus','video/webm','video/mp4;codecs=h264,aac','video/mp4'];
function getSupportedMime(){try{if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported)return'';for(var i=0;i<CANDIDATES.length;i++){try{if(MediaRecorder.isTypeSupported(CANDIDATES[i]))return CANDIDATES[i];}catch(_){}}}catch(_){}return'';}
function stopTracks(s){try{if(s)s.getTracks().forEach(function(t){try{t.stop();}catch(_){}});}catch(_){}}
function startSession(opts){
 var mic=!!opts.micEnabled;
 var onReq=opts.onRequesting||function(){},onRec=opts.onRecording||function(){},onTick=opts.onTick||function(){},onPreview=opts.onPreview||function(){},onDenied=opts.onDenied||function(){},onUnsupported=opts.onUnsupported||function(){},onError=opts.onError||function(){};
 if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){onUnsupported('Screen recording not supported on this device');return{cancel:function(){}};}
 var mime=getSupportedMime();
 if(!mime){onUnsupported('Screen recording not supported on this device');return{cancel:function(){}};}
 onReq();
 var displayStream=null,micStream=null,recorder=null,chunks=[],timer=null,startTs=0,stopped=false;
 function cleanup(){stopped=true;if(timer){try{clearInterval(timer);}catch(_){}timer=null;}if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch(_){}}}
 function failDenied(m){cleanup();stopTracks(displayStream);stopTracks(micStream);onDenied(m||'Permission denied');}
 function failError(m){cleanup();stopTracks(displayStream);stopTracks(micStream);onError(m||'Recording failed');}
 var gdmOpts={video:{displaySurface:'browser'},audio:mic};
 navigator.mediaDevices.getDisplayMedia(gdmOpts).then(function(stream){
  displayStream=stream;
  stream.getTracks().forEach(function(t){t.addEventListener('ended',function(){if(!stopped){try{if(recorder&&recorder.state==='recording')recorder.stop();}catch(_){}if(!recorder||recorder.state!=='recording'){stopTracks(displayStream);stopTracks(micStream);onDenied('Recording ended');}}});});
  var hasAudio=false;try{hasAudio=stream.getAudioTracks().length>0;}catch(_){}
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
  if(mic&&!hasAudio&&navigator.mediaDevices.getUserMedia){
   navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(ms){micStream=ms;try{var at=ms.getAudioTracks()[0];if(at)displayStream.addTrack(at);}catch(_){}startRecorder(displayStream);}).catch(function(){startRecorder(displayStream);});
  }else{startRecorder(displayStream);}
 }).catch(function(err){
  var n=(err&&err.name)||'';
  if(n==='NotAllowedError'||n==='AbortError'||n==='SecurityError')failDenied('Permission denied — you can retry or upload a video instead.');
  else if(n==='NotSupportedError'||n==='TypeError')onUnsupported('Screen recording not supported on this device');
  else if(n==='NotFoundError')onUnsupported('Screen recording not supported on this device');
  else failDenied('Permission denied — you can retry or upload a video instead.');
 });
 return{stop:function(){try{if(recorder&&recorder.state==='recording')recorder.stop();}catch(_){}},cancel:function(){cleanup();stopTracks(displayStream);stopTracks(micStream);}};
}
window.__bugaputaVideoCapture={CANDIDATES:CANDIDATES,getSupportedMime:getSupportedMime,stopTracks:stopTracks,startSession:startSession};
})();
