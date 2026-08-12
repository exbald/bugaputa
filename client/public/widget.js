(function(){
  var script=document.currentScript||document.querySelector('script[data-project]');
  var projectKey=script&&script.getAttribute('data-project')||'';
  var API_BASE=(script&&script.getAttribute('data-api'))||'';
  var apiUrl=API_BASE?API_BASE+"/api/reports":"/api/reports";
  if(!projectKey){ console.warn('[Bugaputa] missing data-project'); }
  var link=document.createElement('link'); link.rel='stylesheet'; link.href=(API_BASE||'')+"/widget.css"; document.head.appendChild(link);
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
  function trapFocus(e){
    if(!overlay) return;
    if(e.key==='Escape'){ close(); return; }
    if(e.key!=='Tab') return;
    var focusable=overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(!focusable.length) return;
    var first=focusable[0], last=focusable[focusable.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  function close(){ if(overlay){ overlay.remove(); overlay=null; document.removeEventListener('keydown', trapFocus); if(lastFocus) lastFocus.focus(); } }
  function open(){
    lastFocus=document.activeElement;
    overlay=h('div',{id:'bugaputa-overlay'});
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    var modal=h('div',{id:'bugaputa-modal',role:'dialog','aria-modal':'true','aria-label':'Report a bug'});
    var title=h('h2',{text:'Report a bug'});
    var closeBtn=h('button',{text:'\u00D7','aria-label':'Close',style:'position:absolute;right:12px;top:12px;background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;min-width:44px;min-height:44px'});
    closeBtn.addEventListener('click', close);
    var form=h('form',{id:'bugaputa-form'}); form.noValidate=true;
    var msgLabel=h('label',{text:'Describe the bug *'});
    var textarea=h('textarea',{id:'bugaputa-msg',placeholder:'What went wrong? (10-2000 characters)',rows:'4',required:'','aria-required':'true'});
    var msgErr=h('div',{id:'bugaputa-error-msg',style:'display:none'}); msgErr.setAttribute('role','alert');
    msgLabel.appendChild(textarea); msgLabel.appendChild(msgErr);
    var emailLabel=h('label',{text:'Your email (optional, for follow-up)'});
    var emailInput=h('input',{type:'email',id:'bugaputa-email',placeholder:'you@example.com',autocomplete:'email'});
    var emailErr=h('div',{style:'display:none',id:'bugaputa-error-email'}); emailErr.setAttribute('role','alert');
    emailLabel.appendChild(emailInput); emailLabel.appendChild(emailErr);
    var fileLabel=h('label',{text:'Attach screenshot (optional)'});
    var fileInput=h('input',{type:'file',id:'bugaputa-file',accept:'image/png,image/jpeg,image/webp,image/gif'});
    var preview=h('div',{id:'bugaputa-preview'});
    fileInput.addEventListener('change', function(){
      preview.innerHTML=''; var f=fileInput.files[0]; if(!f) return; if(f.size>5*1024*1024){ preview.textContent='File too large (max 5MB)'; preview.style.color='#dc2626'; return; } var img=document.createElement('img'); img.alt='Screenshot preview'; img.src=URL.createObjectURL(f); preview.appendChild(img);
    });
    fileLabel.appendChild(fileInput); fileLabel.appendChild(preview);
    var hpWrap=h('div',{id:'bugaputa-hp','aria-hidden':'true'});
    var hpInput=h('input',{type:'text',name:'website',tabindex:'-1',autocomplete:'off',placeholder:'Leave empty'});
    hpWrap.appendChild(hpInput);
    var ctx=h('div',{id:'bugaputa-context'});
    var vw=window.innerWidth+'x'+window.innerHeight;
    ctx.innerHTML='<strong>Will be sent:</strong><br>URL: '+(location.href.length>80?location.href.slice(0,80)+'…':location.href)+'<br>Browser: '+(navigator.userAgent.slice(0,120))+'<br>Viewport: '+vw+'<br>Language: '+(navigator.language||'');
    var consent=h('div',{id:'bugaputa-consent',text:'We will send page URL, browser info, and your message. No passwords or sensitive data.'});
    var actions=h('div',{id:'bugaputa-actions'});
    var cancelBtn=h('button',{id:'bugaputa-cancel',type:'button',text:'Cancel'}); cancelBtn.addEventListener('click', close);
    var submitBtn=h('button',{id:'bugaputa-submit',type:'submit',text:'Send report'});
    actions.appendChild(cancelBtn); actions.appendChild(submitBtn);
    var success=h('div',{id:'bugaputa-success',style:'display:none'}); success.innerHTML='<p>Thanks! Report sent.</p><p style="font-size:13px;color:#64748b;margin-top:4px">We will look into it shortly.</p>';
    var errBox=h('div',{id:'bugaputa-error',style:'display:none'}); errBox.setAttribute('role','alert'); errBox.setAttribute('aria-live','polite');
    form.appendChild(msgLabel); form.appendChild(emailLabel); form.appendChild(fileLabel); form.appendChild(hpWrap); form.appendChild(ctx); form.appendChild(consent); form.appendChild(errBox); form.appendChild(actions);
    modal.appendChild(closeBtn); modal.appendChild(title); modal.appendChild(form); modal.appendChild(success);
    overlay.appendChild(modal); document.body.appendChild(overlay); document.addEventListener('keydown', trapFocus); setTimeout(function(){ textarea.focus(); }, 50);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      msgErr.style.display='none'; emailErr.style.display='none'; errBox.style.display='none';
      var msg=textarea.value.trim(); var email=emailInput.value.trim(); var hasError=false;
      if(msg.length<10){ msgErr.textContent='Please describe the bug (at least 10 characters).'; msgErr.style.display='block'; hasError=true; }
      else if(msg.length>2000){ msgErr.textContent='Message too long (max 2000 characters).'; msgErr.style.display='block'; hasError=true; }
      if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ emailErr.textContent='Enter a valid email or leave empty.'; emailErr.style.display='block'; hasError=true; }
      if(hpInput.value){ close(); return; }
      if(hasError) return;
      submitBtn.disabled=true; submitBtn.textContent='Sending...';
      var hasFile=fileInput.files && fileInput.files[0];
      var url=apiUrl; if(url.startsWith('/') && script && script.src){ try{ var u=new URL(script.src); url=u.origin+url; }catch(_){} }
      function onSuccess(){ form.style.display='none'; success.style.display='block'; setTimeout(close, 2200); }
      function onError(msg){ errBox.textContent=msg || 'Failed to send. Please try again.'; errBox.style.display='block'; submitBtn.disabled=false; submitBtn.textContent='Send report'; }
      if(hasFile){
        var fd=new FormData(); fd.append('message', msg); if(email) fd.append('contactEmail', email); fd.append('pageUrl', location.href); fd.append('userAgent', navigator.userAgent); fd.append('viewport', window.innerWidth+'x'+window.innerHeight); fd.append('language', navigator.language||''); fd.append('website', hpInput.value); fd.append('screenshot', fileInput.files[0]); if(projectKey) fd.append('projectKey', projectKey);
        fetch(url, {method:'POST', headers:{'x-project-key':projectKey}, body:fd}).then(function(r){ return r.text().then(function(t){ var d; try{d=JSON.parse(t)}catch{d=t}; return {ok:r.ok,status:r.status,data:d}; }); }).then(function(res){ if(res.ok) onSuccess(); else onError((res.data&&res.data.error)||'Failed to send ('+res.status+')'); }).catch(function(){ onError('Network error. Check connection and retry.'); });
      } else {
        var body=JSON.stringify({message:msg, contactEmail:email||undefined, pageUrl:location.href, userAgent:navigator.userAgent, viewport:window.innerWidth+'x'+window.innerHeight, language:navigator.language||'', website:hpInput.value, projectKey:projectKey});
        fetch(url, {method:'POST', headers:{'Content-Type':'application/json','x-project-key':projectKey}, body:body}).then(function(r){ return r.text().then(function(t){ var d; try{d=JSON.parse(t)}catch{d=t}; return {ok:r.ok,status:r.status,data:d}; }); }).then(function(res){ if(res.ok) onSuccess(); else onError((res.data&&res.data.error)||'Failed to send ('+res.status+')'); }).catch(function(){ onError('Network error. Check connection and retry.'); });
      }
    });
  }
  var btn=h('button',{id:'bugaputa-btn','aria-label':'Report a bug',title:'Report a bug',text:'\uD83D\uDC1B'});
  btn.addEventListener('click', open);
  function mount(){ if(document.body) document.body.appendChild(btn); else setTimeout(mount, 100); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
