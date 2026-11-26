function renderFinal(){$('finalView').innerHTML=safeHTML(pills(secNum(md($('final').textContent),false),false));var t=(current&&histTitle(current))||'';$('repHead').innerHTML='<div class="rk">TEAM AI | ENGINEERING REPORT</div><div class="rt"></div><div class="rm"><span class="rn"></span><span class="rd"></span><span class="ok">Completed</span></div>';$('repHead').querySelector('.rt').textContent=t;$('repHead').querySelector('.rn').textContent=refNo();$('repHead').querySelector('.rd').textContent=new Date(current&&current.t||Date.now()).toLocaleString('en-GB')}

function addStep(title,tag){window.curStep=title;const d=document.createElement('div');d.className='step run';d.innerHTML='<b></b><div class="hint">شغال...</div>';d.querySelector('b').textContent=title;if(tag){const t=document.createElement('span');t.className='tag';t.textContent=tag;d.querySelector('b').prepend(t)}$('steps').appendChild(d);return d}
function doneStep(d,text,err){d.className='step '+(err?'err':'done');const h=d.querySelector('.hint');if(err){h.className='bad';h.textContent=text;return}
 h.remove();const x=document.createElement('details');x.innerHTML='<summary>عرض</summary><div class="out"></div>';x.querySelector('.out').className='out md';x.querySelector('.out').innerHTML=safeHTML(md(text));d.appendChild(x)}
$('go').onclick=()=>startRun(composeTask(),false);
function homeProc(){var p=document.getElementById('proc'),ph=document.getElementById('procHome');if(p&&ph&&!ph.contains(p))ph.appendChild(p)}
function bubble(kind,html,txt){var d=document.createElement('div');d.className='msg '+kind;if(kind==='user'){d.textContent=txt;d.dir='auto'}else{d.className+=' md';d.innerHTML=safeHTML(html)}$('thread').appendChild(d);return d}
$('sendF').onclick=()=>{
 const f=$('follow').value.trim();if(!f||!current||$('sendF').disabled)return;
 $('follow').value='';$('follow').style.height='';
 if(!$('thread').children.length)bubble('user','',current.user||current.task);
 bubble('team',md($('final').textContent));
 bubble('user','',f);
 $('thread').appendChild($('proc'));updConv();
 const d=document.createElement('div');d.className='step done';const b=document.createElement('b');b.textContent='أنت: '+f;d.appendChild(b);$('steps').appendChild(d);
 const base=current.enriched||current.task;
 startRun('السياق - المهمة الأصلية:\n'+base+'\n\nالنتيجة الحالية من الفريق:\n'+$('final').textContent+'\n\nطلب متابعة من المستخدم على نفس الشغل:\n'+f,true);
};
$('follow').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('sendF').click()}});
$('follow').addEventListener('input',()=>{const t=$('follow');t.style.height='auto';t.style.height=Math.min(t.scrollHeight+2,160)+'px'});
function updConv(){var n=$('thread').querySelectorAll('.msg').length,b=$('convTop');if(b)b.hidden=n<1}
$('convTop').onclick=()=>{$('thread').scrollIntoView({behavior:'smooth',block:'start'})};
$('logBtn2').onclick=()=>$('logBtn').click();
function saveCurrent(){if(!current)return;const h=LS.get('teamai.hist',[]);const i=h.findIndex(x=>x.id===current.id);const rec={id:current.id,t:current.t,task:current.task,ttl:current.ttl||'',title:current.title||'',user:current.user,enriched:current.enriched,stepsHTML:$('steps').innerHTML,thread:(function(){var c=$('thread').cloneNode(true);var p=c.querySelector('#proc');if(p)p.remove();return c.innerHTML})(),final:$('final').textContent};if(i>=0)h[i]=rec;else h.unshift(rec);h=h.slice(0,30);for(;;){try{LS.set('teamai.hist',h);break}catch(e){if(h.length<=1)break;h.pop()}}renderHist();updConv()}
$('stop').onclick=()=>abort?.abort();
$('resumeGo').onclick=function(){var c=ckPeek();if(!c||!c.task)return;if(abort)return;RCK=c;$('task').value=c.user||'';startRun(c.task,false,true)};
$('resumeX').onclick=function(){ckClear();$('resumeBox').hidden=true};
showResume();
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(plainText($('final').textContent));$('copy').textContent='Copied ✔';setTimeout(()=>$('copy').textContent='Copy',1500)}catch{}};
function histTitle(x){if(x.ttl)return x.ttl;var t=(x.title||x.task||'').replace(/\s+/g,' ').trim();var w=t.split(' ');return w.slice(0,7).join(' ')+(w.length>7?'...':'')}
function renderHist(){const h=LS.get('teamai.hist',[]);$('histCard').hidden=false;$('noHist').hidden=h.length>0;$('hist').innerHTML='';
 h.forEach(x=>{const d=document.createElement('div');d.className='hist';const a=document.createElement('span');a.textContent=histTitle(x);a.title=histTitle(x);a.dir='auto';const b=document.createElement('span');b.className='hint';b.textContent=new Date(x.t).toLocaleDateString();d.append(a,b);
 if(current&&current.id===x.id)d.classList.add('on');
 d.onclick=()=>{document.querySelectorAll('.hist').forEach(e=>e.classList.remove('on'));d.classList.add('on');current={id:x.id,t:x.t,task:x.task,enriched:x.enriched||'',title:x.title||'',ttl:x.ttl||'',user:x.user};lastEnriched=x.enriched||x.task;clearTmpl();$('task').value=(x.title&&x.user!==undefined)?x.user:x.task;$('run').hidden=false;$('steps').innerHTML=x.stepsHTML||'';homeProc();$('thread').innerHTML=x.thread||'';$('final').textContent=x.final;renderFinal();$('finalCard').hidden=false;showSig();showPdf();updConv();mailMsg('');scrollTo(0,0)};$('hist').appendChild(d)})}
