const PROV={
 gemini:{name:'Gemini',model:'gemini-3.5-flash-lite'},
 groq:{name:'GPT-OSS (Groq)',model:'openai/gpt-oss-120b'},
 groq2:{name:'Qwen (Groq)',model:'qwen/qwen3.8-27b',shared:'groq'},
 openrouter:{name:'OpenRouter',model:'nvidia/nemotron-3-ultra-550b-a55b:free'},
 openai:{name:'ChatGPT',model:'gpt-4o-mini'},
 anthropic:{name:'Claude',model:'claude-sonnet-4-5'}
};
const _idbCache={};function safeHTML(html){return window.TeamAISanitize?window.TeamAISanitize.sanitizeHTML(html):html}const LS={get(k,d){if((k==='teamai.codes'||k==='teamai.hist')&&_idbCache[k]!==undefined)return _idbCache[k];try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){window.__lsQuota&&window.__lsQuota(e)}if(k==='teamai.codes'){_idbCache[k]=v;window.TeamAIStorage?.saveCodes?.(v)}else if(k==='teamai.hist'){_idbCache[k]=v;window.TeamAIStorage?.saveHistory?.(v)}}};document.addEventListener('DOMContentLoaded',async()=>{try{const bkCodes=localStorage.getItem('teamai.codes'),bkHist=localStorage.getItem('teamai.hist'),bkSteps=localStorage.getItem('RCK.steps');await window.TeamAIStorage?.migrateFromLocalStorage?.();if(bkCodes&&!localStorage.getItem('teamai.codes'))localStorage.setItem('teamai.codes',bkCodes);if(bkHist&&!localStorage.getItem('teamai.hist'))localStorage.setItem('teamai.hist',bkHist);if(bkSteps&&!localStorage.getItem('RCK.steps'))localStorage.setItem('RCK.steps',bkSteps);if(window.TeamAIStorage?.getCodes){const c=await window.TeamAIStorage.getCodes();if(Array.isArray(c)&&c.length){_idbCache['teamai.codes']=c;try{localStorage.setItem('teamai.codes',JSON.stringify(c))}catch(e){}}}if(window.TeamAIStorage?.getHistory){const h=await window.TeamAIStorage.getHistory();if(Array.isArray(h)&&h.length){_idbCache['teamai.hist']=h;try{localStorage.setItem('teamai.hist',JSON.stringify(h))}catch(e){}if(typeof renderHist==='function')renderHist()}}if(window.TeamAIStorage?.getCheckpoints){const s=await window.TeamAIStorage.getCheckpoints();if(s&&typeof s==='object'){_idbCache['RCK.steps']=s;try{localStorage.setItem('RCK.steps',JSON.stringify(s));const ck=JSON.parse(localStorage.getItem('teamai.ck')||'null');if(ck&&!ck.steps){ck.steps=s;localStorage.setItem('teamai.ck',JSON.stringify(ck))}}catch(e){}}}}catch(e){console.warn('TeamAIStorage init fallback:',e)}});
let cfg=LS.get('teamai.cfg',{});
{const mig={'gemini-3.8-flash':'gemini-3.5-flash-lite','gemini-2.5-flash':'gemini-3.5-flash-lite','llama-3.3-70b-versatile':'openai/gpt-oss-120b'};
 let dirty=false;
 for(const p in PROV){const m=cfg[p]?.model;if(m&&mig[m]){cfg[p].model=mig[m];dirty=true}}
 if(dirty)LS.set('teamai.cfg',cfg);}
