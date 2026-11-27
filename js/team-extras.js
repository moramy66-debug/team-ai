/* Ramz extras (separate file so the core files stay untouched).
   1) Live streaming of the final answer into the result card.
   2) Automatic independent verification of the calculations in the final report. */
(function(){
'use strict';
var $=function(i){return document.getElementById(i)};

/* ---------- 1) live streaming ---------- */
var LIVE=/^(تنفيذ مباشر|الدمج النهائي|مراجعة نهائية شاملة)$/,raf=0,pending='';
function liveEl(){
 var e=$('liveStream');
 if(!e){e=document.createElement('div');e.id='liveStream';e.setAttribute('dir','auto');
  e.style.cssText='white-space:pre-wrap;line-height:1.9;padding:10px 0;opacity:.95';
  var fv=$('finalView');fv.innerHTML='';fv.parentNode.insertBefore(e,fv);
  var h=document.createElement('div');h.id='liveNote';h.className='hint';h.textContent='بيتكتب دلوقتي...';e.parentNode.insertBefore(h,e)}
 return e}
function dropLive(hideIfEmpty){
 var e=$('liveStream'),h=$('liveNote');if(e)e.remove();if(h)h.remove();
 if(hideIfEmpty){var f=$('final');if(f&&!f.textContent.trim()){var c=$('finalCard');if(c)c.hidden=true}}}
function onChunk(delta,full){
 pending=full;if(raf)return;
 raf=requestAnimationFrame(function(){raf=0;try{var e=liveEl();e.textContent=pending;$('finalCard').hidden=false}catch(_){}})}

if(typeof ask==='function'&&typeof askStream==='function'){
 var _ask=ask;
 window.ask=function(a,system,prompt,json){
  if(window.__live&&!json&&!window.__inStream&&!window.__fast){
   window.__inStream=true;
   return askStream(a,system,prompt,onChunk).finally(function(){window.__inStream=false})}
  return _ask.apply(this,arguments)};
}
if(typeof stepF==='function'){
 var _stepF=stepF;
 window.stepF=function(title,a,mk){
  var live=LIVE.test(title)||(title==='الصياغة الأولى: المهمة كاملة'&&agents().length===1&&$('effort').value!=='3');
  if(!live)return _stepF(title,a,mk);
  window.__live=true;try{window.__gen=a&&a.id}catch(e){}
  return _stepF(title,a,mk).then(function(r){window.__live=false;return r},function(e){window.__live=false;dropLive(true);throw e})};
}
if(typeof renderFinal==='function'){
 var _rf=renderFinal;
 window.renderFinal=function(){dropLive(false);return _rf.apply(this,arguments)};
}

/* ---------- 2) calculation verification ---------- */
function cell(s){return String(s==null?'':s).replace(/\|/g,'/').replace(/\s+/g,' ').trim()}
function insertSection(text,sec){
 var re=/\n#{1,3}[^\n]*(References|المراجع)[^\n]*/ig,m,last=-1;
 while((m=re.exec(text)))last=m.index;
 return last>0?text.slice(0,last)+'\n\n'+sec+'\n'+text.slice(last):text+'\n\n'+sec+'\n'}
function parseJ(raw){try{var m=String(raw).match(/\{[\s\S]*\}/);return JSON.parse(m[0])}catch(e){return null}}

function pickVerifier(prompt){
 /* prefer a different model than the one that wrote the report */
 var A=agents(),gen=window.__gen,pref=['gemini','groq','groq2','anthropic','openai','openrouter'];
 var fits=function(a){return !(isGroq(a)&&estTok(prompt)>5200)};
 var c=pref.map(function(id){return A.find(function(x){return x.id===id})}).filter(Boolean).filter(fits);
 var diff=c.filter(function(a){return a.id!==gen});
 return diff[0]||c[0]||(typeof fmtAgent==='function'?fmtAgent():A[0])}

async function verifyCalc(text,followUp){
 if(followUp||String(text||'').length<600)return text;
 var tn='',task='';try{tn=(RCK&&RCK.tn)||'';task=(RCK&&RCK.task)||''}catch(e){}
 if(/خطاب|إيميل|Humanize/.test(tn))return text;
 var hits=(text.match(/=\s*[0-9][0-9.,]*\s*(A|V|kW|kVA|VA|W|mm²|mm2|mm|%|Ω|m|kA)(?![A-Za-z])/g)||[]).length;
 if(!(/حسابات/.test(tn)||hits>=4))return text;
 try{if(RCK&&RCK.steps.__ver!=null)return RCK.steps.__ver}catch(e){}
 var p='You are an independent calculation checker for a consulting electrical/mechanical engineering report. From the REPORT below choose up to 12 of the most important calculations (design current, breaker selection vs cable capacity Ib<=In<=Iz, cable size and derating, voltage drop percentage, short-circuit, demand/diversity totals, equipment sizing, any other key numeric result). For each one, recompute it yourself ONLY from the inputs and formula stated in the report, using the same assumptions. Treat a difference within 2 percent as rounding (ok). Skip any calculation whose inputs are not in the report; never invent inputs; do not judge the choice of code. Return JSON only in this shape: {"checks":[{"item":"short Arabic name","stated":"value as written with unit","recomputed":"your value with unit","ok":true,"note":"if not ok, one short Arabic sentence about the likely error"}]}\n\nREPORT:\n'+text;
  var a=pickVerifier(p);if(!a){return text}
   
  var d=addStep('تحقق آلي من الحسابات',a.name);
  try{
  var j=parseJ(await ask(a,sys(a),p,true));
  var checks=(j&&Array.isArray(j.checks)?j.checks:[]).filter(function(c){return c&&c.item}).slice(0,12);
  if(!checks.length){doneStep(d,'التحقق الآلي ملقاش حسابات كفاية يتحقق منها.');if(RCK){RCK.steps.__ver=text;ckSave()}return text}
  var bad=checks.filter(function(c){return c.ok===false||String(c.ok)==='false'});
  var out=text,fixed=false;
  if(bad.length){
   var lead=agents().find(function(x){return x.id==='gemini'})||a;
   var cp='Below is an engineering report and the findings of an independent recalculation. Correct ONLY the values that are wrong and every value that depends on them (totals, selections, compliance statuses). Keep everything else, the structure, the wording and the language exactly as is. Output the complete corrected report only.\n\nFINDINGS (JSON):\n'+JSON.stringify(bad)+'\n\nREPORT:\n'+text;
   try{var cand=deLatex(await ask(lead,sys(lead),cp));
    var A=numSet(text),B=new Set(numSet(cand)),u=Array.from(new Set(A)),miss=u.filter(function(x){return !B.has(x)}).length;
    if(cand&&cand.length>=text.length*0.8&&(!u.length||miss/u.length<=0.12)){out=cand;fixed=true}}
   catch(e){if(e&&e.name==='AbortError')throw e}
  }
  var rows=checks.map(function(c){var ok=!(c.ok===false||String(c.ok)==='false');return '| '+cell(c.item)+' | '+cell(c.stated)+' | '+cell(c.recomputed)+' | '+(ok?'مطابق':(fixed?'اتصحح':'محتاج مراجعة'))+(!ok&&c.note?' ('+cell(c.note)+')':'')+' |'});
  var sec='## التحقق الآلي من الحسابات\nإعادة حساب مستقلة بموديل '+a.name+' للقيم الأساسية من نفس المعادلات والمدخلات.\n\n| البند | القيمة في التقرير | إعادة الحساب | الحالة |\n| --- | --- | --- | --- |\n'+rows.join('\n')+'\n\n'+
   (bad.length?(fixed?'اتلقى '+bad.length+' اختلاف واتصححوا في التقرير فوق، وباقي القيم مطابقة.':'اتلقى '+bad.length+' اختلاف، التصحيح التلقائي مااتطبقش علشان يحافظ على أرقام التقرير، فراجعهم قبل الاعتماد.'):'كل القيم اللي اتراجعت مطابقة.');
  out=insertSection(out,sec);
  doneStep(d,bad.length?('اتراجع '+checks.length+' حساب، '+bad.length+' اختلاف'+(fixed?' واتصححوا.':' محتاجين مراجعة.')):('اتراجع '+checks.length+' حساب وكلهم مطابقين.'));
  if(RCK){RCK.steps.__ver=out;ckSave()}
  return out;
 }catch(e){
  if(e&&e.name==='AbortError'){d.remove();throw e}
  doneStep(d,'تعذر التحقق الآلي، التقرير زي ما هو.');return text}
}
/* ---------- 6) skip the documentation pass when the report is already well structured ---------- */
function alreadyStructured(t){
 t=String(t||'');var h=(t.match(/^#{2,3}\s+\S/gm)||[]).length,tr=(t.match(/^\|.+\|\s*$/gm)||[]).length,ref=/^#{1,3}[^\n]*(References|المراجع)/im.test(t);
 var first=(t.match(/^#{1,3}\s+([^\n]+)/m)||[])[1]||'';
 return h>=4&&tr>=4&&ref&&!/References|المراجع/i.test(first)}

/* ---------- 11) check code references against the user's library ---------- */
function libText(){
 try{var L=(LS.get('teamai.codes',[])||[]).filter(function(c){return c&&c.on!==false});
  return L.map(function(c){return String(c.text||'')}).join('\n')}catch(e){return ''}}
function normRef(s){return String(s).toLowerCase().replace(/[^a-z0-9\u0660-\u0669.]+/g,'')}
function refCheck(text,followUp){
 if(followUp)return text;
 var lib=libText();if(lib.length<500)return text;
 var body=text.replace(/\n#{1,3}[^\n]*(References|المراجع)[\s\S]*$/i,'');
 var re=/(?:Clause|Table|Article|Section|Cl\.|Tbl\.|بند|جدول|مادة|المادة)\s*([A-Za-z]?\d[\dA-Za-z.()\-]*)/g,m,seen={},ok=[],bad=[];
 var L=normRef(lib);
 while((m=re.exec(body))){var id=m[1].replace(/[.)\-(]+$/,'');if(id.length<2||seen[id])continue;seen[id]=1;
  (L.indexOf(normRef(id))>=0?ok:bad).push(m[0].replace(/\s+/g,' ').trim())}
 if(!ok.length&&!bad.length)return text;
 var sec='## التحقق من المراجع\nاتقارنت أرقام البنود والجداول المذكورة في التقرير بنص مكتبة الأكواد بتاعتك: '+ok.length+' اتأكدوا، '+bad.length+' غير مؤكدين.'+
  (bad.length?'\n\nغير مؤكدين (مش لاقيهم في نص المكتبة، راجعهم قبل الاعتماد): '+bad.slice(0,15).join('، ')+(bad.length>15?' ...':''):'');
 return insertSection(text,sec)}

if(typeof fmtPass==='function'){
 var _fmt=fmtPass;
 window.fmtPass=async function(src,followUp){
  var out;
  if(!followUp&&alreadyStructured(src)){
   try{if(RCK&&RCK.steps.__fmt!=null)out=RCK.steps.__fmt}catch(e){}
   if(out==null){out=src;var d0=addStep('تنسيق التقرير (Documentation)','—');doneStep(d0,'التقرير منسق أصلاً، تخطيت مرحلة التنسيق (أسرع ومن غير تغيير في الأرقام).');try{if(RCK){RCK.steps.__fmt=out;ckSave()}}catch(e){}}
  }else out=await _fmt(src,followUp);
  out=await verifyCalc(out,followUp);
  try{out=refCheck(out,followUp)}catch(e){console.error(e)}
  return out};
}

/* ---------- 9) progress bar: step n of ~N, current model, elapsed time ---------- */
(function(){
 var t0=0,timer=0,bar=null;
 function expected(){
  try{var E=$('effort').value,N=agents().length||1,rounds=E==='3'?3:E==='2'?1:0,n=0;
   if(E==='1')n=1;else{n=(N>1?1:0)+N+(N>1?rounds*2*N:0)+(N>1?1:0)+(E==='3'?1:0)}
   return n+2}catch(e){return 0}}
 function mk(){if(bar&&!bar.isConnected)bar=null;if(bar)return bar;var s=$('steps');if(!s)return null;bar=document.createElement('div');bar.id='progBar';
  bar.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;margin:0 0 8px;border:1px solid rgba(120,130,170,.25);border-radius:10px;font-size:13px';
  bar.innerHTML='<span id="pgTxt"></span><span id="pgTime" style="opacity:.7"></span><div style="flex:1 1 120px;height:6px;border-radius:4px;background:rgba(120,130,170,.2);overflow:hidden"><div id="pgFill" style="height:100%;width:0;background:#6d7cff;transition:width .3s"></div></div>';
  s.parentNode.insertBefore(bar,s);return bar}
 function tick(){
  try{tick0()}catch(e){window.__pgErr=String(e&&e.stack||e)}}
 function tick0(){
  var b=mk();if(!b)return;var s=$('steps'),all=s.querySelectorAll('.step'),done=s.querySelectorAll('.step.done').length,run=s.querySelector('.step.run'),tot=Math.max(expected(),all.length);
  var el=Math.round((Date.now()-t0)/1000),mm=Math.floor(el/60),ss=el%60;
  var cur=run?((run.querySelector('b')||{}).textContent||''):'';
  $('pgTxt').textContent=(run?'شغال: '+cur:'خلص')+' | خطوة '+Math.min(done+(run?1:0),tot)+' من ~'+tot;
  $('pgTime').textContent=mm+':'+(ss<10?'0':'')+ss;
  $('pgFill').style.width=Math.min(100,Math.round(done/tot*100))+'%'}
 function start(){t0=Date.now();mk();bar.hidden=false;clearInterval(timer);timer=setInterval(function(){tick();if($('go')&&!$('go').disabled){tick();clearInterval(timer)}},1000);tick()}
 if(typeof startRun==='function'){var _sr=startRun;window.startRun=function(task,fu,res){try{if(!fu)start()}catch(e){window.__pgErr=String(e&&e.stack||e)}var pr=_sr.apply(this,arguments);Promise.resolve(pr).finally(function(){setTimeout(tick,50)});return pr}}
})();

window.TeamAIExtras={verifyCalc:verifyCalc,version:1};
})();