$('clearH').onclick=()=>{LS.set('teamai.hist',[]);renderHist()};
$('setBtn').onclick=()=>{$('settings').hidden=!$('settings').hidden};
$('saveBtn').onclick=()=>{cfg=readCfg();LS.set('teamai.cfg',cfg);LS.set('teamai.rules',$('rules').value);LS.set('teamai.memory',$('mem').value);LS.set('teamai.email',$('mailTo').value.trim());LS.set('teamai.ejs',{s:$('ejsS').value.trim(),t:$('ejsT').value.trim(),k:$('ejsK').value.trim()});showWho();$('testOut').textContent='اتحفظ ✔'};
$('testBtn').onclick=async()=>{cfg=readCfg();LS.set('teamai.cfg',cfg);showWho();$('testOut').textContent='بجرب...';
 const res=[];for(const a of agents()){try{await ask(a,'Reply with one word.','Say OK.');res.push(a.name+' ✔')}catch(e){res.push(a.name+' ✗ '+(e.message||''))}}
 $('testOut').textContent=res.join(' | ')||'مفيش مفاتيح'};
TMPLS.forEach(([n,t])=>{const b=document.createElement('button');b.className='sec i-'+({'راجع إكسيل':'table','قارن مستندات':'compare','راجع مخطط':'ruler','ملاحظات اعتماد':'check','لخص مستند':'doc','خطاب رسمي':'mail','رد على إيميل':'reply','Humanize':'pen','مراجعة حسابات':'calc','إجراء حسابات':'table'}[n]||'doc');b.textContent=n;b.onclick=()=>{setTmpl(n,t,b)};$('tmpls').appendChild(b)});
{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR)$('mic').hidden=true;else{let rec=null;
 $('mic').onclick=()=>{
  if(rec){rec.stop();return}
  rec=new SR();rec.lang='ar-EG';rec.interimResults=false;rec.continuous=true;
  rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)$('task').value+=($('task').value?' ':'')+e.results[i][0].transcript};
  const off=()=>{rec=null;$('mic').textContent='Voice'};
  rec.onend=off;rec.onerror=off;
  rec.start();$('mic').textContent='Stop Voice';
 }}}
$('rules').value=LS.get('teamai.rules','');
$('mem').value=LS.get('teamai.memory','');$('mailTo').value=LS.get('teamai.email','');(function(){var c=LS.get('teamai.ejs',{})||{};$('ejsS').value=c.s||'';$('ejsT').value=c.t||'';$('ejsK').value=c.k||''})();
let dp;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('install').style.display='inline-block'});
$('install').onclick=async()=>{if(dp){dp.prompt();await dp.userChoice;dp=null;$('install').style.display='none'}};