function loadCfg(){for(const p in PROV){if(!PROV[p].shared)$('k_'+p).value=cfg[p]?.key||'';$('m_'+p).value=cfg[p]?.model||PROV[p].model}$('c_groq2').checked=cfg.groq2?.enabled!==false}
function readCfg(){const c={};for(const p in PROV){c[p]={key:PROV[p].shared?'':$('k_'+p).value.trim(),model:$('m_'+p).value.trim()||PROV[p].model};if(PROV[p].shared)c[p].enabled=$('c_'+p).checked}return c}
function agents(){return Object.keys(PROV).map(p=>{const P=PROV[p],key=P.shared?cfg[P.shared]?.key:cfg[p]?.key;if(!key)return null;if(P.shared&&cfg[p]?.enabled===false)return null;return{id:p,name:P.name,model:cfg[p]?.model||P.model,key}}).filter(Boolean)}
function isGroq(a){return a&&(a.id==='groq'||a.id==='groq2')}
function showWho(){const a=agents();$('who').textContent=a.length?'الفريق: '+a.map(x=>x.name).join(' + '):'ضيف مفاتيح من الإعدادات الأول.';$('go').disabled=!a.length}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let abort=null;function proxyRoute(url){const c=typeof cfg==='function'?cfg():cfg;const raw=c?.proxyUrl;if(!raw)return url;const s=raw===true?'':String(raw).trim().replace(/\/+$/,'');if(raw!==true&&!String(raw).trim())return url;const map=[['https://generativelanguage.googleapis.com','gemini'],['https://api.anthropic.com','anthropic'],['https://api.groq.com','groq'],['https://openrouter.ai','openrouter'],['https://api.openai.com','openai']];for(const [origin,prov] of map){if(url.startsWith(origin))return s+'/proxy/'+prov+url.slice(origin.length)}return url}
async function post(url,headers,body,signal){
 for(let t=0;t<6;t++){
  const r=await fetch(proxyRoute(url),{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal});
  if((r.status===429||r.status===503)&&!window.__fast){const w=Math.min(60,5*2**t);await sleep(w*1000);continue}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((j.error?.message||j.error||r.statusText)+' ['+r.status+']');
  return j;
 }
 throw new Error('الحد المجاني اتعدى، جرب بعد شوية');
}
async function ask(a,system,prompt,json){
 const s=abort?.signal;
 if(a.id==='gemini'){
  const body={contents:[{role:'user',parts:[{text:prompt}]}],systemInstruction:{parts:[{text:system}]}};
  if(json)body.generationConfig={responseMimeType:'application/json'};
  const j=await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:generateContent`,{'x-goog-api-key':a.key},body,s);
  window.__lm=j.modelVersion||a.model;return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('')||'(رد فاضي)';
 }
 if(a.id==='anthropic'){
  const j=await post('https://api.anthropic.com/v1/messages',{'x-api-key':a.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},{model:a.model,max_tokens:4096,system,messages:[{role:'user',content:prompt}]},s);
  return j.content?.map(c=>c.text||'').join('')||'(رد فاضي)';
 }
 if(isGroq(a)&&!noSkip&&estTok(system+prompt)>5200){const e=new Error('oversize for Groq free limit');e.skip=true;throw e}
 const url=isGroq(a)?'https://api.groq.com/openai/v1/chat/completions':a.id==='openrouter'?'https://openrouter.ai/api/v1/chat/completions':'https://api.openai.com/v1/chat/completions';
 const body={model:a.model,messages:[{role:'system',content:system},{role:'user',content:prompt}]};
 if(json)body.response_format={type:'json_object'};
 const j=await post(url,{authorization:'Bearer '+a.key},body,s);
 window.__lm=j.model||a.model;return j.choices?.[0]?.message?.content||'(رد فاضي)';
}

const SYS='You are one member of a team of AI models working together on a user task. Reply in the same language as the user task. Be concrete and complete. No filler. Always put the full deliverable inline in your reply as text: every calculation with its formula, substituted values, result and units, and all tables (markdown). Write every equation in clean plain text with Unicode symbols, never LaTeX: no $ or $$ delimiters, no backslash commands (\\text, \\times, \\frac, \\sqrt). Example: Ib = P / (√3 × V × PF) = 21420 / (1.732 × 400 × 0.9) = 34.4 A. Use ×, ÷, √, ², ≤, ≥, ≈, Δ, °, Ω. Keep engineering terms, symbols and units in English exactly as used in practice, do not translate them to Arabic. Write Arabic words correctly (for example 4 أسلاك, 3 فاز). Never say a file, Excel or document is ready, attached or can be downloaded, and never promise one; the app handles files separately.';
var CODE_ALIAS={nfpa70:['nec','nfpa70'],cd:['civildefense','998','الدفاع المدني','دفاع مدني'],secdps:['dps','distributionplanningstandard'],secdc:['distributioncode','sdms'],sbc401:['sbc401'],sbc801:['sbc801'],saso2663:['saso2663'],saso2870:['saso2870']};
function codeNorm(x){return String(x||'').toLowerCase().replace(/[\s\-_.()\/]+/g,'')}
function codeMentioned(c,tn){var al=[codeNorm(c.name),codeNorm(String(c.name).split('(')[0])].concat((CODE_ALIAS[c.sid]||[]).map(codeNorm));return al.some(function(a){return a.length>=3&&tn.indexOf(a)>=0})}
function codesLimit(a){var id=a&&a.id;return (id==='groq'||id==='groq2')?6000:id==='gemini'?40000:12000}
function codesBlock(a){var L=LS.get('teamai.codes',[]).filter(function(c){return c.on!==false});if(!L.length)return '';var tot=codesLimit(a),tn=codeNorm(window.codesTask||'');var m=L.map(function(c){return codeMentioned(c,tn)});var any=m.some(Boolean);var w=m.map(function(x){return any?(x?6:1):1}),sw=w.reduce(function(p,q){return p+q},0);
var o='\nReference codes and standards library (the user\'s authoritative sources. Comply with them, cite them by name and clause, and say so if something conflicts with or is not covered by them):\n';
L.forEach(function(c,i){var t=(c.text||'').replace(/\s+/g,' ').trim(),per=Math.max(200,Math.floor(tot*w[i]/sw));o+='\n### '+c.name+(c.ver?' - latest: '+c.ver:'')+(any&&m[i]?' [referenced in the task]':'')+(t.length>per?' (excerpt, first '+per+' of '+t.length+' chars)':'')+'\n'+(window.TeamAICodeSearch?.extractRelevantChunks?window.TeamAICodeSearch.extractRelevantChunks(c.text||'',window.codesTask||'',per):t.slice(0,per))+'\n'});return o}
function sys(a){const r=LS.get('teamai.rules','').trim(),m=LS.get('teamai.memory','').trim();let s=SYS;if(r)s+='\nStanding instructions from the user (apply to every task):\n'+r;if(m)s+='\nWhat the user\'s other AI tools remember about him (his imported memory):\n'+m;s+=codesBlock(a);return s}
async function step(title,a,fn){const d=addStep(title,a.name);try{const r=await fn();doneStep(d,r);return r}catch(e){if(e.skip){d.remove();throw e}doneStep(d,e.message||String(e),true);throw e}}
let noSkip=false;
function estTok(t){const ar=(t.match(/[\u0600-\u06FF]/g)||[]).length;return ar/2.2+(t.length-ar)/3.5}
async function stepF(title,a,makeFn){var c=RCK&&RCK.steps[title];if(c!=null){var d0=addStep(title,'saved');doneStep(d0,c);return c}var r=await stepF0(title,a,makeFn);if(RCK){RCK.steps[title]=r;ckSave()}return r}
async function stepF0(title,a,makeFn){
 try{return await step(title,a,makeFn(a))}
 catch(e){
  const alt=agents().find(x=>x.id==='gemini'&&x!==a)||agents().find(x=>x!==a&&x.id!=='openrouter')||agents().find(x=>x!==a);
  if(!alt){if(e.skip){noSkip=true;try{return await step(title,a,makeFn(a))}finally{noSkip=false}}throw e}
  const d=addStep(title+' (اتحول لـ '+alt.name+')',alt.name);
  try{const r=await makeFn(alt)();doneStep(d,r);return r}
  catch(e2){doneStep(d,e2.message||String(e2),true);throw e2}
 }
}

async function askStream(prov,sysPrompt,userPrompt,onChunk){const s=abort?.signal,H='https://';try{if(isGroq(prov)&&!noSkip&&estTok(sysPrompt+userPrompt)>5200){const e=new Error('oversize for Groq free limit');e.skip=true;throw e}let url,headers,body,mode;if(prov.id==='gemini'){mode='gemini';url=H+'generativelanguage'+'.googleapis.com/v1beta/models/'+encodeURIComponent(prov.model)+':streamGenerateContent?alt=sse';headers={'content-type':'application/json','x-goog-api-key':prov.key};body={contents:[{role:'user',parts:[{text:userPrompt}]}],systemInstruction:{parts:[{text:sysPrompt}]}}}else if(prov.id==='anthropic'){mode='anthropic';url=H+'api'+'.anthropic.com/v1/messages';headers={'content-type':'application/json','x-api-key':prov.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};body={model:prov.model,max_tokens:4096,stream:true,system:sysPrompt,messages:[{role:'user',content:userPrompt}]}}else{mode='openai';url=isGroq(prov)?H+'api'+'.groq.com/openai/v1/chat/completions':prov.id==='openrouter'?H+'openrouter'+'.ai/api/v1/chat/completions':H+'api'+'.openai.com/v1/chat/completions';headers={'content-type':'application/json','authorization':'Bearer '+prov.key};body={model:prov.model,stream:true,messages:[{role:'system',content:sysPrompt},{role:'user',content:userPrompt}]}}const r=await fetch(proxyRoute(url),{method:'POST',headers,body:JSON.stringify(body),signal:s});if(!r.ok||!r.body)throw new Error('stream failed ['+r.status+']');const reader=r.body.getReader(),dec=new TextDecoder();let buf='',full='';while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||'';for(const ln of lines){const line=ln.trim();if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;try{const j=JSON.parse(data);let delta='';if(mode==='gemini'){delta=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');if(j.modelVersion)window.__lm=j.modelVersion}else if(mode==='anthropic'){if(j.type==='content_block_delta'&&j.delta?.text)delta=j.delta.text}else{delta=j.choices?.[0]?.delta?.content||'';if(j.model)window.__lm=j.model}if(delta){full+=delta;if(typeof onChunk==='function')onChunk(delta,full)}}catch(_){}}}if(!full)throw new Error('empty stream');return full}catch(e){if(e?.name==='AbortError'||e?.skip)throw e;const res=await ask(prov,sysPrompt,userPrompt,false);if(typeof onChunk==='function')onChunk(res,res);return res}}window.askStream=askStream;async function askFiles(a,system,prompt,files){
 const s=abort?.signal;
 const parts=files.map(f=>({inlineData:{mimeType:f.mime,data:f.b64}}));
 parts.push({text:prompt});
 const body={contents:[{role:'user',parts}],systemInstruction:{parts:[{text:system}]}};
 const j=await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:generateContent`,{'x-goog-api-key':a.key},body,s);
 return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('')||'(رد فاضي)';
}
let current=null,lastEnriched='';
var RCK=null;
function ckSave(){try{if(RCK){localStorage.setItem('teamai.ck',JSON.stringify(RCK));if(RCK.steps){_idbCache['RCK.steps']=RCK.steps;localStorage.setItem('RCK.steps',JSON.stringify(RCK.steps));window.TeamAIStorage?.saveCheckpoints?.(RCK.steps)}}}catch(e){}}
function ckClear(){RCK=null;delete _idbCache['RCK.steps'];try{localStorage.removeItem('teamai.ck');localStorage.removeItem('RCK.steps')}catch(e){}window.TeamAIStorage?.saveCheckpoints?.(null)}
function ckPeek(){try{const ck=JSON.parse(localStorage.getItem('teamai.ck')||'null');if(ck&&!ck.steps){ck.steps=_idbCache['RCK.steps']||JSON.parse(localStorage.getItem('RCK.steps')||'null')||{}}return ck}catch(e){return null}}
async function stepC(title,a,fn){var c=RCK&&RCK.steps[title];if(c!=null){var d=addStep(title,'saved');doneStep(d,c);return c}var r=await step(title,a,fn);if(RCK){RCK.steps[title]=r;ckSave()}return r}
function showResume(){var c=ckPeek(),b=$('resumeBox');if(!b)return;if(!c||!c.task){b.hidden=true;return}var n=Object.keys(c.steps||{}).filter(function(k){return k.indexOf('__')!==0}).length;
 $('resumeTxt').textContent='فيه تاسك اتقطع قبل ما يخلص ('+n+' خطوة خلصت واتحفظت). تكمّل من آخر خطوة بدل ما تبدأ من الأول؟ المهمة: '+String(c.task).replace(/\s+/g,' ').slice(0,90);b.hidden=false}

