(function(){
  var script=document.currentScript||document.querySelector('script[data-project]');
  var projectKey=script&&script.getAttribute('data-project')||'';
  var API_BASE=((script&&script.getAttribute('data-api'))||'').replace(/\/+$/,'');
  var apiUrl=API_BASE?API_BASE+"/api/reports":"/api/reports";
  if(!projectKey){ console.warn('[Bugaputa] missing data-project'); }
  var cssHref=(API_BASE||'')+"/widget.css";
  if(!document.querySelector('link[href="'+cssHref+'"]')){
    var link=document.createElement('link'); link.rel='stylesheet'; link.href=cssHref; document.head.appendChild(link);
  }
  var WIDGET_DEFAULTS={label:'Feedback',color:'#4f46e5',position:'right'};
  var WIDGET_POSITIONS=['left','right','bottom-left','bottom-right'];
  function isValidHex(c){ return typeof c==='string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim()); }
  function sanitizeLabel(s){
    if(typeof s!=='string') return null;
    var t=s.trim(); if(!t) return null;
    if(t.length>30) t=t.slice(0,30);
    return t;
  }
  var H2C_ATTR=H2C_ATTR;
  var _dataLabel=script?script.getAttribute('data-label')||script.getAttribute('data-wording'):null;
  var _dataColor=script?script.getAttribute('data-color'):null;
  var _dataPos=script?script.getAttribute('data-position')||script.getAttribute('data-pos'):null;
  var _initialLabel=sanitizeLabel(_dataLabel)||null;
  var _initialColor=(isValidHex(_dataColor)?_dataColor.trim():null);
  var _initialPos=(WIDGET_POSITIONS.indexOf((_dataPos||'').trim())!==-1?(_dataPos||'').trim():null);
  var widgetConfig={
    label: _initialLabel||WIDGET_DEFAULTS.label,
    color: _initialColor||WIDGET_DEFAULTS.color,
    position: _initialPos||WIDGET_DEFAULTS.position,
    videoCaptureEnabled:false
  };
  var _revealed=false, _revealTimer=null;
  var WIDGET_REVEAL_TIMEOUT_MS=1500;
  function revealOnce(){
    if(_revealed) return;
    // Do not infer cancellation from script removal alone: loader libraries
    if(script&&script.getAttribute('data-bugaputa-unmounted')==='true'){
      if(_revealTimer){ try{ clearTimeout(_revealTimer); }catch(_){} _revealTimer=null; }
      return;
    }
    if(!document.body){
      setTimeout(revealOnce, 50);
      return;
    }
    _revealed=true;
    if(_revealTimer){ try{ clearTimeout(_revealTimer); }catch(_){} _revealTimer=null; }
    try{ document.body.appendChild(createTrigger()); }catch(_){}
  }
  (function fetchWidgetConfig(){
    if(!projectKey) return;
    var cfgUrl='';
    try{
      var base='';
      if(script&&script.src){ try{ base=new URL(script.src).origin; }catch(_){} }
      cfgUrl=(base||'')+"/api/widget-config?project="+encodeURIComponent(projectKey);
    }catch(_){ return; }
    _revealTimer=setTimeout(function(){ if(!_revealed) revealOnce(); }, WIDGET_REVEAL_TIMEOUT_MS);
    fetch(cfgUrl).then(function(r){
      if(!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function(d){
      if(!d||typeof d!=='object'){ if(!_revealed) revealOnce(); return; }
      var fetchedLabel=sanitizeLabel(d.widget_label||d.widgetLabel||d.label||null);
      var fetchedColor=d.widget_color||d.widgetColor||d.color||null;
      if(!isValidHex(fetchedColor)) fetchedColor=null; else fetchedColor=fetchedColor.trim();
      var fetchedPos=d.widget_position||d.widgetPosition||d.position||null;
      if(WIDGET_POSITIONS.indexOf((fetchedPos||'').trim())===-1) fetchedPos=null; else fetchedPos=(fetchedPos||'').trim();
      var fetchedVideo=typeof d.videoCaptureEnabled==='boolean'?d.videoCaptureEnabled: (typeof d.video_capture_enabled==='boolean'?d.video_capture_enabled:false);
      if(!_initialLabel&&fetchedLabel) widgetConfig.label=fetchedLabel;
      if(!_initialColor&&fetchedColor) widgetConfig.color=fetchedColor;
      if(!_initialPos&&fetchedPos) widgetConfig.position=fetchedPos;
      widgetConfig.videoCaptureEnabled=!!fetchedVideo;
      if(!_revealed) revealOnce(); else refreshVideoChooser();
      // if already revealed (timeout won), keep stability — do not re-append / jump
    }).catch(function(){ if(!_revealed) revealOnce(); });
  })();
  /* presence heartbeat */(function(){var I=5*60*1000,D=2000,k=projectKey?'bugaputa-presence-ts:'+projectKey:'',t=null,m=null;function o(){try{return!!projectKey&&(!script||script.getAttribute('data-bugaputa-unmounted')!=='true')}catch(_){return!1}}function q(h,d){try{if(navigator.sendBeacon)navigator.sendBeacon(h,new Blob([d],{type:'application/json'}))}catch(_){}}function x(){c();try{document.removeEventListener('visibilitychange',l)}catch(_){}try{if(m)m.disconnect()}catch(_){}m=null}function b(){if(!o()){x();return}try{var n=Date.now();if(k)try{var v=localStorage.getItem(k);if(v&&n-parseInt(v,10)<I)return}catch(_){}var h=(API_BASE||(script&&script.src?new URL(script.src).origin:''))+'/api/presence/heartbeat',d=JSON.stringify({project:projectKey,origin:location.hostname||''});try{typeof fetch==='function'?fetch(h,{method:'POST',headers:{'Content-Type':'application/json'},body:d,keepalive:!0,credentials:'omit'}).catch(function(){q(h,d)}):q(h,d)}catch(_){q(h,d)}if(k)try{localStorage.setItem(k,''+n)}catch(_){}}catch(_){}}function s(){if(t||!o())return;t=setInterval(function(){if(!o())x();else if(document.visibilityState!=='hidden')b()},I)}function c(){if(t)try{clearInterval(t)}catch(_){}t=null}function l(){if(!o())x();else if(document.visibilityState==='hidden')c();else b(),s()}function g(){if(!o())return;var f=function(){b();s()};try{typeof requestIdleCallback==='function'?requestIdleCallback(f,{timeout:D}):setTimeout(f,D)}catch(_){setTimeout(f,D)}}try{document.addEventListener('visibilitychange',l)}catch(_){}try{if(script&&typeof MutationObserver==='function'){m=new MutationObserver(function(){if(!o())x()});m.observe(script,{attributes:!0,attributeFilter:['data-bugaputa-unmounted']})}}catch(_){}try{setTimeout(g,0)}catch(_){}})();
  function h(tag, attrs, children){
    var el=document.createElement(tag);
    if(attrs) Object.keys(attrs).forEach(function(k){
      if(k==='class') el.className=attrs[k];
      else if(k==='text') el.textContent=attrs[k];
      else if(k==='html') el.innerHTML=attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if(children) (Array.isArray(children)?children:[children]).forEach(function(c){ if(c) el.appendChild(typeof c==='string'?document.createTextNode(c):c); });
    return el;
  }
  var overlay=null, lastFocus=null;
  var capturedBlobUrl=null, capturedDataUrl=null, capturedDims=null;
  var pendingAnnotatedFile=null;
  var capturedSnapshotHtml=null;
  var pendingSnapshotFile=null, pendingAnnotationsFile=null;
  var pendingVideoFile=null, pendingVideoUrl=null, pendingVideoMeta=null, videoCleanupTimer=null, activeVideoSession=null;
  function cleanupVideoAttachment(){ try{ if(activeVideoSession&&activeVideoSession.cancel) activeVideoSession.cancel(); }catch(_){} activeVideoSession=null; if(pendingVideoUrl){ try{ URL.revokeObjectURL(pendingVideoUrl); }catch(_){} pendingVideoUrl=null; } pendingVideoFile=null; pendingVideoMeta=null; if(videoCleanupTimer){ try{ clearTimeout(videoCleanupTimer); }catch(_){} videoCleanupTimer=null; } var vp=document.getElementById('bugaputa-video-preview'); if(vp){ try{ var kids=Array.prototype.slice.call(vp.childNodes); for(var _vi=0;_vi<kids.length;_vi++){ var n=kids[_vi]; if(n.id==='bugaputa-remove-video') continue; try{ vp.removeChild(n); }catch(_){} } }catch(_){} } var vs=document.getElementById('bugaputa-video-status'); if(vs){ vs.style.display='none'; vs.textContent=''; vs.style.color=''; } var fl=document.getElementById('bugaputa-video-file-label'); if(fl) fl.style.display='none'; var fi=document.getElementById('bugaputa-video-file'); if(fi) try{ fi.value=''; }catch(_){} }
  function isVideoEnabled(){ return !!widgetConfig.videoCaptureEnabled; }
  function refreshVideoChooser(){ try{ var ca=document.getElementById('bugaputa-chooser-actions'); var bv=document.getElementById('bugaputa-choose-video'); if(!ca||!bv) return; bv.style.display=isVideoEnabled()?'':'none'; if(isVideoEnabled()&&!ca.contains(bv)) ca.insertBefore(bv, ca.firstChild); }catch(_){} }
  function isVideoSupported(){ try{return !!(navigator.mediaDevices&&(navigator.mediaDevices.getDisplayMedia||navigator.mediaDevices.getViewportMedia));}catch(_){return false;}} // isVideoEnabled gates getDisplayMedia
  // v2 document coords with scroll compensation
  function getDocPoint(e){ return {x:(e.clientX||0)+(window.scrollX||0),y:(e.clientY||0)+(window.scrollY||0)}; }
  function haloClickRipple(e){ try{spawnRipple(e.clientX,e.clientY);}catch(_){} }
  var pointerHalo=null,pointerRaf=0,pointerHaloEnabled=true;
  function ensureHalo(){ if(pointerHalo) return pointerHalo; pointerHalo=h('div',{id:'bugaputa-pointer-halo','aria-hidden':'true'}); pointerHalo.style.display='none'; try{document.body.appendChild(pointerHalo);}catch(_){} return pointerHalo; }
  function showPointerHalo(x,y){ if(!pointerHaloEnabled) return; var el=ensureHalo(); if(!el) return; el.style.left=x+'px'; el.style.top=y+'px'; el.style.display='block'; }
  function movePointerHalo(e){ if(!pointerHaloEnabled) return; var x=e.clientX,y=e.clientY; if(pointerRaf) return; pointerRaf=requestAnimationFrame(function(){pointerRaf=0; showPointerHalo(x,y);}); }
  function hidePointerHalo(){ if(pointerHalo) pointerHalo.style.display='none'; }
  function spawnRipple(x,y){ if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; try{var r=h('div',{id:'bugaputa-pointer-ripple','aria-hidden':'true'}); r.style.left=x+'px'; r.style.top=y+'px'; document.body.appendChild(r); setTimeout(function(){try{r.remove();}catch(_){}},420);}catch(_){} }
  function togglePointerHalo(){ pointerHaloEnabled=!pointerHaloEnabled; if(!pointerHaloEnabled) hidePointerHalo(); return pointerHaloEnabled; }
  function fmtVideoTime(ms){ var s=Math.floor(ms/1000); var mm=String(Math.floor(s/60)).padStart(2,'0'); var ss=String(s%60).padStart(2,'0'); return mm+':'+ss; }
  function fmtVideoSize(b){ if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/(1024*1024)).toFixed(1)+' MB'; }
  function clearAttachmentState(){
    var fi=document.getElementById('bugaputa-file');
    if(fi) try{ fi.value=''; }catch(_){}
    try{ var pv=document.getElementById('bugaputa-preview'); if(pv && pv._blobUrl){ URL.revokeObjectURL(pv._blobUrl); pv._blobUrl=null; } }catch(_){}
    if(capturedBlobUrl){ try{ URL.revokeObjectURL(capturedBlobUrl); }catch(_){} capturedBlobUrl=null; }
    capturedDataUrl=null; capturedDims=null; capturedSnapshotHtml=null; pendingSnapshotFile=null; pendingAnnotationsFile=null; pendingAnnotatedFile=null;
    try{
      var pv2=document.getElementById('bugaputa-preview');
      if(pv2){
        var rb2=document.getElementById('bugaputa-remove-screenshot');
        var kids=Array.prototype.slice.call(pv2.childNodes);
        for(var k=0;k<kids.length;k++){ if(kids[k]!==rb2) try{ pv2.removeChild(kids[k]); }catch(_){} }
        pv2.style.color='';
        if(pv2._blobUrl){ try{ URL.revokeObjectURL(pv2._blobUrl); }catch(_){} pv2._blobUrl=null; }
      }
      var lbl=document.getElementById('bugaputa-file-label');
      if(lbl && lbl.firstChild && lbl.firstChild.nodeType===3) lbl.firstChild.textContent='Attach screenshot (optional)';
      var rb=document.getElementById('bugaputa-remove-screenshot');
      if(rb) rb.style.display='none';
    }catch(_){}
    try{ cleanupVideoAttachment(); }catch(_){}
  }
  function trapFocus(e){
    if(!overlay) return;
    if(e.key==='Escape'){ onOverlayEsc(); return; }
    if(e.key!=='Tab') return;
    var focusable=overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(!focusable.length) return;
    var first=focusable[0], last=focusable[focusable.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  function onOverlayEsc(){
    var ed=document.getElementById('bugaputa-annotate');
    if(ed){ requestDiscard(); return; }
    // if video is recording, confirm discard when >5s
    try{
      if(activeVideoSession){
        var metaDur=(pendingVideoMeta&&pendingVideoMeta.durationMs)||0;
        // active session exists — check timer via status elapsed heuristic or just confirm
        if(!confirm('Discard this recording?')) return;
        try{ activeVideoSession.cancel(); }catch(_){}
        activeVideoSession=null;
      }
    }catch(_){}
    var vp=document.getElementById('bugaputa-video-pane');
    if(vp && vp.style.display!=='none'){
      // if preview with pending video exists, ESC returns to chooser only after cleaning preview? No — keep preview for retry, just hide pane to chooser
      vp.style.display='none'; var ch=document.getElementById('bugaputa-chooser'); if(ch) ch.style.display='block'; var bv=document.getElementById('bugaputa-choose-video'); var bc=document.getElementById('bugaputa-choose-screenshot'); try{ (bv&&bv.style.display!=='none'?bv:bc).focus(); }catch(_){} return;
    }
    close();
  }
  function close(){ try{ clearAttachmentState(); }catch(_){}
    try{ if(activeVideoSession&&activeVideoSession.cancel) activeVideoSession.cancel(); }catch(_){} activeVideoSession=null;
    try{ hidePointerHalo(); if(pointerRaf) { cancelAnimationFrame(pointerRaf); pointerRaf=0; } try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} try{ if(window.__bugaputaCloseLiveWorkspace) window.__bugaputaCloseLiveWorkspace(); }catch(_){} }catch(_){}
    // onError intentionally does NOT call clearAttachmentState so retry keeps the file.
    cleanupAnnotate();
    var ed2=document.getElementById('bugaputa-annotate');
    if(ed2){ try{ if(ed2._cleanup) ed2._cleanup(); }catch(_){} ed2.remove(); document.body.style.overflow=''; }
    var b=document.getElementById('bugaputa-btn');
    if(b) b.style.display='';
    try{ var _fa=document.getElementById('bugaputa-actions'); if(_fa && _fa._inModalFooter) _fa.remove(); }catch(_){}
    var _prevY=0, _prevOv=''; try{ _prevY=overlay? (overlay._prevScrollY||0):0; _prevOv=overlay? (overlay._prevOverflow||'') : ''; }catch(_){}
    if(overlay){ overlay.remove(); overlay=null; document.removeEventListener('keydown', trapFocus); document.body.style.overflow=_prevOv; try{ if(_prevY) window.scrollTo(0,_prevY); }catch(_){} if(lastFocus) try{ lastFocus.focus(); }catch(_){} }
    else { document.body.style.overflow=''; }
  }
  function cleanupAnnotate(){
    var ed=document.getElementById('bugaputa-annotate');
    if(ed && ed._cleanup) try{ ed._cleanup(); }catch(_){}
  }
  function requestDiscard(){
    var ed=document.getElementById('bugaputa-annotate');
    if(!ed) { close(); return; }
    var count=(ed._annCount&&ed._annCount())||0;
    if(count>0){
      if(!confirm('Discard your annotations? This cannot be undone.')) return;
    }
    if(capturedBlobUrl){ URL.revokeObjectURL(capturedBlobUrl); capturedBlobUrl=null; }
    capturedDataUrl=null; capturedDims=null; pendingAnnotatedFile=null;
    capturedSnapshotHtml=null; pendingSnapshotFile=null; pendingAnnotationsFile=null;
    cleanupAnnotate();
    ed.remove();
    document.body.style.overflow='hidden';
    if(overlay){
      overlay.style.display='flex';
      var first=overlay.querySelector('button, [href], input, textarea');
      if(first) first.focus();
    }
  }
  function open(){
    try{ clearAttachmentState(); }catch(_){}
    lastFocus=document.activeElement;
    overlay=h('div',{id:'bugaputa-overlay',H2C_ATTR:'true'});
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    var modal=h('div',{id:'bugaputa-modal',role:'dialog','aria-modal':'true','aria-label':'Report a bug',H2C_ATTR:'true'});
    var closeBtn=h('button',{id:'bugaputa-close',text:'\u00D7','aria-label':'Close'});
    closeBtn.addEventListener('click', close);
    var chooser=h('div',{id:'bugaputa-chooser'});
    var chTitle=h('h2',{text:'How would you like to report?'});
    var chSub=h('p',{text:'Choose the feedback type that fits your issue.',style:'font-size:13px;color:#64748b;margin-top:4px'});
    var chevronSvg='<span class="bugaputa-choice-chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>';
    var iconVideo='<span class="bugaputa-choice-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg></span>';
    var iconShot='<span class="bugaputa-choice-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></span>';
    var iconGeneral='<span class="bugaputa-choice-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>';
    var btnVideo=h('button',{id:'bugaputa-choose-video',type:'button',html:iconVideo+'<span class="bugaputa-choice-text"><span class="bugaputa-choice-title">Record video <span class="bugaputa-badge">New</span></span><span class="bugaputa-choice-sub">Capture up to 60 seconds</span></span>'+chevronSvg});
    btnVideo.setAttribute('aria-label','Record video \u2014 Capture up to 60 seconds');
    btnVideo.title='Record your screen (up to 60s)';
    var btnCapture=h('button',{id:'bugaputa-choose-screenshot',type:'button',html:iconShot+'<span class="bugaputa-choice-text"><span class="bugaputa-choice-title">Screenshot</span><span class="bugaputa-choice-sub">Capture and annotate this page</span></span>'+chevronSvg});
    btnCapture.setAttribute('aria-label','Screenshot \u2014 Capture and annotate this page');
    btnCapture.title='Capture a screenshot and add annotations';
    var btnGeneral=h('button',{id:'bugaputa-choose-general',type:'button',html:iconGeneral+'<span class="bugaputa-choice-text"><span class="bugaputa-choice-title">General feedback</span><span class="bugaputa-choice-sub">Send a message without a capture</span></span>'+chevronSvg});
    btnGeneral.setAttribute('aria-label','General feedback \u2014 Send a message without a capture');
    btnGeneral.title='Send a message without a screenshot';
    var chooserActions=h('div',{id:'bugaputa-chooser-actions'});
    if(isVideoEnabled()) chooserActions.appendChild(btnVideo);
    chooserActions.appendChild(btnCapture); chooserActions.appendChild(btnGeneral);
    // ensure video button respects flag on later config updates
    try{ btnVideo.style.display=isVideoEnabled()?'':'none'; }catch(_){}
    chooser.appendChild(chTitle); chooser.appendChild(chSub); chooser.appendChild(chooserActions);
    var capturePane=h('div',{id:'bugaputa-capture-pane',style:'display:none'});
    var videoPane=h('div',{id:'bugaputa-video-pane',style:'display:none'});
    var videoConsent=h('div',{id:'bugaputa-video-consent'});
    videoConsent.innerHTML='<strong style="display:block;font-size:13px;margin-bottom:6px">Before you record</strong><p style="font-size:12px;color:#475569;line-height:1.5">We will record only this browser tab. Your browser asks permission — hints cannot force tab-only; unverifiable browsers show upload fallback. Mic off unless enabled.</p>';
    var videoMicChk=h('input',{id:'bugaputa-video-mic',type:'checkbox',style:'margin:0;cursor:pointer'});
    var videoMicLbl=h('label',{style:'display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#334155;cursor:pointer;user-select:none'},[videoMicChk,h('span',{text:'Include microphone (off by default)'})]);
    var videoDontChk=h('input',{id:'bugaputa-video-dont-show',type:'checkbox',style:'margin:0;cursor:pointer'});
    var videoDontLbl=h('label',{style:'display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:#64748b;cursor:pointer;user-select:none'},[videoDontChk,h('span',{text:"Don't show this again"})]);
    var videoStartBtn=h('button',{id:'bugaputa-video-start',type:'button',text:'Start recording'});
    videoStartBtn.setAttribute('aria-label','Start recording');
    var videoBackBtn=h('button',{id:'bugaputa-video-back',type:'button',text:'Back'});
    var videoStatus=h('div',{id:'bugaputa-video-status',style:'display:none;margin-top:10px;font-size:12px',role:'status','aria-live':'polite'});
    var videoPreview=h('div',{id:'bugaputa-video-preview',style:'margin-top:10px'});
    var videoFallbackInput=h('input',{id:'bugaputa-video-file',type:'file',accept:'video/webm,video/mp4',style:'display:none;margin-top:8px'});
    var videoFallbackLbl=h('label',{id:'bugaputa-video-file-label',style:'display:none;margin-top:8px;font-size:11px;color:#64748b'},[h('span',{text:'Or upload a video (webm/mp4 \u226425MB)'}), videoFallbackInput]);
    var videoRow=h('div',{style:'display:flex;gap:8px;margin-top:12px'});
    videoRow.appendChild(videoStartBtn); videoRow.appendChild(videoBackBtn);
    videoPane.appendChild(videoConsent); videoPane.appendChild(videoMicLbl); videoPane.appendChild(videoDontLbl); videoPane.appendChild(videoRow); videoPane.appendChild(videoStatus); videoPane.appendChild(videoPreview); videoPane.appendChild(videoFallbackLbl);

    var consent=h('div',{id:'bugaputa-consent-box'});
    consent.innerHTML='<strong style="display:block;font-size:13px;margin-bottom:6px">Before you capture</strong><p style="font-size:12px;color:#475569;line-height:1.5">We will capture only the visible part of this page you are seeing. Cross-origin iframes or video may appear blank. No passwords or form values are collected. You can annotate the screenshot before sending.</p><p style="font-size:11px;color:#94a3b8;margin-top:8px">Limits: cross-origin iframes, video/canvas may appear blank. You can still upload an image manually if capture fails.</p>';
    var dontShowChk=h('input',{id:'bugaputa-dont-show-consent',type:'checkbox',style:'margin:0;cursor:pointer'});var dontShowLbl=h('label',{style:'display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:#64748b;cursor:pointer;user-select:none'},[dontShowChk,h('span',{text:"Don't show this again"})]);capBtn=h('button',{id:'bugaputa-do-capture',type:'button',text:'Capture this page'});
    capBtn.setAttribute('aria-label','Capture this page');
    var capBack=h('button',{id:'bugaputa-cap-back',type:'button',text:'Back'});
    var capRow=h('div',{style:'display:flex;gap:8px;margin-top:12px'});
    capRow.appendChild(capBtn); capRow.appendChild(capBack);
    var capStatus=h('div',{id:'bugaputa-cap-status',style:'display:none;margin-top:10px;font-size:12px',role:'status','aria-live':'polite'});
    capturePane.appendChild(consent); capturePane.appendChild(dontShowLbl); capturePane.appendChild(capRow); capturePane.appendChild(capStatus);
    var modalBody=h('div',{id:'bugaputa-modal-body'});
    modal.appendChild(closeBtn);
    modal.appendChild(modalBody);
    modalBody.appendChild(chooser);
    modalBody.appendChild(capturePane);
    modalBody.appendChild(videoPane);
    var formWrap=h('div',{id:'bugaputa-form-wrap',style:'display:none'});
    modalBody.appendChild(formWrap);
    try{ overlay._prevScrollY=window.scrollY||window.pageYOffset||0; overlay._prevOverflow=document.body.style.overflow; }catch(_){}
    document.body.style.overflow='hidden';
    overlay.appendChild(modal); document.body.appendChild(overlay); document.addEventListener('keydown', trapFocus);
    setTimeout(function(){ btnCapture.focus(); }, 50);
    btnGeneral.addEventListener('click', function(){ chooser.style.display='none'; capturePane.style.display='none'; videoPane.style.display='none'; showForm(null); });
    btnCapture.addEventListener('click', function(){
      chooser.style.display='none'; videoPane.style.display='none';
      if(localStorage.getItem('bugaputa-skip-consent')){ doCapture(capStatus, formWrap, chooser, capturePane); } else { capturePane.style.display='block'; capBtn.focus(); }
    });
    btnVideo.addEventListener('click', function(){
      chooser.style.display='none'; capturePane.style.display='none';
      openLiveVideoWorkspace();
    });
    capBack.addEventListener('click', function(){ capturePane.style.display='none'; chooser.style.display='block'; btnCapture.focus(); });
    videoBackBtn.addEventListener('click', function(){ try{ if(activeVideoSession&&activeVideoSession.cancel) activeVideoSession.cancel(); }catch(_){} activeVideoSession=null; videoPane.style.display='none'; chooser.style.display='block'; var vs=document.getElementById('bugaputa-video-status'); if(vs){ vs.style.display='none'; vs.textContent=''; } var toFocus=isVideoEnabled()?btnVideo:btnCapture; try{ toFocus.focus(); }catch(_){} });
    function openLiveVideoWorkspace(){
      if(window.__bugaputaVideoLive&&window.__bugaputaVideoLive.open){ window.__bugaputaVideoLive.open({getDocPoint:getDocPoint, fmtVideoTime:fmtVideoTime, ensureHalo:ensureHalo, movePointerHalo:movePointerHalo, haloClickRipple:haloClickRipple, hidePointerHalo:hidePointerHalo, renderVideoPreview:renderVideoPreview, renderVideoDenied:renderVideoDenied, renderVideoUnsupported:renderVideoUnsupported, renderVideoRecovery:renderVideoRecovery, videoStatus:videoStatus, videoPane:videoPane}); return; }
      loadScript(scriptBase()+'/video-capture.js', function(){ if(window.__bugaputaVideoLive&&window.__bugaputaVideoLive.open) window.__bugaputaVideoLive.open({getDocPoint:getDocPoint, fmtVideoTime:fmtVideoTime, ensureHalo:ensureHalo, movePointerHalo:movePointerHalo, haloClickRipple:haloClickRipple, hidePointerHalo:hidePointerHalo, renderVideoPreview:renderVideoPreview, renderVideoDenied:renderVideoDenied, renderVideoUnsupported:renderVideoUnsupported, renderVideoRecovery:renderVideoRecovery, videoStatus:videoStatus, videoPane:videoPane}); else videoPane.style.display='block'; }, function(){ videoPane.style.display='block'; });
    }


    // Video pane helpers
    function ensureVideoCaptureLoaded(cb, errCb){
      if(window.__bugaputaVideoCapture&&window.__bugaputaVideoCapture.startSession) { cb(); return; }
      loadScript(scriptBase()+'/video-capture.js', cb, errCb);
    }
    function renderVideoDenied(msg){
      var isMicDenied=typeof msg==='string'&&msg.indexOf('Microphone')!==-1;
      videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent=msg;
      try{ if(videoStartBtn) videoStartBtn.style.display=''; var sb2=document.getElementById('bugaputa-video-stop'); if(sb2) sb2.style.display='none'; }catch(_){}
      var fl=document.getElementById('bugaputa-video-file-label'); if(fl) fl.style.display='block';
      var sub=document.getElementById('bugaputa-video-pane-subactions');
      if(sub){ try{ sub.remove(); }catch(_){} sub=null; }
      sub=h('div',{id:'bugaputa-video-pane-subactions',style:'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap'});
      var rtry=h('button',{id:'bugaputa-video-retry',type:'button',text:'Retry'}); rtry.setAttribute('aria-label','Retry recording'); rtry.addEventListener('click', function(){ var s=document.getElementById('bugaputa-video-pane-subactions'); if(s) s.style.display='none'; handleVideoStart(); });
      sub.appendChild(rtry);
      if(isMicDenied){
        var contNoMic=h('button',{id:'bugaputa-video-continue-without-mic',type:'button',text:'Continue without microphone'}); contNoMic.setAttribute('aria-label','Continue without microphone'); contNoMic.addEventListener('click', function(){ var s=document.getElementById('bugaputa-video-pane-subactions'); if(s) s.style.display='none'; handleVideoStartWithoutMic(); });
        sub.appendChild(contNoMic);
      }
      var toShot=h('button',{id:'bugaputa-video-to-screenshot',type:'button',text:'Use screenshot instead'}); toShot.addEventListener('click', function(){ videoPane.style.display='none'; capturePane.style.display='block'; try{ document.getElementById('bugaputa-do-capture').focus(); }catch(_){} });
      var toGeneral=h('button',{id:'bugaputa-video-to-general',type:'button',text:'General feedback'}); toGeneral.addEventListener('click', function(){ videoPane.style.display='none'; chooser.style.display='none'; showForm(null); });
      sub.appendChild(toShot); sub.appendChild(toGeneral);
      videoPane.appendChild(sub);
      // ensure controls remain; do not hide chooser restoration — user picks
    }
    function renderVideoUnsupported(msg){
      videoStatus.style.display='block'; videoStatus.style.color='#475569'; videoStatus.textContent=msg+' — you can still upload a video file or use another feedback type.';
      var fl=document.getElementById('bugaputa-video-file-label'); if(fl) fl.style.display='block';
      var sub=document.getElementById('bugaputa-video-pane-subactions'); if(!sub){
        sub=h('div',{id:'bugaputa-video-pane-subactions',style:'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap'});
        var toShot2=h('button',{id:'bugaputa-video-to-screenshot',type:'button',text:'Use screenshot instead'}); toShot2.addEventListener('click', function(){ videoPane.style.display='none'; capturePane.style.display='block'; try{ document.getElementById('bugaputa-do-capture').focus(); }catch(_){} });
        var toGeneral2=h('button',{id:'bugaputa-video-to-general',type:'button',text:'General feedback'}); toGeneral2.addEventListener('click', function(){ videoPane.style.display='none'; chooser.style.display='none'; showForm(null); });
        sub.appendChild(toShot2); sub.appendChild(toGeneral2);
        videoPane.appendChild(sub);
      } else sub.style.display='flex';
    }
    function renderVideoPreview(file, url, mime, durMs){
      pendingVideoFile=file; pendingVideoUrl=url; pendingVideoMeta={mime:mime,durationMs:durMs,sizeBytes:file.size||0};
      videoStatus.style.display='block'; videoStatus.style.color='#16a34a'; videoStatus.textContent='Recording ready — '+fmtVideoTime(durMs)+' · '+fmtVideoSize(file.size||0)+' · '+mime;
      var vp=document.getElementById('bugaputa-video-preview');
      // clear previous preview children except remove btn
      try{ var kids=Array.prototype.slice.call(vp.childNodes); for(var i=0;i<kids.length;i++){ var n=kids[i]; if(n.id==='bugaputa-remove-video') continue; try{ vp.removeChild(n); }catch(_){} } }catch(_){}
      var vid=document.createElement('video');
      vid.setAttribute('controls',''); vid.setAttribute('playsinline',''); vid.setAttribute('preload','metadata');
      vid.src=url;
      vid.style.cssText='max-width:100%;max-height:220px;border-radius:8px;border:1px solid #e2e8f0;background:#0f172a;display:block';
      vp.appendChild(vid);
      var meta=h('div',{id:'bugaputa-video-meta',text:fmtVideoTime(durMs)+' · '+fmtVideoSize(file.size||0)+' · '+mime,style:'font-size:11px;color:#64748b;margin-top:6px'});
      vp.appendChild(meta);
      var row=h('div',{id:'bugaputa-video-preview-actions',style:'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'});
      var contBtn=h('button',{id:'bugaputa-video-continue',type:'button',text:'Use recording'}); contBtn.setAttribute('aria-label','Use recording'); contBtn.style.minHeight='44px'; contBtn.addEventListener('click', function(){ videoPane.style.display='none'; chooser.style.display='none'; var fw=overlay._formWrap||document.getElementById('bugaputa-form-wrap'); if(fw) fw.style.display='block'; showForm(null); });
      var retakeBtn=h('button',{id:'bugaputa-video-retake',type:'button',text:'Record again'}); retakeBtn.setAttribute('aria-label','Record again'); retakeBtn.style.minHeight='44px'; retakeBtn.addEventListener('click', function(){ cleanupVideoAttachment(); var sub2=document.getElementById('bugaputa-video-pane-subactions'); if(sub2) sub2.style.display='none'; handleVideoStart(); });
      var removeVideoBtn=h('button',{id:'bugaputa-remove-video',type:'button','aria-label':'Remove recording',title:'Remove recording'}); removeVideoBtn.textContent='Delete recording'; removeVideoBtn.style.minHeight='44px';
      removeVideoBtn.addEventListener('click', function(){ if(!confirm('Delete this recording? This cannot be undone.')) return; cleanupVideoAttachment(); videoStatus.style.display='block'; videoStatus.style.color='#475569'; videoStatus.textContent='Recording deleted — you can record again or upload a file.'; var fl2=document.getElementById('bugaputa-video-file-label'); if(fl2) fl2.style.display='block'; });
      row.appendChild(contBtn); row.appendChild(retakeBtn); row.appendChild(removeVideoBtn);
      vp.appendChild(row);
      // keep file fallback visible for replace
      var fl3=document.getElementById('bugaputa-video-file-label'); if(fl3) fl3.style.display='block';
      // hide subactions row when preview active
      var sub3=document.getElementById('bugaputa-video-pane-subactions'); if(sub3) sub3.style.display='none';
    }
    function handleVideoFileFallback(file){
      if(!file) return;
      if(file.size>25*1024*1024){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='File too large (max 25MB)'; return; }
      var t=(file.type||'').split(';')[0].trim().toLowerCase();
      if(t!=='video/webm'&&t!=='video/mp4'){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Invalid file type (webm/mp4 only)'; return; }
      var durMs=0;
      // try client-side duration probe via video element
      var url=''; try{ url=URL.createObjectURL(file); }catch(_){}
      if(!url){ renderVideoPreview(file, '', file.type, 0); return; }
      var probe=document.createElement('video'); probe.preload='metadata'; probe.muted=true;
      var timed=false;
      var to=setTimeout(function(){ if(timed) return; timed=true; try{ probe.src=''; }catch(_){} renderVideoPreview(file, url, file.type, 0); }, 4000);
      probe.addEventListener('loadedmetadata', function(){
        if(timed) return; timed=true; clearTimeout(to);
        var d=probe.duration;
        if(isFinite(d)&&d>0) durMs=Math.round(d*1000);
        if(durMs>61000){ try{ URL.revokeObjectURL(url); }catch(_){} videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Video too long — max 60s'; return; }
        renderVideoPreview(file, url, file.type, durMs);
      });
      probe.addEventListener('error', function(){ if(timed) return; timed=true; clearTimeout(to); renderVideoPreview(file, url, file.type, 0); });
      try{ probe.src=url; }catch(_){ if(!timed){ timed=true; clearTimeout(to); renderVideoPreview(file, url, file.type, 0); } }
    }
    function handleVideoStart(){
      if(!isVideoEnabled()){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Video capture is disabled for this project.'; return; }
      if(!isVideoSupported()){ renderVideoUnsupported('Screen recording not supported on this device'); return; }
      if(videoDontChk&&videoDontChk.checked) try{ localStorage.setItem('bugaputa-skip-video-consent','1'); }catch(_){}
      videoStatus.style.display='block'; videoStatus.style.color='#475569'; videoStatus.textContent='Waiting for permission…';
      var cancelBtn=document.getElementById('bugaputa-video-cancel'); if(!cancelBtn){
        cancelBtn=h('button',{id:'bugaputa-video-cancel',type:'button',text:'Cancel'});
        cancelBtn.addEventListener('click', function(){ try{ if(activeVideoSession&&activeVideoSession.cancel) activeVideoSession.cancel(); }catch(_){} activeVideoSession=null; videoStatus.style.display='block'; videoStatus.style.color='#475569'; videoStatus.textContent='Cancelled.'; var flc=document.getElementById('bugaputa-video-file-label'); if(flc) flc.style.display='block'; });
        var rowEl=videoPane.querySelector('div'); // first row container
        if(videoRow) videoRow.appendChild(cancelBtn);
      }
      var micOn=!!(videoMicChk&&videoMicChk.checked);
      function _startWithMic(micFlag){
        ensureVideoCaptureLoaded(function(){
          var vc=window.__bugaputaVideoCapture;
          if(!vc||!vc.startSession){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Video capture failed to load.'; return; }
          videoStatus.textContent='Waiting for permission…';
          activeVideoSession=vc.startSession({
            micEnabled: micFlag,
            onRequesting:function(){ videoStatus.textContent='Waiting for permission…'; },
            onRecording:function(_stream,_rec){ videoStatus.style.color='#dc2626'; videoStatus.textContent='\u25CF Recording '+fmtVideoTime(0)+' / 01:00 — click Stop to finish'; var stopBtn=document.getElementById('bugaputa-video-stop'); if(!stopBtn){ stopBtn=h('button',{id:'bugaputa-video-stop',type:'button',text:'Stop'}); stopBtn.setAttribute('aria-label','Stop recording'); stopBtn.style.minHeight='44px'; stopBtn.addEventListener('click', function(){ try{ if(activeVideoSession&&activeVideoSession.stop) activeVideoSession.stop(); }catch(_){} try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} hidePointerHalo(); }); if(videoRow) videoRow.insertBefore(stopBtn, videoRow.firstChild.nextSibling||null); } videoStartBtn.style.display='none'; stopBtn.style.display=''; try{ ensureHalo(); document.addEventListener('pointermove', movePointerHalo); document.addEventListener('click', haloClickRipple); }catch(_){} },
            onTick:function(elapsed){ videoStatus.textContent='\u25CF Recording '+fmtVideoTime(elapsed)+' / 01:00 — click Stop to finish'; },
            onPreview:function(file,url,mime,durMs){ try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} hidePointerHalo(); videoStartBtn.style.display=''; var sb=document.getElementById('bugaputa-video-stop'); if(sb) sb.style.display='none'; activeVideoSession=null; renderVideoPreview(file,url,mime,durMs); },
            onDenied:function(msg){ try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} hidePointerHalo(); videoStartBtn.style.display=''; var sb=document.getElementById('bugaputa-video-stop'); if(sb) sb.style.display='none'; activeVideoSession=null; renderVideoDenied(msg); },
            onUnsupported:function(msg){ try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} hidePointerHalo(); videoStartBtn.style.display=''; activeVideoSession=null; renderVideoUnsupported(msg); },
            onError:function(msg){ try{ document.removeEventListener('pointermove', movePointerHalo); }catch(_){} try{ document.removeEventListener('click', haloClickRipple); }catch(_){} hidePointerHalo(); videoStartBtn.style.display=''; var sb2=document.getElementById('bugaputa-video-stop'); if(sb2) sb2.style.display='none'; activeVideoSession=null; videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent=msg; var fl=document.getElementById('bugaputa-video-file-label'); if(fl) fl.style.display='block'; }
          });
        }, function(){
          videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Load failed.';
        });
      }
      _startWithMic(micOn);
    }
    function handleVideoStartWithoutMic(){
      if(!isVideoEnabled()){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Video capture is disabled for this project.'; return; }
      if(!isVideoSupported()){ renderVideoUnsupported('Screen recording not supported on this device'); return; }
      videoStatus.style.display='block'; videoStatus.style.color='#475569'; videoStatus.textContent='Waiting for permission…';
      var sub=document.getElementById('bugaputa-video-pane-subactions'); if(sub) sub.style.display='none';
      ensureVideoCaptureLoaded(function(){
        var vc=window.__bugaputaVideoCapture;
        if(!vc||!vc.startSession){ videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Video capture failed to load.'; return; }
        videoStatus.textContent='Waiting for permission…';
        activeVideoSession=vc.startSession({
          micEnabled: false,
          onRequesting:function(){ videoStatus.textContent='Waiting for permission…'; },
          onRecording:function(_stream,_rec){ videoStatus.style.color='#dc2626'; videoStatus.textContent='\u25CF Recording '+fmtVideoTime(0)+' / 01:00 — click Stop to finish'; var stopBtn=document.getElementById('bugaputa-video-stop'); if(!stopBtn){ stopBtn=h('button',{id:'bugaputa-video-stop',type:'button',text:'Stop'}); stopBtn.addEventListener('click', function(){ try{ if(activeVideoSession&&activeVideoSession.stop) activeVideoSession.stop(); }catch(_){} }); if(videoRow) videoRow.insertBefore(stopBtn, videoRow.firstChild.nextSibling||null); } videoStartBtn.style.display='none'; stopBtn.style.display=''; },
          onTick:function(elapsed){ videoStatus.textContent='\u25CF Recording '+fmtVideoTime(elapsed)+' / 01:00 — click Stop to finish'; },
          onPreview:function(file,url,mime,durMs){ videoStartBtn.style.display=''; var sb=document.getElementById('bugaputa-video-stop'); if(sb) sb.style.display='none'; activeVideoSession=null; renderVideoPreview(file,url,mime,durMs); },
          onDenied:function(msg){ videoStartBtn.style.display=''; var sb=document.getElementById('bugaputa-video-stop'); if(sb) sb.style.display='none'; activeVideoSession=null; renderVideoDenied(msg); },
          onUnsupported:function(msg){ videoStartBtn.style.display=''; activeVideoSession=null; renderVideoUnsupported(msg); },
          onError:function(msg){ videoStartBtn.style.display=''; var sb2=document.getElementById('bugaputa-video-stop'); if(sb2) sb2.style.display='none'; activeVideoSession=null; videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent=msg; var fl=document.getElementById('bugaputa-video-file-label'); if(fl) fl.style.display='block'; }
        });
      }, function(){
        videoStatus.style.display='block'; videoStatus.style.color='#dc2626'; videoStatus.textContent='Load failed.';
      });
    }
    // wire file fallback
    try{
      var vfi=document.getElementById('bugaputa-video-file');
      if(vfi) vfi.addEventListener('change', function(){ var f=vfi.files&&vfi.files[0]; if(f) handleVideoFileFallback(f); });
    }catch(_){}
    videoStartBtn.addEventListener('click', function(){
      handleVideoStart();
    });
    capBtn.addEventListener('click', function(){ if(dontShowChk&&dontShowChk.checked) localStorage.setItem('bugaputa-skip-consent','1'); doCapture(capStatus, formWrap, chooser, capturePane); });
    overlay._chooser=chooser; overlay._capturePane=capturePane; overlay._videoPane=videoPane; overlay._formWrap=formWrap;
  }
  function showForm(prefill){
    var wrap=overlay._formWrap || document.getElementById('bugaputa-form-wrap');
    if(!wrap) return;
    wrap.innerHTML='';
    wrap.style.display='block';
    var form=h('form',{id:'bugaputa-form'}); form.noValidate=true;
    var msgLabel=h('label',{text:'Describe the bug *'});
    var textarea=h('textarea',{id:'bugaputa-msg',placeholder:'What went wrong? (10–2000 chars)',rows:'4',required:'','aria-required':'true'});
    var msgErr=h('div',{id:'bugaputa-error-msg',style:'display:none'}); msgErr.setAttribute('role','alert');
    msgLabel.appendChild(textarea); msgLabel.appendChild(msgErr);
    var emailLabel=h('label',{text:'Your email (optional)'});
    var emailInput=h('input',{type:'email',id:'bugaputa-email',placeholder:'you@example.com',autocomplete:'email'});
    var emailErr=h('div',{style:'display:none',id:'bugaputa-error-email'}); emailErr.setAttribute('role','alert');
    emailLabel.appendChild(emailInput); emailLabel.appendChild(emailErr);
    var fileLabel=h('label',{text:'Attach screenshot (optional)',id:'bugaputa-file-label'});
    var fileInput=h('input',{type:'file',id:'bugaputa-file',accept:'image/png,image/jpeg,image/webp,image/gif'});
    var preview=h('div',{id:'bugaputa-preview'});
    var removeBtn=h('button',{id:'bugaputa-remove-screenshot',type:'button','aria-label':'Remove screenshot',title:'Remove screenshot'});
    removeBtn.innerHTML='<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polyline points=\"3 6 5 6 21 6\"></polyline><path d=\"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6\"></path><path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path><path d=\"M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2\"></path></svg>';
    removeBtn.style.display='none';
    function hasAttachment(){ return !!(pendingAnnotatedFile || pendingSnapshotFile || pendingVideoFile || (fileInput.files && fileInput.files[0])); }
    function syncRemoveBtn(){ removeBtn.style.display = hasAttachment() ? '' : 'none'; }
    removeBtn.addEventListener('click', function(){
      try{ clearAttachmentState(); }catch(_){}
      try{ fileInput.focus(); }catch(_){}
    });
    preview.appendChild(removeBtn);
    if(pendingVideoFile){
      var vUrl=pendingVideoUrl||''; try{ if(!vUrl) vUrl=URL.createObjectURL(pendingVideoFile); }catch(_){}
      if(!pendingVideoUrl&&vUrl) pendingVideoUrl=vUrl;
      var vEl=document.createElement('video'); vEl.setAttribute('controls',''); vEl.setAttribute('playsinline',''); vEl.src=vUrl; vEl.style.cssText='max-width:100%;max-height:160px;border-radius:8px;border:1px solid #e2e8f0;background:#0f172a;display:block';
      preview.appendChild(vEl);
      var vMeta=pendingVideoMeta? (fmtVideoTime(pendingVideoMeta.durationMs)+' · '+fmtVideoSize(pendingVideoMeta.sizeBytes)+' · '+(pendingVideoMeta.mime||pendingVideoFile.type)) : fmtVideoSize(pendingVideoFile.size||0);
      var vHint=h('div',{text:'Video attached — will be sent with your report. '+vMeta,style:'font-size:11px;color:#64748b;margin-top:6px'});
      preview.appendChild(vHint);
      fileLabel.firstChild && (fileLabel.firstChild.textContent='Replace screenshot');
    } else if(pendingAnnotatedFile){
      var blobUrl=URL.createObjectURL(pendingAnnotatedFile);
      var img=document.createElement('img'); img.alt='Annotated screenshot preview'; img.src=blobUrl;
      preview.appendChild(img);
      var hint=h('div',{text:'Annotated screenshot ready — you can replace it by choosing another file.',style:'font-size:11px;color:#64748b;margin-top:6px'});
      preview.appendChild(hint);
      preview._blobUrl=blobUrl;
      fileLabel.firstChild && (fileLabel.firstChild.textContent='Replace screenshot');
    } else if(pendingSnapshotFile){
      preview.appendChild(h('div',{text:'Page snapshot attached.',style:'font-size:11px;color:#64748b'}));
    }
    syncRemoveBtn();
    fileInput.addEventListener('change', function(){
      if(preview._blobUrl){ URL.revokeObjectURL(preview._blobUrl); preview._blobUrl=null; }
      if(fileInput.files[0]) pendingAnnotatedFile=null;
      Array.from(preview.children).forEach(function(ch){ if(ch!==removeBtn) ch.remove(); }); for(var _ii=preview.childNodes.length-1;_ii>=0;_ii--){ var _nn=preview.childNodes[_ii]; if(_nn.nodeType===3) preview.removeChild(_nn); } preview.style.color='';
      var f=fileInput.files[0]; if(!f){ fileLabel.firstChild && (fileLabel.firstChild.textContent='Attach screenshot (optional)'); syncRemoveBtn(); return; } if(f.size>5*1024*1024){ try{ fileInput.value=''; }catch(_){} preview.textContent='File too large (max 5MB)'; preview.style.color='#dc2626'; preview.appendChild(removeBtn); syncRemoveBtn(); return; } var img2=document.createElement('img'); img2.alt='Screenshot preview'; img2.src=URL.createObjectURL(f); preview.appendChild(img2); preview.appendChild(removeBtn);
      preview._blobUrl=img2.src;
      fileLabel.firstChild && (fileLabel.firstChild.textContent='Replace screenshot');
      syncRemoveBtn();
    });
    fileLabel.appendChild(fileInput); fileLabel.appendChild(preview);
    var hpWrap=h('div',{id:'bugaputa-hp','aria-hidden':'true'});
    var hpInput=h('input',{type:'text',name:'website',tabindex:'-1',autocomplete:'off',placeholder:'Leave empty'});
    hpWrap.appendChild(hpInput);
    var ctx=h('div',{id:'bugaputa-context'});
    var vw=window.innerWidth+'x'+window.innerHeight;
    (function(){
      var esc=function(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; };
      ctx.innerHTML='<strong>Will be sent:</strong><br>URL: '+esc(location.href.length>80?location.href.slice(0,80)+'…':location.href)+'<br>Browser: '+esc(navigator.userAgent.slice(0,120))+'<br>Viewport: '+esc(vw)+'<br>Language: '+esc(navigator.language||'');
    })();
    var consent=h('div',{id:'bugaputa-consent',text:'We will send page URL, browser info, and your message. No passwords.'});
    var actions=h('div',{id:'bugaputa-actions'});
    var cancelBtn=h('button',{id:'bugaputa-cancel',type:'button',text:'Cancel'}); cancelBtn.addEventListener('click', close);
    var submitBtn=h('button',{id:'bugaputa-submit',type:'submit',text:'Send report'});
    actions.appendChild(cancelBtn); actions.appendChild(submitBtn);
    var success=h('div',{id:'bugaputa-success',style:'display:none'}); success.innerHTML='<p>Thanks! Report sent.</p><p style="font-size:13px;color:#64748b;margin-top:4px">We will look into it.</p>';
    var errBox=h('div',{id:'bugaputa-error',style:'display:none'}); errBox.setAttribute('role','alert'); errBox.setAttribute('aria-live','polite');
    form.appendChild(msgLabel); form.appendChild(emailLabel); form.appendChild(fileLabel); form.appendChild(hpWrap); form.appendChild(ctx); form.appendChild(consent); form.appendChild(errBox);
    submitBtn.setAttribute('form','bugaputa-form');
    submitBtn.addEventListener('click', function(e){
      if(submitBtn.form!==form){ e.preventDefault(); try{ if(typeof form.requestSubmit==='function') form.requestSubmit(); else form.dispatchEvent(new Event('submit',{cancelable:true})); }catch(_){ try{ form.dispatchEvent(new Event('submit',{cancelable:true})); }catch(_2){} } }
    });
    form.appendChild(actions);
    wrap.appendChild(form); wrap.appendChild(success);
    try{
      var _modal=document.getElementById('bugaputa-modal');
      if(_modal){ _modal.appendChild(actions); actions._inModalFooter=true; }
    }catch(_){}

    setTimeout(function(){ textarea.focus(); }, 50);
    textarea.addEventListener('input', function(){ if(textarea.value.trim().length>=10 && textarea.value.trim().length<=2000){ textarea.style.border=''; msgErr.style.display='none'; } });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      msgErr.style.display='none'; textarea.style.border=''; emailErr.style.display='none'; errBox.style.display='none';
      var msg=textarea.value.trim(); var email=emailInput.value.trim(); var hasError=false;
      if(msg.length<10){ msgErr.textContent='Please describe the bug (at least 10 characters).'; msgErr.style.display='block'; textarea.style.border='2px solid #ef4444'; hasError=true; }
      else if(msg.length>2000){ msgErr.textContent='Message too long (max 2000 characters).'; msgErr.style.display='block'; textarea.style.border='2px solid #ef4444'; hasError=true; }
      if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ emailErr.textContent='Enter a valid email or leave empty.'; emailErr.style.display='block'; hasError=true; }
      if(hpInput.value){ close(); return; }
      if(hasError) return;
      submitBtn.disabled=true; submitBtn.textContent='Sending...';
      var hasFile = pendingAnnotatedFile ? pendingAnnotatedFile : (fileInput.files && fileInput.files[0] ? fileInput.files[0] : null);
      var hasVideo = pendingVideoFile || null;
      // expose pending video in form scope for submit branch
      if(hasFile && hasFile.size>5*1024*1024){ errBox.textContent='File too large (max 5MB)'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; return; }
      if(hasFile && !/^(image\/png|image\/jpeg|image\/webp|image\/gif)$/.test(hasFile.type)){ errBox.textContent='Invalid file type (png/jpeg/webp/gif only)'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; return; }
      if(hasVideo){
        if(hasVideo.size>25*1024*1024){ errBox.textContent='File too large — max 25MB'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; return; }
        if(!/^(video\/webm|video\/mp4)$/.test((hasVideo.type||'').split(';')[0].trim().toLowerCase())){ errBox.textContent='Invalid file type (webm/mp4 only)'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; return; }
      }
      var url=apiUrl; if(url.startsWith('/') && script && script.src){ try{ var u=new URL(script.src); url=u.origin+url; }catch(_){} }
      function onSuccess(){ try{ var _fa2=document.getElementById('bugaputa-actions'); if(_fa2) _fa2.style.display='none'; }catch(_){} form.style.display='none'; success.style.display='block'; setTimeout(close, 2200); }
      // onError intentionally does NOT clear attachment state — retry must keep the file.
      function onError(msg){ errBox.textContent=msg || 'Failed to send. Please try again.'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; }
      if(hasFile || pendingSnapshotFile || pendingAnnotationsFile || hasVideo){
        var fd=new FormData(); fd.append('message', msg); if(email) fd.append('contactEmail', email); fd.append('pageUrl', location.href); fd.append('userAgent', navigator.userAgent); fd.append('viewport', window.innerWidth+'x'+window.innerHeight); fd.append('language', navigator.language||''); fd.append('website', hpInput.value); if(hasFile) fd.append('screenshot', hasFile); if(pendingSnapshotFile) fd.append('domSnapshot', pendingSnapshotFile); if(pendingAnnotationsFile) fd.append('annotations', pendingAnnotationsFile); if(hasVideo) fd.append('video', hasVideo); if(projectKey) fd.append('projectKey', projectKey);
        fetch(url, {method:'POST', headers:{'x-project-key':projectKey}, body:fd}).then(function(r){ return r.text().then(function(t){ var d; try{d=JSON.parse(t)}catch{d=t}; return {ok:r.ok,status:r.status,data:d}; }); }).then(function(res){ if(res.ok) onSuccess(); else onError((res.data&&res.data.error)||'Failed to send ('+res.status+')'); }).catch(function(){ onError('Network error. Check connection and retry.'); });
      } else {
        var body=JSON.stringify({message:msg, contactEmail:email||undefined, pageUrl:location.href, userAgent:navigator.userAgent, viewport:window.innerWidth+'x'+window.innerHeight, language:navigator.language||'', website:hpInput.value, projectKey:projectKey});
        fetch(url, {method:'POST', headers:{'Content-Type':'application/json','x-project-key':projectKey}, body:body}).then(function(r){ return r.text().then(function(t){ var d; try{d=JSON.parse(t)}catch{d=t}; return {ok:r.ok,status:r.status,data:d}; }); }).then(function(res){ if(res.ok) onSuccess(); else onError((res.data&&res.data.error)||'Failed to send ('+res.status+')'); }).catch(function(){ onError('Network error. Check connection and retry.'); });
      }
    });
  }
  function scriptBase(){
    var base='';
    if(script && script.src){ try{ var u=new URL(script.src); base=u.origin; }catch(_){} }
    return base;
  }
  function loadScript(src, cb, errCb){
    var s=document.createElement('script');
    s.src=src;
    s.onload=function(){ cb(); };
    s.onerror=function(){ errCb(new Error('Failed to load '+src)); };
    document.head.appendChild(s);
  }
  function pageBackgroundColor(){
    try{
      var cands=[document.body, document.documentElement];
      for(var i=0;i<cands.length;i++){
        var c=getComputedStyle(cands[i]).backgroundColor;
        if(c && c!=='transparent' && c!=='rgba(0, 0, 0, 0)') return c;
      }
    }catch(_){}
    return '#ffffff';
  }
  function prepareCaptureFixups(sx, sy){
    var tagged=[];
    var els=document.querySelectorAll('*');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.closest && el.closest('[data-html2canvas-ignore]')) continue;
      var tag=el.tagName;
      if(tag==='TEXTAREA' || tag==='INPUT'){
        if(!el.value && el.getAttribute('placeholder')){
          var phColor='#9ca3af';
          try{ var pc=getComputedStyle(el,'::placeholder').color; if(pc) phColor=pc; }catch(_){}
          el.setAttribute('data-bugaputa-fix', JSON.stringify({kind:'placeholder', color: phColor}));
          tagged.push(el);
          continue;
        }
      }
      var cs;
      try{ cs=getComputedStyle(el); }catch(_){ continue; }
      if(cs.position==='fixed'){
        var r=el.getBoundingClientRect();
        if(r.width<1 || r.height<1) continue;
        el.setAttribute('data-bugaputa-fix', JSON.stringify({kind:'fixed', left:r.left+sx, top:r.top+sy, w:r.width, h:r.height}));
        tagged.push(el);
      } else if(cs.position==='sticky'){
        var r2=el.getBoundingClientRect();
        var prevPos=el.style.position;
        el.style.position='static';
        var rs=el.getBoundingClientRect();
        el.style.position=prevPos;
        var dx=r2.left-rs.left, dy=r2.top-rs.top;
        if(Math.abs(dx)>0.5 || Math.abs(dy)>0.5){
          el.setAttribute('data-bugaputa-fix', JSON.stringify({kind:'sticky', dx:dx, dy:dy}));
          tagged.push(el);
        }
      }
    }
    return function untag(){
      for(var j=0;j<tagged.length;j++){ try{ tagged[j].removeAttribute('data-bugaputa-fix'); }catch(_){} }
    };
  }
  function applyCloneFixup(clone, engine){
    if(!clone || !clone.getAttribute) return;
    var raw=clone.getAttribute('data-bugaputa-fix');
    if(!raw) return;
    var f;
    try{ f=JSON.parse(raw); }catch(_){ return; }
    if(f.kind==='fixed'){
      clone.style.position='absolute';
      clone.style.left=f.left+'px';
      clone.style.top=f.top+'px';
      clone.style.right='auto';
      clone.style.bottom='auto';
      clone.style.margin='0';
      clone.style.width=f.w+'px';
      clone.style.height=f.h+'px';
    } else if(f.kind==='sticky'){
      var t=clone.style.transform && clone.style.transform!=='none' ? clone.style.transform+' ' : '';
      clone.style.transform=t+'translate('+f.dx+'px,'+f.dy+'px)';
    } else if(f.kind==='placeholder'){
      var phc=f.color||'#9ca3af';
      clone.style.color=phc;
      clone.style.setProperty('-webkit-text-fill-color', phc);
      if(engine==='legacy'){
        var ph=clone.getAttribute('placeholder')||'';
        try{ clone.value=ph; }catch(_){}
        if(clone.tagName==='TEXTAREA') clone.textContent=ph;
        else clone.setAttribute('value', ph);
      }
    }
    clone.removeAttribute('data-bugaputa-fix');
  }
  var SNAPSHOT_MAX_HTML=8*1024*1024,SNAPSHOT_MAX_GZ=2*1024*1024;
  var REDACT_NAME_RE=/pass|secret|token|card|cvc|ssn/i;
  function snapshotRedact(el){
    try{
      if((el.type||'').toLowerCase()==='password') return true;
      var ac=(el.getAttribute('autocomplete')||'').toLowerCase();
      if(ac.indexOf('cc-')===0 || ac==='current-password' || ac==='new-password') return true;
      return REDACT_NAME_RE.test((el.getAttribute('name')||'')+' '+(el.getAttribute('id')||''));
    }catch(_){ return true; }
  }
  function snapshotPlaceholderBox(live, doc, dashed){
    var r={width:0,height:0};
    try{ r=live.getBoundingClientRect(); }catch(_){}
    var div=doc.createElement('div');
    div.style.cssText='width:'+Math.round(r.width)+'px;height:'+Math.round(r.height)+'px;background:#f1f5f9;'+(dashed?'border:1px dashed #cbd5e1;':'');
    return div;
  }
  function snapshotCopyState(live, cloned, doc){
    var lc=live.children, cc=cloned.children;
    for(var i=lc.length-1;i>=0;i--){
      var l=lc[i], c=cc[i];
      if(!c) continue;
      if(l.hasAttribute && l.hasAttribute(H2C_ATTR)){ cloned.removeChild(c); continue; }
      var tag=l.tagName;
      if(tag==='IFRAME' || tag==='FRAME' || tag==='OBJECT' || tag==='EMBED'){
        cloned.replaceChild(snapshotPlaceholderBox(l, doc, true), c);
        continue;
      }
      if(tag==='CANVAS'){
        var replacement=null;
        try{
          var data=l.toDataURL('image/png');
          var img=doc.createElement('img');
          img.setAttribute('src', data);
          if(l.className) img.className=l.className;
          if(l.getAttribute('style')) img.setAttribute('style', l.getAttribute('style'));
          var cr=l.getBoundingClientRect();
          img.style.width=Math.round(cr.width)+'px'; img.style.height=Math.round(cr.height)+'px';
          replacement=img;
        }catch(_){ replacement=snapshotPlaceholderBox(l, doc, false); }
        cloned.replaceChild(replacement, c);
        continue;
      }
      if(l.hasAttribute && l.hasAttribute('data-bugaputa-mask')){
        c.textContent='XXXXX';
        continue;
      }
      if(tag==='INPUT'){
        var redacted=snapshotRedact(l);
        var type=(l.type||'').toLowerCase();
        if(type==='checkbox' || type==='radio'){
          if(l.checked) c.setAttribute('checked','');
          else c.removeAttribute('checked');
        } else {
          c.setAttribute('value', redacted ? 'XXXXX' : (l.value||''));
        }
        continue;
      }
      if(tag==='TEXTAREA'){
        c.textContent=snapshotRedact(l) ? 'XXXXX' : (l.value||'');
        continue;
      }
      if(tag==='SELECT'){
        for(var o=0;o<l.options.length;o++){
          var co=c.options && c.options[o];
          if(!co) continue;
          if(l.options[o].selected) co.setAttribute('selected','');
          else co.removeAttribute('selected');
        }
        continue;
      }
      if(l.scrollTop || l.scrollLeft){
        if(l.scrollTop) c.setAttribute('data-bugaputa-scroll-top', String(Math.round(l.scrollTop)));
        if(l.scrollLeft) c.setAttribute('data-bugaputa-scroll-left', String(Math.round(l.scrollLeft)));
      }
      snapshotCopyState(l, c, doc);
    }
  }
  function sanitizeSnapshot(root){
    var drop=root.querySelectorAll('script, noscript, template, base, link[rel~="preload" i], link[rel~="modulepreload" i], link[rel~="prefetch" i], link[rel~="preconnect" i], link[rel~="dns-prefetch" i], meta[http-equiv="refresh" i]');
    for(var i=0;i<drop.length;i++){ if(drop[i].parentNode) drop[i].parentNode.removeChild(drop[i]); }
    var all=root.querySelectorAll('*');
    var URL_ATTRS=['href','src','action','formaction','xlink:href'];
    for(var j=-1;j<all.length;j++){
      var el=(j<0)?root:all[j];
      var names=el.getAttributeNames?el.getAttributeNames():[];
      for(var k=0;k<names.length;k++){
        var n=names[k];
        if(n.toLowerCase().indexOf('on')===0){ el.removeAttribute(n); continue; }
        if(URL_ATTRS.indexOf(n.toLowerCase())!==-1){
          var v=el.getAttribute(n)||'';
          if(/^\s*javascript:/i.test(v)) el.setAttribute(n, '#');
        }
      }
    }
  }
  function absolutizeUrl(v){
    if(!v) return v;
    if(/^(data:|blob:|about:|#)/i.test(v)) return v;
    try{ return new URL(v, location.href).href; }catch(_){ return v; }
  }
  function absolutizeSnapshotUrls(root){
    var els=root.querySelectorAll('img, source, video, audio, track, link, a, area, form, input[type="image" i]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var attrs=['src','href','poster','action'];
      for(var a=0;a<attrs.length;a++){
        if(el.hasAttribute(attrs[a])) el.setAttribute(attrs[a], absolutizeUrl(el.getAttribute(attrs[a])));
      }
      if(el.hasAttribute('srcset')){
        var parts=(el.getAttribute('srcset')||'').split(',');
        for(var p=0;p<parts.length;p++){
          var seg=parts[p].trim().split(/\s+/);
          if(seg[0]) seg[0]=absolutizeUrl(seg[0]);
          parts[p]=seg.join(' ');
        }
        el.setAttribute('srcset', parts.join(', '));
      }
    }
  }
  function inlineSameOriginSheets(root){
    var sheets=document.styleSheets;
    var clonedLinks=root.querySelectorAll('link[rel~="stylesheet" i]');
    var clonedStyles=root.querySelectorAll('style');
    var styleIndex=0;
    for(var i=0;i<sheets.length;i++){
      var sheet=sheets[i], rules=null;
      try{ rules=sheet.cssRules; }catch(_){ rules=null; }
      if(sheet.ownerNode && sheet.ownerNode.tagName==='STYLE'){
        var target=clonedStyles[styleIndex++];
        if(target && rules){
          var text='';
          for(var r=0;r<rules.length;r++) text+=rules[r].cssText+'\n';
          target.textContent=text;
        }
        continue;
      }
      if(!rules) continue;
      var href=sheet.href||'';
      for(var c=0;c<clonedLinks.length;c++){
        var link=clonedLinks[c];
        if(!link.parentNode) continue;
        var lh='';
        try{ lh=new URL(link.getAttribute('href')||'', location.href).href; }catch(_){ lh=link.getAttribute('href')||''; }
        if(lh!==href) continue;
        var styleEl=root.ownerDocument.createElement('style');
        styleEl.setAttribute('data-bugaputa-inlined','');
        var css='';
        for(var rr=0;rr<rules.length;rr++) css+=rules[rr].cssText+'\n';
        styleEl.textContent=css;
        link.parentNode.replaceChild(styleEl, link);
        break;
      }
    }
  }
  function anchorSnapshotViewport(root, sx, sy, vw, vh, scale){
    var head=root.querySelector('head');
    if(!head){ head=root.ownerDocument.createElement('head'); root.insertBefore(head, root.firstChild); }
    var style=root.ownerDocument.createElement('style');
    style.setAttribute('data-bugaputa-anchor','');
    style.textContent='html,body{overflow:hidden !important;margin:0 !important;padding:0 !important}'+
      'html{width:'+vw+'px !important;height:'+vh+'px !important}'+
      'body{transform:translate('+(-sx)+'px,'+(-sy)+'px);transform-origin:0 0}';
    head.insertBefore(style, head.firstChild);
    root.setAttribute('data-bugaputa-viewport', vw+'x'+vh);
    root.setAttribute('data-bugaputa-dpr', String(scale||1));
    root.setAttribute('data-bugaputa-url', location.href);
    try{ root.setAttribute('data-bugaputa-ts', new Date().toISOString()); }catch(_){}
  }
  var SNAPSHOT_INLINE_BUDGET=3*1024*1024,SNAPSHOT_INLINE_MAX=768*1024,SNAPSHOT_INLINE_MS=6000;
  function fetchAsDataUri(url, cb){
    try{
      var done=false;
      var finish=function(v){ if(!done){ done=true; cb(v); } };
      var timer=setTimeout(function(){ finish(null); }, SNAPSHOT_INLINE_MS);
      fetch(url, {credentials:'same-origin', cache:'force-cache'}).then(function(res){
        if(!res.ok) throw new Error('status '+res.status);
        return res.blob();
      }).then(function(blob){
        if(blob.size>SNAPSHOT_INLINE_MAX){ clearTimeout(timer); finish(null); return; }
        var reader=new FileReader();
        reader.onload=function(){ clearTimeout(timer); finish({uri:String(reader.result), size:blob.size}); };
        reader.onerror=function(){ clearTimeout(timer); finish(null); };
        reader.readAsDataURL(blob);
      }).catch(function(){ clearTimeout(timer); finish(null); });
    }catch(_){ cb(null); }
  }
  function inlineSnapshotResources(root, cb){
    if(typeof fetch==='undefined' || typeof FileReader==='undefined'){ cb(); return; }
    var jobs={};
    function want(url){
      if(!url || /^(data:|about:|blob:|#)/i.test(url)) return;
      if(!jobs[url]) jobs[url]=[];
      return jobs[url];
    }
    var imgs=root.querySelectorAll('img, source, input[type="image" i]');
    for(var i=0;i<imgs.length;i++){
      (function(el){
        var src=el.getAttribute('src');
        var list=want(src);
        if(list) list.push(function(uri){ el.setAttribute('src', uri); el.removeAttribute('srcset'); el.removeAttribute('sizes'); });
      })(imgs[i]);
    }
    var styles=root.querySelectorAll('style');
    var URL_RE=/url\((['"]?)([^'")]+)\1\)/g;
    for(var s=0;s<styles.length;s++){
      (function(styleEl){
        var css=styleEl.textContent||'', m, seen={};
        while((m=URL_RE.exec(css))!==null){
          var u=m[2];
          if(seen[u]) continue;
          seen[u]=1;
          var abs=absolutizeUrl(u);
          var list=want(abs);
          if(list) (function(orig){
            list.push(function(uri){
              styleEl.textContent=(styleEl.textContent||'').split('url('+orig+')').join('url('+uri+')')
                .split('url("'+orig+'")').join('url("'+uri+'")')
                .split("url('"+orig+"')").join("url('"+uri+"')");
            });
          })(u);
        }
      })(styles[s]);
    }
    var urls=Object.keys(jobs);
    if(!urls.length){ cb(); return; }
    var pending=urls.length, spent=0, finished=false;
    var overall=setTimeout(function(){ if(!finished){ finished=true; cb(); } }, SNAPSHOT_INLINE_MS+500);
    function settle(){
      if(--pending>0 || finished) return;
      finished=true; clearTimeout(overall); cb();
    }
    for(var u2=0;u2<urls.length;u2++){
      (function(url){
        if(spent>SNAPSHOT_INLINE_BUDGET){ settle(); return; }
        fetchAsDataUri(url, function(result){
          if(result && spent+result.size<=SNAPSHOT_INLINE_BUDGET){
            spent+=result.size;
            var appliers=jobs[url];
            for(var a=0;a<appliers.length;a++){ try{ appliers[a](result.uri); }catch(_){} }
          }
          settle();
        });
      })(urls[u2]);
    }
  }
  function serializeSnapshot(root){
    var doctype='<!DOCTYPE html>\n';
    try{ if(document.doctype) doctype=new XMLSerializer().serializeToString(document.doctype)+'\n'; }catch(_){}
    var html=doctype+root.outerHTML;
    if(html.length>SNAPSHOT_MAX_HTML) return null;
    return html;
  }
  function buildSnapshotHtml(sx, sy, vw, vh, scale, cb){
    var untag=null, clone=null;
    try{
      untag=prepareCaptureFixups(sx, sy);
      clone=document.documentElement.cloneNode(true);
      snapshotCopyState(document.documentElement, clone, document);
      untag(); untag=null;
      sanitizeSnapshot(clone);
      absolutizeSnapshotUrls(clone);
      inlineSameOriginSheets(clone);
      applyCloneFixup(clone);
      var marked=clone.querySelectorAll('[data-bugaputa-fix]');
      for(var i=0;i<marked.length;i++) applyCloneFixup(marked[i]);
      anchorSnapshotViewport(clone, sx, sy, vw, vh, scale);
    }catch(err){
      console.warn('[Bugaputa] snapshot failed', err);
      if(untag) try{ untag(); }catch(_){}
      cb(null);
      return;
    }
    inlineSnapshotResources(clone, function(){
      var html=null;
      try{ html=serializeSnapshot(clone); }
      catch(err2){ console.warn('[Bugaputa] snapshot serialize fail', err2); }
      cb(html);
    });
  }
  function gzipSnapshotFile(html, cb){
    if(!html){ cb(null); return; }
    try{
      if(typeof CompressionStream!=='undefined' && typeof Response!=='undefined'){
        var stream=new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'));
        new Response(stream).blob().then(function(blob){
          if(blob.size>SNAPSHOT_MAX_GZ){ cb(null); return; }
          cb(new File([blob], 'snapshot.html.gz', {type:'application/gzip'}));
        }).catch(function(){ cb(null); });
        return;
      }
      cb(new File([html], 'snapshot.html', {type:'text/html'}));
    }catch(_){ cb(null); }
  }
  function fontProbe(){
    var cvs=document.createElement('canvas');
    var ctx=cvs.getContext('2d');
    if(!ctx) return null;
    var samples=[[16,'The quick brown fox jumps — 0123456789 iIl1|'],[24,'LIGHTWEIGHT · ACCESSIBLE · mmmwwwMMM']];
    return function(font){
      return samples.map(function(s){ ctx.font=s[0]+'px '+font; return ctx.measureText(s[1]).width; });
    };
  }
  function fontAvailable(measure, name, refs){
    var c='"'+name+'"';
    var viaMono=measure(c+', monospace'), viaSerif=measure(c+', serif');
    return (viaMono[0]!==refs.mono[0]||viaMono[1]!==refs.mono[1]) && (viaSerif[0]!==refs.serif[0]||viaSerif[1]!==refs.serif[1]);
  }
  function resolveGenericFont(measure, generic, candidates, refs){
    try{
      var target=measure(generic);
      var best=null;
      for(var i=0;i<candidates.length;i++){
        if(!fontAvailable(measure, candidates[i], refs)) continue;
        var w=measure('"'+candidates[i]+'"');
        var d=Math.abs(w[0]-target[0])+Math.abs(w[1]-target[1]);
        if(d<0.7) return {name:candidates[i], exact:true};
        if(!best || d<best.d) best={name:candidates[i], d:d};
      }
      if(best) return {name:best.name, exact:false};
    }catch(_){}
    return null;
  }
  var GENERIC_ALIASES={
    'system-ui':'sans', 'ui-sans-serif':'sans', '-apple-system':'sans', 'blinkmacsystemfont':'sans', 'ui-rounded':'sans',
    'ui-monospace':'mono', 'sfmono-regular':'mono',
    'ui-serif':'serif'
  };
  var CSS_GENERICS={'sans-serif':1,'serif':1,'monospace':1,'cursive':1,'fantasy':1,'emoji':1,'math':1,'fangsong':1};
  var _fontPins;
  function systemFontPins(){
    if(_fontPins!==undefined) return _fontPins;
    var measure=fontProbe();
    if(!measure){ _fontPins=null; return _fontPins; }
    var refs={mono:measure('monospace'), serif:measure('serif')};
    _fontPins={
      measure: measure,
      refs: refs,
      sans: resolveGenericFont(measure, 'system-ui', ['Segoe UI','Roboto','Helvetica Neue','Arial','Ubuntu','Cantarell','Noto Sans','DejaVu Sans','Liberation Sans','Oxygen','Fira Sans','Droid Sans','Helvetica'], refs),
      mono: resolveGenericFont(measure, 'ui-monospace', ['SF Mono','Menlo','Monaco','Consolas','Cascadia Mono','Segoe UI Mono','Roboto Mono','Ubuntu Mono','DejaVu Sans Mono','Liberation Mono','Noto Sans Mono','Fira Mono','Courier New'], refs),
      serif: resolveGenericFont(measure, 'ui-serif', ['New York','Georgia','Times New Roman','DejaVu Serif','Liberation Serif','Noto Serif','Times'], refs),
      stackCache: {}
    };
    return _fontPins;
  }
  function stackPin(pins, ff){
    var cache=pins.stackCache;
    if(ff in cache) return cache[ff];
    var pin=null, aliasClass=null, hasConcrete=false;
    var tokens=ff.split(',');
    for(var i=0;i<tokens.length;i++){
      var t=tokens[i].trim().replace(/^["']|["']$/g,'');
      var lt=t.toLowerCase();
      if(!aliasClass && GENERIC_ALIASES[lt]) aliasClass=GENERIC_ALIASES[lt];
      else if(!CSS_GENERICS[lt] && !GENERIC_ALIASES[lt] && lt.indexOf('emoji')===-1 && !hasConcrete){
        try{ hasConcrete=fontAvailable(pins.measure, t, pins.refs); }catch(_){}
      }
    }
    if(aliasClass){
      var res=pins[aliasClass];
      if(res && (res.exact || !hasConcrete)) pin='"'+res.name+'", '+ff;
    }
    cache[ff]=pin;
    return pin;
  }
  function pinCloneFonts(root){
    var pins=systemFontPins();
    if(!pins) return;
    var nodes=[root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!el.style) continue;
      var ff=el.style.fontFamily;
      if(!ff) continue;
      var pinned=stackPin(pins, ff);
      if(pinned) el.style.fontFamily=pinned;
    }
  }
  function captureScale(vw, vh){
    var scale=Math.min(window.devicePixelRatio||1, 3);
    var maxDim=4096;
    var largest=Math.max(vw, vh)||1;
    if(largest*scale>maxDim) scale=maxDim/largest;
    return scale;
  }
  function finishCapture(canvas, vw, vh, scale, statusEl, formWrap, chooser, capturePane, onErr){
    if(!canvas || canvas.width<10 || canvas.height<10){ onErr(new Error('Capture produced empty image')); return; }
    var dataUrl;
    try{ dataUrl=canvas.toDataURL('image/png'); }catch(e){ onErr(new Error('Tainted canvas: '+e.message)); return; }
    if(!dataUrl || dataUrl==='data:,'){ onErr(new Error('Blank capture')); return; }
    statusEl.style.display='none';
    capturedDataUrl=dataUrl;
    capturedDims={w:canvas.width, h:canvas.height, cssW: vw, cssH: vh, dpr: scale};
    canvas.toBlob(function(blob){
      if(!blob){ onErr(new Error('toBlob failed')); return; }
      if(capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
      capturedBlobUrl=URL.createObjectURL(blob);
      var ed=document.getElementById('bugaputa-annotate');
      if(ed && ed._onRaster){ ed._onRaster(canvas, capturedBlobUrl); return; }
      openAnnotateEditor(capturedBlobUrl, dataUrl, canvas, formWrap, chooser, capturePane);
    }, 'image/png');
  }
  function doCapture(statusEl, formWrap, chooser, capturePane){
    statusEl.style.display='block';
    statusEl.textContent='Preparing capture…';
    statusEl.style.color='#475569';
    var btn=document.getElementById('bugaputa-btn');
    var prevBtnDisplay=btn?btn.style.display:'';
    var prevOverlayDisplay=overlay?overlay.style.display:'';
    if(btn) btn.style.display='none';
    if(overlay) overlay.style.display='none';
    function fail(err){
      if(capturedSnapshotHtml){ console.warn('[Bugaputa] raster unavailable, snapshot only', err); return; }
      handleCaptureError(err, statusEl, formWrap, chooser, capturePane, btn, prevBtnDisplay, prevOverlayDisplay);
    }
    function ignoreFilter(el){
      return !(el.getAttribute && el.getAttribute(H2C_ATTR)!==null);
    }
    function captureLegacy(){
      function run(){
        try{
          var hc=window.html2canvas;
          if(!hc){ throw new Error('html2canvas not loaded'); }
          var sx=Math.round(window.scrollX||window.pageXOffset||0), sy=Math.round(window.scrollY||window.pageYOffset||0);
          var vw=window.innerWidth, vh=window.innerHeight;
          var scale=Math.min(window.devicePixelRatio||1, 2);
          var untag=prepareCaptureFixups(sx, sy);
          hc(document.body, {
            useCORS:true,
            allowTaint:false,
            backgroundColor: pageBackgroundColor(),
            scale: scale,
            logging:false,
            ignoreElements: function(el){ return el.hasAttribute && el.hasAttribute(H2C_ATTR); },
            x: sx, y: sy, width: vw, height: vh,
            windowWidth: vw, windowHeight: vh,
            scrollX: sx, scrollY: sy,
            onclone: function(clonedDoc){
              var fixed=clonedDoc.querySelectorAll('[data-bugaputa-fix]');
              for(var i=0;i<fixed.length;i++){
                var raw=fixed[i].getAttribute('data-bugaputa-fix');
                var f; try{ f=JSON.parse(raw); }catch(_){ f=null; }
                if(f && f.kind==='placeholder') applyCloneFixup(fixed[i], 'legacy');
                else fixed[i].removeAttribute('data-bugaputa-fix');
              }
            }
          }).then(function(canvas){
            untag();
            finishCapture(canvas, vw, vh, scale, statusEl, formWrap, chooser, capturePane, fail);
          }).catch(function(err){ untag(); fail(err); });
        }catch(err){ fail(err); }
      }
      if(window.html2canvas){ run(); return; }
      statusEl.textContent='Loading…';
      loadScript(scriptBase()+'/html2canvas.min.js', run, fail);
    }
    function captureModern(){
      statusEl.textContent='Capturing…';
      setTimeout(function(){
        var ms=window.modernScreenshot;
        if(!ms || !ms.domToCanvas){ captureLegacy(); return; }
        var sx=Math.round(window.scrollX||window.pageXOffset||0), sy=Math.round(window.scrollY||window.pageYOffset||0);
        var vw=window.innerWidth, vh=window.innerHeight;
        var scale=captureScale(vw, vh);
        var untag=prepareCaptureFixups(sx, sy);
        var fontsReady=(document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function(){}) : Promise.resolve();
        var timer=null;
        var timedOut=new Promise(function(_, reject){ timer=setTimeout(function(){ reject(new Error('Capture timed out')); }, 20000); });
        Promise.race([
          fontsReady.then(function(){
            return ms.domToCanvas(document.documentElement, {
              scale: scale,
              width: vw,
              height: vh,
              style: { transform: 'translate('+(-sx)+'px,'+(-sy)+'px)' },
              filter: ignoreFilter,
              backgroundColor: pageBackgroundColor(),
              onCloneNode: function(root){
                if(root && root.querySelectorAll){
                  applyCloneFixup(root);
                  var marked=root.querySelectorAll('[data-bugaputa-fix]');
                  for(var i=0;i<marked.length;i++) applyCloneFixup(marked[i]);
                  pinCloneFonts(root);
                }
              }
            });
          }),
          timedOut
        ]).then(function(canvas){
          clearTimeout(timer); untag();
          finishCapture(canvas, vw, vh, scale, statusEl, formWrap, chooser, capturePane, function(err){
            console.warn('[Bugaputa] capture post failed, fallback', err);
            captureLegacy();
          });
        }).catch(function(err){
          clearTimeout(timer); untag();
          console.warn('[Bugaputa] primary capture failed, fallback', err);
          captureLegacy();
        });
      }, 160);
    }
    statusEl.textContent='Capturing…';
    var snapSx=Math.round(window.scrollX||window.pageXOffset||0), snapSy=Math.round(window.scrollY||window.pageYOffset||0);
    var snapVw=window.innerWidth, snapVh=window.innerHeight;
    var snapScale=captureScale(snapVw, snapVh);
    function startRaster(){
      if(window.modernScreenshot){ captureModern(); return; }
      loadScript(scriptBase()+'/modern-screenshot.min.js', captureModern, function(){
        captureLegacy();
      });
    }
    buildSnapshotHtml(snapSx, snapSy, snapVw, snapVh, snapScale, function(html){
      capturedSnapshotHtml=html;
      if(capturedSnapshotHtml){
        statusEl.style.display='none';
        capturedDims={w:Math.round(snapVw*snapScale), h:Math.round(snapVh*snapScale), cssW:snapVw, cssH:snapVh, dpr:snapScale};
        openAnnotateEditor(null, null, null, formWrap, chooser, capturePane);
      } else {
        statusEl.textContent='Loading…';
      }
      startRaster();
    });
  }
  function handleCaptureError(err, statusEl, formWrap, chooser, capturePane, btn, prevBtnDisplay, prevOverlayDisplay){
    console.warn('[Bugaputa] capture fail', err);
    statusEl.style.display='block';
    statusEl.style.color='#dc2626';
    statusEl.textContent=(err&&err.message?err.message:'Capture fail')+' — you can still send feedback via image upload below.';
    if(btn) btn.style.display=prevBtnDisplay||'';
    if(overlay) overlay.style.display=prevOverlayDisplay||'flex';
    var fallbackBtn=document.getElementById('bugaputa-fallback-upload');
    if(!fallbackBtn){
      fallbackBtn=h('button',{id:'bugaputa-fallback-upload',type:'button',text:'Continue with image upload'});
      fallbackBtn.style.marginTop='10px';
      fallbackBtn.addEventListener('click', function(){
        capturePane.style.display='none';
        chooser.style.display='none';
        showForm(null);
      });
      capturePane.appendChild(fallbackBtn);
      fallbackBtn.focus();
    }
  }
  function openAnnotateEditor(blobUrl, dataUrl, capCanvas, formWrap, chooser, capturePane){
    if(overlay) overlay.style.display='none';
    document.body.style.overflow='hidden';
    var ed=h('div',{id:'bugaputa-annotate',H2C_ATTR:'true',role:'dialog','aria-modal':'true','aria-label':'Annotate screenshot'});
    var PALETTE=['#ef4444','#f59e0b','#22c55e','#3b82f6','#ec4899'];
    var state={
      tool:'select',
      color:PALETTE[0],
      annotations:[],
      selectedId:null,
      nextPin:1,
      undoStack:[],
      redoStack:[]
    };
    function pushUndo(){
      state.undoStack.push(JSON.stringify(state.annotations));
      if(state.undoStack.length>40) state.undoStack.shift();
      state.redoStack=[];
      updateUndoRedo();
    }
    function doUndo(){
      if(!state.undoStack.length) return;
      state.redoStack.push(JSON.stringify(state.annotations));
      var prev=state.undoStack.pop();
      state.annotations=JSON.parse(prev);
      state.selectedId=null;
      renderAll();
      updateUndoRedo();
    }
    function doRedo(){
      if(!state.redoStack.length) return;
      state.undoStack.push(JSON.stringify(state.annotations));
      var nxt=state.redoStack.pop();
      state.annotations=JSON.parse(nxt);
      state.selectedId=null;
      renderAll();
      updateUndoRedo();
    }
    var header=h('div',{id:'bugaputa-ann-header'});
    var hTitle=h('div',{text:'Annotate screenshot',style:'font-weight:700;font-size:14px'});
    var paletteWrap=h('div',{id:'bugaputa-palette'});
    PALETTE.forEach(function(c){
      var b=h('button',{type:'button','aria-label':'Color '+c, title:'Color '+c});
      b.style.background=c; b.style.width='44px'; b.style.height='44px'; b.style.borderRadius='999px'; b.style.border='2px solid transparent';
      b.style.cursor='pointer';
      if(c===state.color) b.style.borderColor='#0f172a';
      b.addEventListener('click', function(){ state.color=c; Array.from(paletteWrap.children).forEach(function(ch){ ch.style.borderColor='transparent'; }); b.style.borderColor='#0f172a'; });
      paletteWrap.appendChild(b);
    });
    var hdrActions=h('div',{style:'display:flex;gap:8px;align-items:center'});
    var btnCancel=h('button',{id:'bugaputa-ann-cancel',type:'button',text:'Cancel'});
    btnCancel.setAttribute('aria-label','Cancel annotation');
    var btnDone=h('button',{id:'bugaputa-ann-done',type:'button',text:'Done'});
    btnDone.setAttribute('aria-label','Done and continue to form');
    hdrActions.appendChild(btnCancel); hdrActions.appendChild(btnDone);
    header.appendChild(hTitle); header.appendChild(paletteWrap); header.appendChild(hdrActions);
    var stage=h('div',{id:'bugaputa-ann-stage'});
    var bgImg=h('img',{id:'bugaputa-ann-bg',alt:'Captured page',src:blobUrl||''});
    var canvasWrap=h('div',{id:'bugaputa-ann-canvas-wrap'});
    var cvs=document.createElement('canvas');
    cvs.id='bugaputa-ann-canvas';
    cvs.width=capturedDims.cssW;
    cvs.height=capturedDims.cssH;
    cvs.style.width='100%';
    cvs.style.height='100%';
    bgImg.style.width='100%';
    bgImg.style.height='100%';
    var frame=null;
    if(capturedSnapshotHtml){
      frame=document.createElement('iframe');
      frame.id='bugaputa-ann-frame';
      frame.setAttribute('sandbox','');
      frame.setAttribute('referrerpolicy','no-referrer');
      frame.setAttribute('aria-hidden','true');
      frame.setAttribute('width', String(capturedDims.cssW));
      frame.setAttribute('height', String(capturedDims.cssH));
      frame.style.cssText='position:absolute;left:0;top:0;border:0;pointer-events:none;transform-origin:0 0;background:#fff';
      frame.srcdoc=capturedSnapshotHtml;
      canvasWrap.appendChild(frame);
      bgImg.style.display='none';
    }
    canvasWrap.style.overflow='hidden';
    canvasWrap.appendChild(bgImg);
    canvasWrap.appendChild(cvs);
    stage.appendChild(canvasWrap);
    var toolbar=h('div',{id:'bugaputa-ann-toolbar',role:'toolbar','aria-label':'Annotation tools'});
    var tools=[
      {id:'select',label:'Select / move',icon:'👆'},
      {id:'pen',label:'Pen',icon:'✏️'},
      {id:'arrow',label:'Arrow',icon:'➡️'},
      {id:'rect',label:'Rectangle',icon:'🔲'},
      {id:'text',label:'Text',icon:'🔤'},
      {id:'pin',label:'Numbered pin',icon:'📌'}
    ];
    var toolBtns={};
    tools.forEach(function(t){
      var b=h('button',{type:'button',text:t.icon,'aria-label':t.label, title:t.label});
      b.dataset.tool=t.id;
      b.style.minWidth='44px'; b.style.minHeight='44px';
      b.addEventListener('click', function(){ setTool(t.id); });
      toolBtns[t.id]=b;
      toolbar.appendChild(b);
    });
    var sep=h('div',{style:'width:1px;height:24px;background:#e2e8f0;margin:0 4px','aria-hidden':'true'});
    toolbar.appendChild(sep);
    var btnUndo=h('button',{type:'button',text:'↩️','aria-label':'Undo', title:'Undo'});
    var btnRedo=h('button',{type:'button',text:'↪️','aria-label':'Redo', title:'Redo'});
    var btnDel=h('button',{type:'button',text:'🗑️','aria-label':'Delete selected', title:'Delete selected'});
    var btnClear=h('button',{type:'button',text:'🧹','aria-label':'Clear all', title:'Clear all'});
    [btnUndo,btnRedo,btnDel,btnClear].forEach(function(b){ b.style.minWidth='44px'; b.style.minHeight='44px'; });
    btnUndo.addEventListener('click', doUndo);
    btnRedo.addEventListener('click', doRedo);
    btnDel.addEventListener('click', function(){
      if(!state.selectedId) return;
      pushUndo();
      state.annotations=state.annotations.filter(function(a){ return a.id!==state.selectedId; });
      state.selectedId=null;
      renderAll();
    });
    btnClear.addEventListener('click', function(){
      if(!state.annotations.length) return;
      if(!confirm('Clear all annotations?')) return;
      pushUndo();
      state.annotations=[]; state.selectedId=null; renderAll();
    });
    toolbar.appendChild(btnUndo); toolbar.appendChild(btnRedo); toolbar.appendChild(btnDel); toolbar.appendChild(btnClear);
    function updateUndoRedo(){
      btnUndo.disabled=state.undoStack.length===0;
      btnRedo.disabled=state.redoStack.length===0;
      btnDel.disabled=!state.selectedId;
      btnUndo.style.opacity=btnUndo.disabled?'0.4':'1';
      btnRedo.style.opacity=btnRedo.disabled?'0.4':'1';
      btnDel.style.opacity=btnDel.disabled?'0.4':'1';
    }
    function setTool(t){
      state.tool=t;
      Object.keys(toolBtns).forEach(function(k){
        var b=toolBtns[k];
        if(k===t){ b.style.background='#a3e635'; b.style.color='#0f172a'; b.setAttribute('aria-pressed','true'); }
        else { b.style.background='#fff'; b.style.color='#0f172a'; b.setAttribute('aria-pressed','false'); }
      });
      cvs.style.cursor = t==='select' ? 'default' : 'crosshair';
    }
    setTool('pen');
    updateUndoRedo();
    ed.appendChild(header);
    ed.appendChild(stage);
    ed.appendChild(toolbar);
    document.body.appendChild(ed);
    function applyFit(){
      var cs=getComputedStyle(stage);
      var padL=parseFloat(cs.paddingLeft)||0, padR=parseFloat(cs.paddingRight)||0, padT=parseFloat(cs.paddingTop)||0, padB=parseFloat(cs.paddingBottom)||0;
      var availW=Math.max(0, stage.clientWidth - padL - padR);
      var availH=Math.max(0, stage.clientHeight - padT - padB);
      if(availW<10 || availH<10){
        var r=stage.getBoundingClientRect();
        availW=Math.max(0, r.width - padL - padR);
        availH=Math.max(0, r.height - padT - padB);
      }
      if(availW<10 || availH<10 || !capturedDims) return;
      var sx=availW / capturedDims.cssW;
      var sy=availH / capturedDims.cssH;
      var scale=Math.min(1, sx, sy);
      var w=Math.max(1, Math.floor(capturedDims.cssW * scale));
      var h=Math.max(1, Math.floor(capturedDims.cssH * scale));
      canvasWrap.style.width=w+'px';
      canvasWrap.style.height=h+'px';
      if(frame) frame.style.transform='scale('+(w/capturedDims.cssW)+')';
    }
    requestAnimationFrame(function(){ applyFit(); requestAnimationFrame(applyFit); });
    var _ro=null;
    if(typeof ResizeObserver!=='undefined'){
      _ro=new ResizeObserver(function(){ applyFit(); });
      _ro.observe(stage);
    }
    var _onWinResize=function(){ applyFit(); };
    window.addEventListener('resize', _onWinResize);
    var _applyFitCleanup=function(){
      window.removeEventListener('resize', _onWinResize);
      if(_ro) try{ _ro.disconnect(); }catch(_){}
    };
    ed._annCount=function(){ return state.annotations.length; };
    ed._onRaster=function(canvas, blobUrl2){
      capCanvas=canvas;
      if(blobUrl2 && !frame){ bgImg.src=blobUrl2; bgImg.style.display=''; }
    };
    function edTrap(e){
      if(e.key==='Escape'){ e.preventDefault(); requestDiscard(); return; }
      if(e.key==='Delete' || e.key==='Backspace'){
        if(state.selectedId){
          e.preventDefault();
          pushUndo();
          state.annotations=state.annotations.filter(function(a){ return a.id!==state.selectedId; });
          state.selectedId=null;
          renderAll();
          return;
        }
      }
      if(e.key!=='Tab') return;
      var focusable=ed.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
      if(!focusable.length) return;
      var first=focusable[0], last=focusable[focusable.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', edTrap);
    ed._cleanup=function(){ document.removeEventListener('keydown', edTrap); document.body.style.overflow=''; try{ _applyFitCleanup(); }catch(_){} };
    var ctx=cvs.getContext('2d');
    var dpr=window.devicePixelRatio||1;
    function cssPoint(e){
      if(liveVideoActive) return getDocPoint(e);
      var rect=cvs.getBoundingClientRect();
      if(!rect.width || !rect.height) return {x:0,y:0};
      var sx=capturedDims.cssW / rect.width;
      var sy=capturedDims.cssH / rect.height;
      var x=(e.clientX - rect.left) * sx;
      var y=(e.clientY - rect.top) * sy;
      x=Math.max(0, Math.min(capturedDims.cssW, x));
      y=Math.max(0, Math.min(capturedDims.cssH, y));
      return {x:x, y:y};
    }
    function wrapText(text, ctx2, maxW){
      var paras=String(text||'').split('\n');
      var out=[];
      for(var pi=0;pi<paras.length;pi++){
        var para=paras[pi];
        if(!para){ out.push(''); continue; }
        var words=para.split(/\s+/);
        var cur='';
        for(var wi=0;wi<words.length;wi++){
          var w=words[wi];
          if(!w) continue;
          if(ctx2.measureText(w).width>maxW){
            if(cur){ out.push(cur); cur=''; }
            var curW='';
            for(var ci=0;ci<w.length;ci++){
              var testW=curW+w[ci];
              if(ctx2.measureText(testW).width>maxW && curW){ out.push(curW); curW=w[ci]; } else curW=testW;
            }
            if(curW) cur=curW;
            continue;
          }
          var test=cur?cur+' '+w:w;
          if(ctx2.measureText(test).width<=maxW) cur=test;
          else { if(cur) out.push(cur); cur=w; }
        }
        if(cur) out.push(cur);
        else if(!out.length || out[out.length-1]!=='') out.push('');
      }
      if(!out.length) out.push('');
      return out;
    }
    function pointInPolygon(pt, pts){
      var x=pt.x, y=pt.y, inside=false;
      for(var i=0,j=pts.length-1;i<pts.length;j=i++){
        var xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
        var intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
        if(intersect) inside=!inside;
      }
      return inside;
    }
    function isClosedPen(pts){
      if(!pts||pts.length<8) return false;
      var d=Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]);
      if(d>=25) return false;
      var xs=pts.map(function(p){return p[0]}), ys=pts.map(function(p){return p[1]});
      var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
      var w=maxX-minX, h=maxY-minY;
      if(w<1||h<1) return false;
      var asp=Math.min(w,h)/Math.max(w,h);
      return asp>0.4;
    }
    function hitTest(pt){
      var rect=cvs.getBoundingClientRect(); var s=(capturedDims&&capturedDims.cssW)? rect.width/capturedDims.cssW : 1; var modelTol=Math.min(18, Math.max(10, 14 / s));
      for(var i=state.annotations.length-1;i>=0;i--){
        var a=state.annotations[i];
        if(a.type==='rect'){
          var minX=Math.min(a.x, a.x2), maxX=Math.max(a.x,a.x2), minY=Math.min(a.y,a.y2), maxY=Math.max(a.y,a.y2);
          if(pt.x>=minX-6 && pt.x<=maxX+6 && pt.y>=minY-6 && pt.y<=maxY+6) return a;
        } else if(a.type==='arrow'){
          var d=distToSeg(pt, {x:a.x,y:a.y},{x:a.x2,y:a.y2});
          if(d<modelTol) return a;
        } else if(a.type==='pen'){
          if(isClosedPen(a.points) && pointInPolygon(pt, a.points)) return a;
          if(a.points.length>=2){
            for(var p=0;p<a.points.length-1;p++){
              var d2=distToSeg(pt, {x:a.points[p][0],y:a.points[p][1]}, {x:a.points[p+1][0],y:a.points[p+1][1]});
              if(d2<modelTol) return a;
            }
          }
          for(var p2=0;p2<a.points.length;p2++){ var q=a.points[p2]; if(Math.hypot(q[0]-pt.x,q[1]-pt.y)<modelTol) return a; }
        } else if(a.type==='text'){
          ctx.font='14px Inter, system-ui, sans-serif';
          var maxW=Math.max(120, cvs.width - a.x - 12);
          var lines=wrapText(a.text||'', ctx, maxW);
          var maxLineW=0; for(var li=0;li<lines.length;li++){ var ww=ctx.measureText(lines[li]).width; if(ww>maxLineW) maxLineW=ww; }
          var totalH=lines.length*16;
          var hitClampX=Math.max(4, Math.min(a.x, cvs.width - maxLineW - 12));
          var hitClampY=Math.max(2, Math.min(a.y, cvs.height - totalH - 4));
          var x0=hitClampX-4, y0=hitClampY-2, x1=hitClampX+maxLineW+8, y1=hitClampY+totalH+2;
          if(pt.x>=x0 && pt.x<=x1 && pt.y>=y0 && pt.y<=y1) return a;
        } else if(a.type==='pin'){
          if(Math.hypot(pt.x-a.x, pt.y-a.y)<=16) return a;
          if(a.text){
            ctx.font='12px Inter, system-ui';
            var pLines=wrapText(a.text, ctx, 220);
            var pMaxW=0; for(var pj=0;pj<pLines.length;pj++){ var w2=ctx.measureText(pLines[pj]).width; if(w2>pMaxW) pMaxW=w2; }
            var pad=6, tw2=pMaxW+pad*2, th2=pLines.length*14+8;
            var bx2=a.x+18, by2=a.y-14;
            if(bx2+tw2>cvs.width) bx2=a.x - tw2 - 10;
            if(by2<4) by2=a.y+10;
            bx2=Math.max(4, Math.min(bx2, cvs.width - tw2 - 4));
            by2=Math.max(4, Math.min(by2, cvs.height - th2 - 4));
            if(pt.x>=bx2 && pt.x<=bx2+tw2 && pt.y>=by2 && pt.y<=by2+th2) return a;
          }
        }
      }
      return null;
    }
    function distToSeg(p, a,b){
      var A=p.x-a.x, B=p.y-a.y, C=b.x-a.x, D=b.y-a.y;
      var dot=A*C+B*D, len=C*C+D*D, t=len?dot/len:0;
      t=Math.max(0,Math.min(1,t));
      var xx=a.x+C*t, yy=a.y+D*t;
      return Math.hypot(p.x-xx, p.y-yy);
    }
    function genId(){ return 'a_'+Math.random().toString(36).slice(2,9); }
    var drawing=null, dragging=null, dragOff=null;
    function renderAll(){
      ctx.clearRect(0,0,cvs.width,cvs.height);
      state.annotations.forEach(function(a){
        var isSel=a.id===state.selectedId;
        ctx.save();
        ctx.strokeStyle=a.color;
        ctx.fillStyle=a.color;
        ctx.lineWidth=isSel?3:2.5;
        ctx.lineCap='round'; ctx.lineJoin='round';
        if(a.type==='rect'){
          var x=Math.min(a.x,a.x2), y=Math.min(a.y,a.y2), w=Math.abs(a.x2-a.x), h=Math.abs(a.y2-a.y);
          ctx.strokeRect(x,y,w,h);
          if(isSel){ ctx.setLineDash([6,4]); ctx.strokeStyle='#0f172a'; ctx.strokeRect(x-2,y-2,w+4,h+4); ctx.setLineDash([]); }
        } else if(a.type==='arrow'){
          drawArrow(ctx, a.x,a.y,a.x2,a.y2, isSel);
        } else if(a.type==='pen'){
          if(a.points.length<2) { ctx.beginPath(); ctx.arc(a.points[0][0],a.points[0][1],2,0,Math.PI*2); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(a.points[0][0],a.points[0][1]); for(var i=1;i<a.points.length;i++) ctx.lineTo(a.points[i][0],a.points[i][1]); ctx.stroke(); }
          if(isSel){
            var xs=a.points.map(function(p){return p[0]}), ys=a.points.map(function(p){return p[1]});
            var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
            ctx.setLineDash([6,4]); ctx.strokeStyle='#0f172a'; ctx.strokeRect(minX-4,minY-4,maxX-minX+8,maxY-minY+8); ctx.setLineDash([]);
          }
        } else if(a.type==='text'){
          ctx.font='14px Inter, system-ui, sans-serif';
          ctx.fillStyle=a.color;
          var tMaxW=Math.max(120, cvs.width - a.x - 12);
          var tLines=wrapText(a.text||'', ctx, tMaxW);
          var tMaxLineW=0; for(var ti=0;ti<tLines.length;ti++){ var twm=ctx.measureText(tLines[ti]).width; if(twm>tMaxLineW) tMaxLineW=twm; }
          var tClampX=Math.max(4, Math.min(a.x, cvs.width - tMaxLineW - 12));
          var tClampY=Math.max(2, Math.min(a.y, cvs.height - tLines.length*16 - 4));
          tLines.forEach(function(line, idx){ ctx.fillText(line, tClampX, tClampY+16+idx*16); });
          if(isSel){
            ctx.setLineDash([6,4]); ctx.strokeStyle='#0f172a'; ctx.strokeRect(tClampX-4,tClampY-2,tMaxLineW+8,tLines.length*16+4); ctx.setLineDash([]);
          }
        } else if(a.type==='pin'){
          ctx.beginPath(); ctx.arc(a.x,a.y,14,0,Math.PI*2); ctx.fillStyle=a.color; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
          ctx.fillStyle='#fff'; ctx.font='bold 12px Inter, system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(a.n), a.x, a.y);
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
          if(a.text){
            ctx.font='12px Inter, system-ui';
            var pinLines=wrapText(a.text, ctx, 220);
            var pinMaxW=0; for(var pi2=0;pi2<pinLines.length;pi2++){ var pwm=ctx.measureText(pinLines[pi2]).width; if(pwm>pinMaxW) pinMaxW=pwm; }
            var pad=6, tw=pinMaxW+pad*2, th=pinLines.length*14+8;
            var bx=a.x+18, by=a.y-14;
            if(bx+tw>cvs.width) bx=a.x - tw - 10;
            bx=Math.max(4, Math.min(bx, cvs.width - tw - 4));
            if(by<4) by=a.y+10;
            by=Math.max(4, Math.min(by, cvs.height - th - 4));
            ctx.fillStyle='rgba(15,23,42,.96)'; ctx.strokeStyle='rgba(255,255,255,.9)';
            ctx.beginPath(); var r=8; ctx.moveTo(bx+r,by); ctx.lineTo(bx+tw-r,by); ctx.quadraticCurveTo(bx+tw,by,bx+tw,by+r); ctx.lineTo(bx+tw,by+th-r); ctx.quadraticCurveTo(bx+tw,by+th,bx+tw-r,by+th); ctx.lineTo(bx+r,by+th); ctx.quadraticCurveTo(bx,by+th,bx,by+th-r); ctx.lineTo(bx,by+r); ctx.quadraticCurveTo(bx,by,bx+r,by); ctx.closePath(); ctx.fill(); ctx.lineWidth=1; ctx.stroke();
            ctx.fillStyle='#fff'; ctx.font='12px Inter, system-ui';
            pinLines.forEach(function(pl, pidx){ ctx.fillText(pl, bx+pad, by+13+pidx*14); });
          }
          if(isSel){ ctx.setLineDash([6,4]); ctx.strokeStyle='#0f172a'; ctx.lineWidth=2; ctx.strokeRect(a.x-16,a.y-16,32,32); ctx.setLineDash([]); }
        }
        ctx.restore();
      });
      updateUndoRedo();
    }
    function drawArrow(c, x1,y1,x2,y2, sel){
      c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
      var ang=Math.atan2(y2-y1,x2-x1);
      var len=14;
      c.beginPath();
      c.moveTo(x2,y2);
      c.lineTo(x2-len*Math.cos(ang-Math.PI/6), y2-len*Math.sin(ang-Math.PI/6));
      c.lineTo(x2-len*Math.cos(ang+Math.PI/6), y2-len*Math.sin(ang+Math.PI/6));
      c.closePath(); c.fill();
      if(sel){
        c.setLineDash([6,4]); c.strokeStyle='#0f172a'; c.strokeRect(Math.min(x1,x2)-4,Math.min(y1,y2)-4,Math.abs(x2-x1)+8,Math.abs(y2-y1)+8); c.setLineDash([]);
      }
    }
    var isPointerDown=false;
    cvs.addEventListener('pointerdown', function(e){
      cvs.setPointerCapture(e.pointerId);
      isPointerDown=true;
      var pt=cssPoint(e);
      if(state.tool==='select'){
        var hit=hitTest(pt);
        if(hit){
          pushUndo();
          state.selectedId=hit.id;
          dragging=hit;
          if(hit.type==='text'){
            ctx.font='14px Inter, system-ui, sans-serif';
            var dragClampX=hit.x, dragClampY=hit.y;
            for(var dragLayoutPass=0;dragLayoutPass<4;dragLayoutPass++){
              var dragInitMaxW=Math.max(120, cvs.width - dragClampX - 12);
              var dragInitLines=wrapText(hit.text||'', ctx, dragInitMaxW);
              var dragInitLineW=0; for(var dli=0;dli<dragInitLines.length;dli++){ var dliw=ctx.measureText(dragInitLines[dli]).width; if(dliw>dragInitLineW) dragInitLineW=dliw; }
              var dragNextX=Math.max(4, Math.min(dragClampX, cvs.width - dragInitLineW - 12));
              var dragNextY=Math.max(2, Math.min(hit.y, cvs.height - dragInitLines.length*16 - 4));
              if(dragNextX===dragClampX && dragNextY===dragClampY) break;
              dragClampX=dragNextX; dragClampY=dragNextY;
            }
            hit.x=dragClampX; hit.y=dragClampY;
          }
          dragOff={x: pt.x - hit.x, y: pt.y - hit.y};
          if(hit.type==='rect' || hit.type==='arrow'){
            dragOff.x2=pt.x - hit.x2; dragOff.y2=pt.y - hit.y2;
          }
          if(hit.type==='pen'){
            dragOff.pts=hit.points.map(function(p){ return [p[0]-pt.x, p[1]-pt.y]; });
          }
          renderAll();
        } else {
          state.selectedId=null;
          renderAll();
        }
        return;
      }
      if(state.tool==='text'){
        var txt=prompt('Enter text (plain text only):','');
        if(txt===null) return;
        txt=String(txt).slice(0,200);
        if(!txt.trim()) return;
        pushUndo();
        state.annotations.push({id:genId(), type:'text', x:pt.x, y:pt.y, text:txt, color:state.color});
        state.selectedId=state.annotations[state.annotations.length-1].id;
        renderAll();
        return;
      }
      if(state.tool==='pin'){
        var cmt=prompt('Pin comment (plain text, max 180 chars):','');
        if(cmt===null) return;
        cmt=String(cmt).slice(0,180);
        pushUndo();
        state.annotations.push({id:genId(), type:'pin', x:pt.x, y:pt.y, text:cmt.trim(), color:state.color, n: state.nextPin++});
        state.selectedId=state.annotations[state.annotations.length-1].id;
        renderAll();
        return;
      }
      pushUndo();
      isPointerDown=true;
      if(state.tool==='pen'){
        drawing={id:genId(), type:'pen', color:state.color, points:[[pt.x,pt.y]]};
      } else if(state.tool==='rect'){
        drawing={id:genId(), type:'rect', color:state.color, x:pt.x, y:pt.y, x2:pt.x, y2:pt.y};
      } else if(state.tool==='arrow'){
        drawing={id:genId(), type:'arrow', color:state.color, x:pt.x, y:pt.y, x2:pt.x, y2:pt.y};
      }
      if(drawing){ state.annotations.push(drawing); renderAll(); }
    });
    cvs.addEventListener('pointermove', function(e){
      var pt=cssPoint(e);
      if(state.tool==='select' && dragging && isPointerDown){
        if(dragging.type==='text' || dragging.type==='pin'){
          var nx=pt.x - dragOff.x, ny=pt.y - dragOff.y;
          if(dragging.type==='text'){
            ctx.font='14px Inter, system-ui, sans-serif';
            var dragMaxW=Math.max(120, cvs.width - nx - 12);
            var dLines=wrapText(dragging.text||'', ctx, dragMaxW);
            var dMaxW=0; for(var di=0;di<dLines.length;di++){ var dwm=ctx.measureText(dLines[di]).width; if(dwm>dMaxW) dMaxW=dwm; }
            var dH=dLines.length*16;
            nx=Math.max(4, Math.min(nx, cvs.width - dMaxW - 12));
            ny=Math.max(2, Math.min(ny, cvs.height - dH - 4));
          } else {
            nx=Math.max(14, Math.min(nx, cvs.width - 14));
            ny=Math.max(14, Math.min(ny, cvs.height - 14));
          }
          dragging.x=nx; dragging.y=ny;
        } else if(dragging.type==='rect' || dragging.type==='arrow'){
          dragging.x=pt.x - dragOff.x;
          dragging.y=pt.y - dragOff.y;
          dragging.x2=pt.x - dragOff.x2;
          dragging.y2=pt.y - dragOff.y2;
          var rMinX=Math.min(dragging.x, dragging.x2), rMaxX=Math.max(dragging.x, dragging.x2);
          var rMinY=Math.min(dragging.y, dragging.y2), rMaxY=Math.max(dragging.y, dragging.y2);
          var shiftX=0, shiftY=0;
          if(rMinX<0) shiftX=-rMinX; else if(rMaxX>cvs.width) shiftX=cvs.width - rMaxX;
          if(rMinY<0) shiftY=-rMinY; else if(rMaxY>cvs.height) shiftY=cvs.height - rMaxY;
          dragging.x+=shiftX; dragging.x2+=shiftX; dragging.y+=shiftY; dragging.y2+=shiftY;
        } else if(dragging.type==='pen'){
          for(var i=0;i<dragging.points.length;i++){ dragging.points[i][0]=pt.x + dragOff.pts[i][0]; dragging.points[i][1]=pt.y + dragOff.pts[i][1]; }
          var pMinX=Infinity, pMaxX=-Infinity, pMinY=Infinity, pMaxY=-Infinity;
          for(var pp=0;pp<dragging.points.length;pp++){ if(dragging.points[pp][0]<pMinX) pMinX=dragging.points[pp][0]; if(dragging.points[pp][0]>pMaxX) pMaxX=dragging.points[pp][0]; if(dragging.points[pp][1]<pMinY) pMinY=dragging.points[pp][1]; if(dragging.points[pp][1]>pMaxY) pMaxY=dragging.points[pp][1]; }
          var sX=0,sY=0; if(pMinX<0) sX=-pMinX; else if(pMaxX>cvs.width) sX=cvs.width-pMaxX; if(pMinY<0) sY=-pMinY; else if(pMaxY>cvs.height) sY=cvs.height-pMaxY;
          if(sX||sY) for(var qq=0;qq<dragging.points.length;qq++){ dragging.points[qq][0]+=sX; dragging.points[qq][1]+=sY; }
        }
        renderAll();
        return;
      }
      if(!drawing || !isPointerDown) return;
      if(drawing.type==='pen'){
        drawing.points.push([pt.x,pt.y]);
      } else if(drawing.type==='rect' || drawing.type==='arrow'){
        drawing.x2=pt.x; drawing.y2=pt.y;
      }
      renderAll();
    });
    function endPointer(e){
      if(!isPointerDown) return;
      isPointerDown=false;
      if(dragging){
        dragging._lastPt=null;
        dragging=null;
      }
      if(drawing){
        if(drawing.type==='pen' && drawing.points.length<2){
        }
        if((drawing.type==='rect' || drawing.type==='arrow') && Math.hypot(drawing.x2-drawing.x, drawing.y2-drawing.y)<6){
          state.annotations=state.annotations.filter(function(a){return a.id!==drawing.id;});
        } else {
          state.selectedId=drawing.id;
        }
        drawing=null;
        renderAll();
      }
      try{ cvs.releasePointerCapture(e.pointerId); }catch(_){}
    }
    cvs.addEventListener('pointerup', endPointer);
    cvs.addEventListener('pointercancel', endPointer);
    cvs.addEventListener('pointerleave', function(e){ if(isPointerDown) endPointer(e); });
    btnCancel.addEventListener('click', function(){ requestDiscard(); });
    function drawAnnotationsTo(octx, cssW){
      state.annotations.forEach(function(a){
        octx.save();
        octx.strokeStyle=a.color; octx.fillStyle=a.color; octx.lineWidth=2.5; octx.lineCap='round'; octx.lineJoin='round';
        if(a.type==='rect'){ var x=Math.min(a.x,a.x2), y=Math.min(a.y,a.y2), w=Math.abs(a.x2-a.x), h=Math.abs(a.y2-a.y); octx.strokeRect(x,y,w,h); }
        else if(a.type==='arrow'){ octx.beginPath(); octx.moveTo(a.x,a.y); octx.lineTo(a.x2,a.y2); octx.stroke(); var ang=Math.atan2(a.y2-a.y,a.x2-a.x); var len=14; octx.beginPath(); octx.moveTo(a.x2,a.y2); octx.lineTo(a.x2-len*Math.cos(ang-Math.PI/6), a.y2-len*Math.sin(ang-Math.PI/6)); octx.lineTo(a.x2-len*Math.cos(ang+Math.PI/6), a.y2-len*Math.sin(ang+Math.PI/6)); octx.closePath(); octx.fill(); }
        else if(a.type==='pen'){ if(a.points.length>=2){ octx.beginPath(); octx.moveTo(a.points[0][0],a.points[0][1]); for(var i=1;i<a.points.length;i++) octx.lineTo(a.points[i][0],a.points[i][1]); octx.stroke(); } else if(a.points.length===1){ octx.beginPath(); octx.arc(a.points[0][0],a.points[0][1],2,0,Math.PI*2); octx.fill(); } }
        else if(a.type==='text'){ octx.font='14px Inter, system-ui, sans-serif'; octx.fillStyle=a.color;
          (function(){ var tcsW=Math.max(120, cssW - a.x - 12); var oMax=0;
            var paras=String(a.text||'').split('\n'); var wLines=[];
            for(var pi=0;pi<paras.length;pi++){ var para=paras[pi]; if(!para){ wLines.push(''); continue; } var words=para.split(/\s+/); var cur=''; for(var wi=0;wi<words.length;wi++){ var w=words[wi]; if(!w) continue; if(octx.measureText(w).width>tcsW){ if(cur){ wLines.push(cur); cur=''; } var curW=''; for(var ci=0;ci<w.length;ci++){ var testW=curW+w[ci]; if(octx.measureText(testW).width>tcsW && curW){ wLines.push(curW); curW=w[ci]; } else curW=testW; } if(curW) cur=curW; continue; } var test=cur?cur+' '+w:w; if(octx.measureText(test).width<=tcsW) cur=test; else { if(cur) wLines.push(cur); cur=w; } } if(cur) wLines.push(cur); else if(!wLines.length||wLines[wLines.length-1]!=='') wLines.push(''); }
            if(!wLines.length) wLines.push('');
            for(var li=0;li<wLines.length;li++){ var ww=octx.measureText(wLines[li]).width; if(ww>oMax) oMax=ww; }
            var ox=Math.max(4, Math.min(a.x, cssW - oMax - 12)); var oy=Math.max(2, Math.min(a.y, cvs.height - wLines.length*16 - 4));
            wLines.forEach(function(line, idx){ octx.fillText(line, ox, oy+16+idx*16); });
          })(); }
        else if(a.type==='pin'){ octx.beginPath(); octx.arc(a.x,a.y,14,0,Math.PI*2); octx.fillStyle=a.color; octx.fill(); octx.strokeStyle='#fff'; octx.lineWidth=2; octx.stroke(); octx.fillStyle='#fff'; octx.font='bold 12px Inter, system-ui'; octx.textAlign='center'; octx.textBaseline='middle'; octx.fillText(String(a.n), a.x, a.y); octx.textAlign='left'; octx.textBaseline='alphabetic'; if(a.text){ (function(){ octx.font='12px Inter, system-ui'; var paras=String(a.text||'').split('\n'); var wLines=[]; var tcsW=220; for(var pi=0;pi<paras.length;pi++){ var para=paras[pi]; if(!para){ wLines.push(''); continue; } var words=para.split(/\s+/); var cur=''; for(var wi=0;wi<words.length;wi++){ var w=words[wi]; if(!w) continue; if(octx.measureText(w).width>tcsW){ if(cur){ wLines.push(cur); cur=''; } var curW=''; for(var ci=0;ci<w.length;ci++){ var testW=curW+w[ci]; if(octx.measureText(testW).width>tcsW && curW){ wLines.push(curW); curW=w[ci]; } else curW=testW; } if(curW) cur=curW; continue; } var test=cur?cur+' '+w:w; if(octx.measureText(test).width<=tcsW) cur=test; else { if(cur) wLines.push(cur); cur=w; } } if(cur) wLines.push(cur); else if(!wLines.length||wLines[wLines.length-1]!=='') wLines.push(''); } if(!wLines.length) wLines.push(''); var pMax=0; for(var li=0;li<wLines.length;li++){ var ww=octx.measureText(wLines[li]).width; if(ww>pMax) pMax=ww; } var pad=6, tw=pMax+pad*2, th=wLines.length*14+8; var bx=a.x+18, by=a.y-14; if(bx+tw>cssW) bx=a.x - tw - 10; bx=Math.max(4, Math.min(bx, cssW - tw - 4)); if(by<4) by=a.y+10; by=Math.max(4, Math.min(by, cvs.height - th - 4)); octx.fillStyle='rgba(15,23,42,.96)'; octx.strokeStyle='rgba(255,255,255,.9)'; octx.beginPath(); var r=8; octx.moveTo(bx+r,by); octx.lineTo(bx+tw-r,by); octx.quadraticCurveTo(bx+tw,by,bx+tw,by+r); octx.lineTo(bx+tw,by+th-r); octx.quadraticCurveTo(bx+tw,by+th,bx+tw-r,by+th); octx.lineTo(bx+r,by+th); octx.quadraticCurveTo(bx,by+th,bx,by+th-r); octx.lineTo(bx,by+r); octx.quadraticCurveTo(bx,by,bx+r,by); octx.closePath(); octx.fill(); octx.lineWidth=1; octx.stroke(); octx.fillStyle='#fff'; octx.font='12px Inter, system-ui'; wLines.forEach(function(pl, pidx){ octx.fillText(pl, bx+pad, by+13+pidx*14); }); })(); } }
        octx.restore();
      });
    }
    btnDone.addEventListener('click', function(){
      var exportScale=capturedDims.dpr|| (window.devicePixelRatio||1);
      var cssW=cvs.width, cssH=cvs.height;
      var layer=document.createElement('canvas');
      layer.width=Math.round(cssW*exportScale);
      layer.height=Math.round(cssH*exportScale);
      var lctx=layer.getContext('2d');
      lctx.scale(exportScale, exportScale);
      drawAnnotationsTo(lctx, cssW);
      function finish(){
        cleanupAnnotate();
        ed.remove();
        document.body.style.overflow='hidden';
        if(overlay) overlay.style.display='flex';
        chooser.style.display='none'; capturePane.style.display='none';
        showForm(null);
        if(capturedBlobUrl){ URL.revokeObjectURL(capturedBlobUrl); capturedBlobUrl=null; }
      }
      function withFlattened(next){
        var background=(capCanvas && capCanvas.width) ? capCanvas : (frame ? null : bgImg);
        if(!background){ next(); return; }
        var out=document.createElement('canvas');
        out.width=Math.round(cssW*exportScale);
        out.height=Math.round(cssH*exportScale);
        var octx=out.getContext('2d');
        octx.scale(exportScale, exportScale);
        try{ octx.drawImage(background, 0,0, cssW, cssH); }catch(_){ next(); return; }
        octx.drawImage(layer, 0,0, cssW, cssH);
        out.toBlob(function(blob){
          if(blob && blob.size<=5*1024*1024) pendingAnnotatedFile=new File([blob], 'annotated.png', {type:'image/png'});
          next();
        }, 'image/png');
      }
      layer.toBlob(function(layerBlob){
        if(layerBlob && layerBlob.size<=5*1024*1024 && state.annotations.length){
          pendingAnnotationsFile=new File([layerBlob], 'annotations.png', {type:'image/png'});
        }
        withFlattened(function(){
          gzipSnapshotFile(capturedSnapshotHtml, function(file){
            pendingSnapshotFile=file;
            if(!pendingAnnotatedFile && !pendingSnapshotFile){ alert('Failed to export image'); return; }
            finish();
          });
        });
      }, 'image/png');
    });
    cvs.addEventListener('dblclick', function(e){
      var pt=cssPoint(e);
      var hit=hitTest(pt);
      if(!hit) return;
      if(hit.type==='text'){
        var nt=prompt('Edit text:', hit.text||'');
        if(nt===null) return;
        nt=String(nt).slice(0,200);
        if(!nt.trim()) return;
        pushUndo();
        hit.text=nt;
        renderAll();
      } else if(hit.type==='pin'){
        var nc=prompt('Edit pin comment:', hit.text||'');
        if(nc===null) return;
        nc=String(nc).slice(0,180);
        pushUndo();
        hit.text=nc.trim();
        renderAll();
      }
    });
    renderAll();
    function prevent(e){ e.preventDefault(); }
    stage.addEventListener('touchmove', prevent, {passive:false});
    ed._cleanupExtra=function(){ stage.removeEventListener('touchmove', prevent); };
    var origCleanup=ed._cleanup;
    ed._cleanup=function(){ origCleanup(); if(ed._cleanupExtra) ed._cleanupExtra(); };
    setTimeout(function(){ btnDone.focus(); }, 50);
  }
  function createTrigger(){
    var existing=document.getElementById('bugaputa-btn');
    if(existing){ try{ existing.remove(); }catch(_){} }
    var label=widgetConfig.label||WIDGET_DEFAULTS.label;
    var color=widgetConfig.color||WIDGET_DEFAULTS.color;
    var pos=widgetConfig.position||WIDGET_DEFAULTS.position;
    var isLeft=pos==='left', isRight=pos==='right', isBottomLeft=pos==='bottom-left', isBottomRight=pos==='bottom-right';
    var vertical=isLeft||isRight;
    var btn=h('button',{
      id:'bugaputa-btn',
      role:'button',
      tabindex:'0',
      'aria-label': label,
      title: label,
      H2C_ATTR:'true'
    });
    if(!label) btn.setAttribute('aria-label','Feedback');
    var tabStyle='position:fixed;z-index:2147483640;display:flex;align-items:center;justify-content:center;cursor:pointer;'+
      'background:'+color+';color:#fff;border:none;padding:0;margin:0;'+
      'font-family:Inter,system-ui,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.02em;'+
      'box-shadow:0 4px 16px rgba(0,0,0,.24);'+
      'transition:transform 180ms ease, filter 180ms ease;'+
      'line-height:1;white-space:nowrap;user-select:none;-webkit-user-select:none;';
    if(vertical){
      var sidePos=isRight?'right:0;':'left:0;';
      var radius=isRight?'border-radius:8px 0 0 8px;':'border-radius:0 8px 8px 0;';
      tabStyle+='top:50%;'+sidePos+radius+'max-height:70vh;padding:14px 10px;'+
        'box-sizing:border-box;transform:translateY(-50%);'+
        'writing-mode:vertical-rl;text-orientation:mixed;';
      if(isLeft){
        tabStyle+='transform:translateY(-50%) rotate(180deg);';
      }
      btn.setAttribute('style', tabStyle);
      btn.textContent=label;
    } else {
      var bottomSide=isBottomRight?'right:20px;':'left:20px;';
      tabStyle+='bottom:0;'+bottomSide+'border-radius:8px 8px 0 0;'+
        'padding:10px 18px;min-height:36px;box-sizing:border-box;';
      btn.setAttribute('style', tabStyle);
      btn.textContent=label;
    }
    var hoverTransformVertical=isRight?'translateY(-50%) translateX(-4px)':'translateY(-50%) translateX(4px)';
    if(isLeft) hoverTransformVertical='translateY(-50%) rotate(180deg) translateX(4px)';
    var baseTransform=vertical?(isLeft?'translateY(-50%) rotate(180deg)':'translateY(-50%)'):'' ;
    function onEnter(){
      if(vertical){
        btn.style.transform=hoverTransformVertical;
      } else {
        btn.style.transform='translateY(-6px)';
      }
      btn.style.filter='brightness(1.08)';
    }
    function onLeave(){
      btn.style.transform=baseTransform;
      btn.style.filter='';
    }
    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mouseleave', onLeave);
    btn.addEventListener('focus', onEnter);
    btn.addEventListener('blur', onLeave);
    btn.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){
        e.preventDefault();
        open();
      }
    });
    btn.addEventListener('focus', function(){ btn.style.outline='2px solid #fff'; btn.style.outlineOffset='2px'; });
    btn.addEventListener('blur', function(){ btn.style.outline=''; btn.style.outlineOffset=''; });
    btn.addEventListener('click', open);
    return btn;
  }
  function mount(){
    if(script&&script.getAttribute('data-bugaputa-unmounted')==='true'){
      if(_revealTimer){ try{ clearTimeout(_revealTimer); }catch(_){} _revealTimer=null; }
      return;
    }
    var fastPath=(_initialLabel&&_initialColor&&_initialPos);
    if(fastPath){
      if(!document.body){ setTimeout(mount, 50); return; }
      revealOnce();
      return;
    }
    var needFetch=(!_initialLabel||!_initialColor||!_initialPos);
    if(needFetch&&!projectKey){
      if(!document.body){ setTimeout(mount, 50); return; }
      revealOnce();
      return;
    }
    if(!_revealed&&!_revealTimer){
      _revealTimer=setTimeout(function(){ if(!_revealed) revealOnce(); }, WIDGET_REVEAL_TIMEOUT_MS);
    }
    if(!document.body){ setTimeout(mount, 50); return; }
    if(_revealed) return;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