$('menuBtn').onclick=()=>document.body.classList.toggle('menu-open');
$('scrim').onclick=()=>document.body.classList.remove('menu-open');
$('hist').addEventListener('click',()=>document.body.classList.remove('menu-open'));
$('setClose').onclick=()=>{$('settings').hidden=true};
$('setBtn').addEventListener('click',()=>document.body.classList.remove('menu-open'));
$('newBtn').onclick=()=>{if(abort)return;current=null;xlCtx=null;files=[];renderChips();clearTmpl();$('task').value='';$('run').hidden=true;$('steps').innerHTML='';$('finalCard').hidden=true;$('xlOut').hidden=true;$('pdfOut').hidden=true;document.body.classList.remove('menu-open');scrollTo(0,0);$('task').focus()};
loadCfg();showWho();renderHist();if(!agents().length)$('settings').hidden=false;
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js');

(function(){var d=document,b=d.body;function t(v){b.classList.toggle('log-open',v)}d.getElementById('logBtn').onclick=function(){t(!b.classList.contains('log-open'))};d.getElementById('logClose').onclick=function(){t(false)};d.getElementById('logScrim').onclick=function(){t(false)};d.addEventListener('keydown',function(e){if(e.key==='Escape')t(false)})})();

(function(){var t=document.getElementById('task'),last=-1;function g(){t.style.height='auto';var h=Math.min(Math.max(t.scrollHeight+2,220),Math.round(innerHeight*.6));t.style.height=h+'px'}t.addEventListener('input',g);setInterval(function(){if(t.value.length!==last){last=t.value.length;g()}},300);g()})()
var _pt=null,_p0=0;
function procStart(){_p0=Date.now();window.curStep='';var g=document.getElementById('go');g.classList.add('busy');g.textContent='جاري التنفيذ';var p=document.getElementById('proc');p.hidden=false;
 function tick(){var s=Math.floor((Date.now()-_p0)/1000);document.getElementById('procTime').textContent=(s>=60?Math.floor(s/60)+'m ':'')+(s%60)+'s';document.getElementById('procS').textContent=window.curStep?'الخطوة الحالية: '+window.curStep:'بجهز الطلب...'}
 tick();clearInterval(_pt);_pt=setInterval(tick,1000);
 try{p.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}}
function procStop(){clearInterval(_pt);var ph=document.getElementById('procHome'),pp=document.getElementById('proc');if(ph&&pp&&!ph.contains(pp))ph.appendChild(pp);var g=document.getElementById('go');g.classList.remove('busy');g.textContent='Start';document.getElementById('proc').hidden=true}