function taskKind(t){t=String(t||'').toLowerCase();var wr=/(خطاب|إيميل|ايميل|رد على|لخص|تلخيص|ترجم|صياغة|اكتب|humanize|email|letter|summar|translate|rewrite)/.test(t),te=/(حساب|احسب|مراجعة|راجع|كود|sbc|iec|nfpa|boq|تحقق|voltage|load|calc|check|verify|review|short circuit|كابل|مقطع)/.test(t);return te?'tech':wr?'write':'general'}
function routeOrder(A,task){if(A.length<2)return A;var k=taskKind(task),big=estTok(task)>4500,pri=function(a){if(a.id==='openrouter')return 9;if(big)return a.id==='gemini'?0:5;if(k==='write')return a.id==='gemini'?0:a.id==='groq2'?1:a.id==='groq'?2:3;if(k==='tech')return a.id==='groq'?0:a.id==='gemini'?1:a.id==='groq2'?2:3;return a.id==='gemini'?0:a.id==='groq'?1:2};return A.map(function(a,i){return[a,i]}).sort(function(x,y){return pri(x[0])-pri(y[0])||x[1]-y[1]}).map(function(x){return x[0]})}
async function runTask(task,_r){
 const A=routeOrder(agents(),task),N=A.length,lead=A[0],log=[];
 const E=$('effort').value,rounds=E==='3'?3:E==='2'?1:0;
 const EF=E==='1'?'\n\nBe direct and concise: give the answer without long preambles or unnecessary detail.':E==='3'?'\n\nBe exhaustive and rigorous: analyze deeply, double-check every number and assumption, consider edge cases and conflicts, and state anything uncertain explicitly.':'';
 // 0 attachments
 if(RCK&&RCK.resumed&&RCK.enriched)task=RCK.enriched;
 if(files.length&&!(RCK&&RCK.resumed)){
  const ga=A.find(a=>a.id==='gemini');
  if(files.some(f=>!f.xl)&&!ga)throw new Error('رفع الملفات محتاج مفتاح Gemini في الإعدادات');
  const descs=[];
  for(const f of files){
   if(f.xl){descs.push('### '+f.name+' (Excel workbook)\n'+f.text);xlCtx={name:f.name,wb:f.wb,text:f.text};continue}
   const d=await stepC('قراءة المرفقات: '+f.name,ga,()=>askFiles(ga,sys(ga),'Describe in detail, in Arabic, everything in this attached file "'+f.name+'": any drawings, dimensions, levels, pipe sizes, item lists, quantities, prices, texts, tables and notes. Be thorough, structured and exact with numbers, so another AI model that cannot see the file can work from your description alone.',[f]));
   descs.push('### '+f.name+'\n'+d);
  }
  task=task+'\n\nوصف المرفقات (من فريقك اللي شافها):\n'+descs.join('\n\n');
 }
 lastEnriched=task;if(RCK&&!RCK.enriched){RCK.enriched=task;ckSave()}
 if(E==='1'){return await stepF('تنفيذ مباشر',lead,x=>()=>ask(x,sys(x),task+EF))}
 // 1 plan
 let parts;
 if(N===1){parts=[{title:'المهمة كاملة',instruction:task}]}
 else{
  const raw=await stepF('تقسيم المهمة',lead,x=>()=>ask(x,sys(x),`Split this task into exactly ${N} parts that can be worked on in parallel by ${N} different AI models. Each part must be self-contained and together they must cover the whole task. Return JSON only: {"parts":[{"title":"...","instruction":"full instruction for this part"}]}\n\nTASK:\n${task}`,true));
  try{const m=raw.match(/\{[\s\S]*\}/);parts=JSON.parse(m[0]).parts}catch{parts=null}
  if(!Array.isArray(parts)||parts.length<N){parts=A.map((_,i)=>({title:'جزء '+(i+1),instruction:`Work on part ${i+1} of ${N} of this task, covering a distinct portion of it:\n${task}`}))}
  parts=parts.slice(0,N);
 }
 // 2 draft (parallel)
 let drafts=await Promise.all(A.map((a,i)=>stepF('الصياغة الأولى: '+parts[i].title,a,x=>()=>ask(x,sys(x),`Overall task:\n${task}\n\nYour part: ${parts[i].title}\n${parts[i].instruction}\n\nWrite your part.${EF}`))));
 // 3 review rounds
 if(N>1)for(let r=1;r<=rounds;r++){
  const crit=await Promise.all(A.map((a,i)=>{const j=(i+1)%N;return stepF(`مراجعة (جولة ${r}): ${a.name} يراجع ${A[j].name}`,a,x=>()=>ask(x,sys(x),`Overall task:\n${task}\n\nReview this work by a teammate on part "${parts[j].title}". List concrete problems, errors, gaps and improvements. If it is already excellent, say so briefly.\n\nWORK:\n${drafts[j]}`))}));
  drafts=await Promise.all(A.map((a,i)=>{const c=crit[(i-1+N)%N];return stepF(`تحسين (جولة ${r}): ${parts[i].title}`,a,x=>()=>ask(x,sys(x),`Overall task:\n${task}\n\nYour part: ${parts[i].title}\n\nYour current version:\n${drafts[i]}\n\nReview from a teammate:\n${c}\n\nRewrite your part, fixing valid points and ignoring invalid ones. Output only the improved part.`))}));
 }
 // 4 merge
 const final=N===1?drafts[0]:await stepF('الدمج النهائي',lead,x=>()=>ask(x,sys(x),`Overall task:\n${task}\n\nCombine these parts from the team into one coherent, polished final answer. Remove duplication, fix inconsistencies, keep everything valuable. Output only the final answer.\n\n`+drafts.map((d,i)=>`### ${parts[i].title}\n${d}`).join('\n\n')));
 if(E==='3'){return await stepF('مراجعة نهائية شاملة',lead,x=>()=>ask(x,sys(x),`Overall task:\n${task}\n\nHere is the team's final answer:\n${final}\n\nDo a last rigorous quality check: verify numbers and calculations, consistency, completeness against the task, and clarity. Fix any problem you find and output only the final corrected answer in the same format and language.`))}
 return final;
}

function fmtAgent(){var A=agents();return A.find(function(a){return a.id==='gemini'})||A.find(function(a){return a.id==='groq2'})||A.find(function(a){return a.id==='groq'})||A.find(function(a){return a.id!=='openrouter'})||A[0]}
function numSet(t){var m=String(t||'').replace(/[\u0660-\u0669]/g,function(c){return c.charCodeAt(0)-1632}).match(/\d+(?:[.,]\d+)?/g)||[];return m.map(function(x){return x.replace(',','.')})}
async function fmtPass(src,followUp){if(RCK&&RCK.steps.__fmt!=null)return RCK.steps.__fmt;var o=await fmtPass0(src,followUp);if(RCK){RCK.steps.__fmt=o;ckSave()}return o}
async function fmtPass0(src,followUp){
 if(followUp||String(src||'').length<500)return src;
 var tn=(RCK&&RCK.tn)||((typeof activeTmpl!=='undefined'&&activeTmpl)?activeTmpl.name:'');if(/خطاب|إيميل|Humanize/.test(tn))return src;
 var a=fmtAgent();if(!a)return src;
 var d=addStep('تنسيق التقرير (Documentation)',a.name);
 try{
  var p='You are a senior technical documentation specialist for consulting engineering reports. Reformat the REPORT below into a clean, professional, engineering-grade document.\n\nHard rules:\n- Preserve EVERY number, unit, equation, code/standard reference, table value, assumption and conclusion exactly. Do not add, remove, round or recompute anything, and add no new claims.\n- Structure with markdown headings (##) that are numbered: ## 1. Project Data and Inputs, ## 2. Assumptions, ## 3. Calculations, ## 4. Results Summary, ## 5. Notes and Recommendations, ## 6. References. Adapt the titles to the content (for a review or comparison keep its own logical order), but always put References and used codes LAST and never first.\n- Tables as markdown pipe tables with a header row, consistent columns and units in headers. Equations on their own line in plain text (no LaTeX).\n- Remove filler, repetition, meta commentary and mechanical repeated words like compliant on every line; state compliance once in the results table. Neutral professional consultant tone.\n- Never move values between table columns, never leave a dash placeholder in limit or status cells (use the real limit or the words غير مطبق), and keep a full table as a table (do not turn tables into bullets).\n- Keep the original language: Arabic text stays Arabic, English technical terms and symbols stay English.\nOutput only the reformatted report, with no preface or closing remark.\n\nREPORT:\n'+src;
  var out=deLatex(await ask(a,sys(a),p));
  var A=numSet(src),B=new Set(numSet(out)),uniq=Array.from(new Set(A)),miss=uniq.filter(function(x){return !B.has(x)}).length;
  if(!out||out.length<src.length*0.6||(uniq.length&&miss/uniq.length>0.03)){doneStep(d,'التنسيق غيّر محتوى أو أرقام، فاتبقت النسخة الأصلية.');return src}
  doneStep(d,'تم تنسيق التقرير ('+uniq.length+' رقم اتحقق منهم، كلهم محفوظين).');return out
 }catch(e){if(e.name==='AbortError'){d.remove();throw e}doneStep(d,'تعذر التنسيق، اتبقت النسخة الأصلية.');return src}
}
async function startRun(task,followUp,res){
 if(!task||!agents().length)return;
 if(followUp)RCK=null;
 if(!followUp){homeProc();$('thread').innerHTML='';xlCtx=null;$('xlOut').hidden=true;$('pdfOut').hidden=true;$('run').hidden=false;$('steps').innerHTML='';$('finalCard').hidden=true;current={id:Date.now(),t:Date.now(),task,enriched:'',title:(typeof activeTmpl!=='undefined'&&activeTmpl)?activeTmpl.name+(($('task').value.trim())?': '+$('task').value.trim():''):'', user:($('task').value||'')};
  if(res&&RCK&&RCK.cur){Object.assign(current,RCK.cur);RCK.resumed=true;$('effort').value=RCK.E||$('effort').value;if(RCK.mail){$('mailAuto').checked=true;LS.set('teamai.mailAuto',true)}}
  else{RCK={v:1,task:task,E:$('effort').value,mail:$('mailAuto').checked,tn:(typeof activeTmpl!=='undefined'&&activeTmpl)?activeTmpl.name:'',cur:{id:current.id,t:current.t,title:current.title,user:current.user},steps:{},t:Date.now()}}
  ckSave();$('resumeBox').hidden=true}
 if(followUp)$('finalCard').hidden=true;
 if($('mailAuto').checked){keepAwake(true);if(!mailOk()){$('settings').hidden=false}}
 window.codesTask=task;abort=new AbortController();$('go').disabled=true;$('stop').disabled=false;$('sendF').disabled=true;procStart();document.getElementById('taskErr')?.remove();
 try{let f0;if(RCK&&RCK.steps.__final!=null)f0=RCK.steps.__final;else{f0=await runTask(task,0);if(RCK){RCK.steps.__final=f0;ckSave()}}const f=await fmtPass(f0,followUp);$('final').textContent=deLatex(f);$('finalCard').hidden=false;
  try{renderFinal();showSig();showPdf()}catch(e3){console.error(e3)}
  try{if(xlCtx){xlCtx.count=0;xlCtx.summary='';try{await makeXl(f)}catch(e2){if(e2.name==='AbortError')throw e2}xlShow()}}catch(e4){if(e4.name==='AbortError')throw e4;console.error(e4)}
  try{if(current){current.enriched=lastEnriched;saveCurrent();if(!current.ttl)genTitle(current)}}catch(e5){console.error(e5)}
  try{$('finalCard').scrollIntoView({behavior:'smooth'})}catch(e6){}
  if($('mailAuto').checked){try{await sendMail(true)}catch(e7){mailMsg('الإرسال التلقائي معملش. دوس Email Result.','bad')}}
  if(!followUp)ckClear()}
 catch(e){if(e.name==='AbortError'){}else{try{console.error(e);let b=document.getElementById('taskErr');if(!b){b=document.createElement('div');b.id='taskErr';b.setAttribute('role','alert');b.style.cssText='margin:10px 0;padding:12px;border:1px solid #c0392b;border-radius:10px;font-size:14px;line-height:1.7';const pr=document.getElementById('proc');pr&&pr.parentNode?pr.parentNode.insertBefore(b,pr):document.body.appendChild(b)}
b.textContent='';const m=document.createElement('div');m.textContent='المهمة فشلت: '+(e&&e.message?e.message:String(e));b.appendChild(m);const rb=document.createElement('button');rb.type='button';rb.className='sec';rb.textContent='Retry';rb.onclick=function(){b.remove();$('go').click()};b.appendChild(rb);b.hidden=false}catch(_){}}}
 finally{showResume();keepAwake(false);$('go').disabled=false;$('stop').disabled=true;$('sendF').disabled=false;abort=null;procStop()}
}