document.getElementById('tmplView').onclick=function(){var b=document.getElementById('tmplBox');var o=b.classList.toggle('open');this.textContent=o?'Hide':'View'};
function histTitle(x){if(x.ttl)return x.ttl;var t=(x.title||x.task||'').replace(/\s+/g,' ').trim();var w=t.split(' ');return w.slice(0,7).join(' ')+(w.length>7?'...':'')}
function cleanTitle(t){t=String(t||'').split('\n').filter(function(l){return l.trim()})[0]||'';t=t.replace(/[*#"'`«»“”]/g,'').replace(/^(العنوان|Title)\s*[:：]\s*/i,'').replace(/[.。]+$/,'').trim();var w=t.split(/\s+/);if(w.length>8)t=w.slice(0,8).join(' ');return t.slice(0,60)}
async function genTitle(cur){
 try{
  var src=((cur.title?cur.title+'\n':'')+(cur.user||cur.task||'')).slice(0,600);
  var fn=(files||[]).map(function(f){return f.name}).join(', ');if(fn)src+='\nالملفات: '+fn;
  var p='اكتب عنوان قصير من 3 إلى 6 كلمات يوصف المهمة دي، بنفس لغة المهمة، من غير علامات ترقيم أو تنسيق أو شرح. اخرج العنوان بس.\n\nالمهمة:\n'+src;
  var A=agents(),pref=A.slice().sort(function(a,b){return (a.id==='groq'?0:1)-(b.id==='groq'?0:1)}),ttl='';
  for(var i=0;i<pref.length&&!ttl;i++){try{ttl=cleanTitle(await ask(pref[i],'You write very short task titles.',p));if(/رد فاضي/.test(ttl))ttl=''}catch(e){ttl=''}}
  if(!ttl)return;
  cur.ttl=ttl;var h=LS.get('teamai.hist',[]),r=h.find(function(x){return x.id===cur.id});if(r){r.ttl=ttl;LS.set('teamai.hist',h)}renderHist();
 }catch(e){}}


(function(){
function seedMerge(){try{var done=LS.get('teamai.codesSeeded',[]),L=LS.get('teamai.codes',[]),ch=false;SEED.forEach(function(x){if(done.indexOf(x.sid)<0){L.push({id:Date.now()+Math.random(),name:x.name,ver:x.ver,text:x.text,on:true,sid:x.sid,t:Date.now()});done.push(x.sid);ch=true}});if(ch){LS.set('teamai.codes',L);LS.set('teamai.codesSeeded',done)}}catch(e){}}
seedMerge();try{var _L=LS.get('teamai.codes',[]),_c=false;_L.forEach(function(c){var x=SEED.find(function(y){return y.sid===c.sid});if(x&&c.ver!==x.ver){c.ver=x.ver;_c=true}});if(_c)LS.set('teamai.codes',_L)}catch(e){}
var editId=null;
function get(){return LS.get('teamai.codes',[])}
function put(L){try{LS.set('teamai.codes',L);return true}catch(e){$('cdMsg').textContent='المساحة امتلت، امسح كود قديم أو قصّر النص.';return false}}
function msg(t){$('cdMsg').textContent=t}
function render(){var L=get(),box=$('cdList');box.innerHTML='';if(!L.length){box.innerHTML='<p class="hint">المكتبة فاضية لسه.</p>';return}
 L.forEach(function(c){var d=document.createElement('div');d.className='cdItem';
  var n=document.createElement('div');n.className='nm';n.dir='ltr';var n1=document.createElement('div');n1.className='nn';n1.textContent=c.name;var n2=document.createElement('div');n2.className='nv';n2.textContent=c.ver?'Latest: '+c.ver:'';n.append(n1,n2);
  var m=document.createElement('span');m.className='mt';m.textContent='';
  var on=document.createElement('input');on.type='checkbox';on.checked=c.on!==false;on.title='استخدمه في المهام';on.style.width='auto';on.onchange=function(){var l=get(),x=l.find(function(y){return y.id===c.id});if(x){x.on=on.checked;put(l)}};
  var ed=document.createElement('button');ed.className='sec';ed.textContent='تعديل';ed.onclick=function(){editId=c.id;$('cdName').value=c.name;$('cdText').value=c.text||'';$('cdAdd').textContent='حفظ التعديل';msg('بتعدّل: '+c.name+'. تعديلاتك محفوظة على جهازك ومش هتتكتب فوقها.');$('cdName').scrollIntoView()};
  var v=document.createElement('button');v.className='sec';v.textContent='عرض';
  var del=document.createElement('button');del.className='sec';del.textContent='حذف';
  var pre=document.createElement('div');pre.className='cdView';pre.hidden=true;
  v.onclick=function(){pre.hidden=!pre.hidden;if(!pre.hidden)pre.textContent=(c.text||'').slice(0,20000)+((c.text||'').length>20000?'\n...':'')};
  del.onclick=function(){if(!confirm('تمسح "'+c.name+'"؟'))return;put(get().filter(function(y){return y.id!==c.id}));render()};
  d.append(on,ed,v,del,n);var w=document.createElement('div');w.append(d,pre);box.appendChild(w)})}
function loadPdfJs(){return window.pdfjsLib?Promise.resolve():new Promise(function(res,rej){var sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';sc.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';res()};sc.onerror=function(){rej(new Error('تعذر تحميل قارئ الـ PDF'))};document.head.appendChild(sc)})}
async function pdfText(file){await loadPdfJs();var doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[];
 for(var i=1;i<=doc.numPages;i++){msg('بقرا صفحة '+i+' من '+doc.numPages+'...');var p=await doc.getPage(i),tc=await p.getTextContent();out.push(tc.items.map(function(x){return x.str}).join(' '))}return out.join('\n\n')}
$('cdFile').onchange=async function(){var f=this.files[0];if(!f)return;if(!$('cdName').value.trim())$('cdName').value=f.name.replace(/\.[^.]+$/,'');
 try{var t=/pdf$/i.test(f.name)||/pdf/i.test(f.type)?await pdfText(f):await f.text();t=t.replace(/[ \t]+/g,' ').trim();
  if(t.length<50){msg('الملف ده شكله مصوّر (سكان) ومفيهوش نص. الصق النص يدوي.');return}
  $('cdText').value=t.slice(0,250000);msg('اتقرا '+Math.round(t.length/1000)+'K حرف'+(t.length>250000?' (اتقص عند 250K)':'')+'. اضغط إضافة للمكتبة.')}
 catch(e){msg('فشل قراءة الملف: '+e.message)}};
$('cdAdd').onclick=function(){var n=$('cdName').value.trim(),t=$('cdText').value.trim();if(!n){msg('اكتب اسم الكود.');return}if(!t){msg('الصق نص أو ارفع PDF.');return}
 var L=get();if(editId){var x=L.find(function(y){return y.id===editId});if(x){x.name=n;x.text=t}editId=null;$('cdAdd').textContent='إضافة للمكتبة'}else L.unshift({id:Date.now(),name:n,text:t,on:true,t:Date.now()});if(!put(L))return;$('cdName').value='';$('cdText').value='';$('cdFile').value='';msg('اتضاف ✔');render()};
$('codesBtn').onclick=function(){$('codes').hidden=!$('codes').hidden;document.body.classList.remove('menu-open');if(!$('codes').hidden){render();$('codes').scrollIntoView()}};
$('codesClose').onclick=function(){$('codes').hidden=true};
window.codesRender=render;
})();

function errAr(e){var m=String((e&&e.message)||e||''),c=(m.match(/\[(\d{3})\]/)||[])[1];
 if(/failed to fetch|networkerror|load failed|network request/i.test(m))return 'مشكلة شبكة أو المتصفح منع الاتصال (جرب تاني أو اتأكد من النت)';
 if(c==='400'&&/api key|key not valid|invalid/i.test(m))return 'المفتاح غلط';
 if(c==='401')return 'المفتاح غلط أو منتهي';
 if(c==='403')return 'المفتاح مرفوض أو مفيش صلاحية (ممكن المنطقة أو الحساب)';
 if(c==='402')return 'الرصيد خلص على الحساب';
 if(c==='404')return 'اسم الموديل غلط أو مش متاح للمفتاح ده';
 if(c==='400')return 'الطلب مرفوض، غالبًا اسم الموديل غلط';
 if(c==='429')return 'تجاوزت الحد المجاني، جرب بعد شوية';
 if(c&&c[0]==='5')return 'مشكلة مؤقتة عند المزود، جرب تاني';
 if(/abort|timeout/i.test(m))return 'المزود اتأخر في الرد';
 return 'فشل الاختبار'+(c?' ['+c+']':'')}
async function test(p){var out=$('t_'+p),btn=document.querySelector('.tst[data-p="'+p+'"]');
 var P=PROV[p],key=(P.shared?$('k_'+P.shared):$('k_'+p)).value.trim(),model=$('m_'+p).value.trim()||P.model;
 out.className='hint tres';
 if(!key){out.textContent='ضيف المفتاح الأول'+(P.shared?' (مفتاح Groq)':'');out.classList.add('bad');return}
 btn.disabled=true;out.textContent='بجرب...';window.__fast=true;window.__lm='';
 try{var r=await Promise.race([ask({id:p,name:P.name,model:model,key:key},'Reply with one word.','Say OK.'),new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'))},25000)})]);
  out.textContent='✓ شغال، الموديل اللي رد: '+(window.__lm||model);out.classList.add('okk')}
 catch(e){out.textContent='✗ '+errAr(e);out.classList.add('bad')}
 finally{window.__fast=false;btn.disabled=false}}
Object.keys(PROV).forEach(function(p){var m=$('m_'+p);if(!m)return;var row=m.parentElement;var b=document.createElement('button');b.type='button';b.className='sec tst';b.dataset.p=p;b.textContent='اختبار';b.onclick=function(){test(p)};row.appendChild(b);var o=document.createElement('div');o.id='t_'+p;o.className='hint tres';row.insertAdjacentElement('afterend',o)});
