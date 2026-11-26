const $=id=>document.getElementById(id);
function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function inl(t){return esc(t).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+?)\*\*/g,'<b>$1</b>').replace(/__([^_]+?)__/g,'<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g,'$1<i>$2</i>')}
function deLatex(t){t=String(t==null?'':t);
 var M={times:'×',cdot:'·',div:'÷',approx:'≈',le:'≤',leq:'≤',ge:'≥',geq:'≥',neq:'≠',pm:'±',Delta:'Δ',delta:'δ',phi:'φ',varphi:'φ',theta:'θ',Omega:'Ω',omega:'ω',mu:'μ',eta:'η',rho:'ρ',alpha:'α',beta:'β',gamma:'γ',lambda:'λ',pi:'π',sigma:'σ',circ:'°',degree:'°',rightarrow:'→',to:'→',Rightarrow:'⇒',Leftrightarrow:'⇔',leftarrow:'←',infty:'∞',cos:' cos',sin:' sin',tan:' tan',ln:'ln',log:'log',max:'max',min:'min',quad:' ',qquad:'  '};
 var SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
 function inner(x){
  for(var i=0;i<5;i++){x=x.replace(/_\{([^{}]*)\}/g,'_$1').replace(/\^\{(-?\d+)\}/g,'^$1').replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'($1)/($2)').replace(/\\sqrt\s*\[(\d+)\]\s*\{([^{}]*)\}/g,'$1√($2)').replace(/\\sqrt\s*\{([^{}]*)\}/g,'√($1)').replace(/\\(?:text|mathrm|mathbf|textbf|operatorname|mbox)\s*\{([^{}]*)\}/g,'$1').replace(/\\(?:left|right|big|Big)\b\s*/g,'')}
  x=x.replace(/\\sqrt\b/g,'√').replace(/\^\{?(-?\d+)\}?/g,function(m,d){return d.split('').map(function(c){return SUP[c]||c}).join('')}).replace(/\^\{([^{}]*)\}/g,'^($1)').replace(/_\{([^{}]*)\}/g,'_$1').replace(/\\([A-Za-z]+)/g,function(m,n){return M[n]!==undefined?M[n]:n}).replace(/\\[,;:! ]/g,' ').replace(/\\%/g,'%').replace(/\\([{}_&#])/g,'$1').replace(/[{}]/g,'');
  return x.replace(/[ \t]{2,}/g,' ').trim()}
 t=t.replace(/\$\$([\s\S]+?)\$\$/g,function(m,x){return inner(x)});
 t=t.replace(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g,function(m,a,b){return inner(a||b)});
 t=t.replace(/\$([^$\n]{1,200}?)\$/g,function(m,x){if(/^\s|\s$/.test(x))return m;if(/[\\^_{}=]/.test(x)||/^[^\s]{1,8}$/.test(x))return inner(x);return m});
 return t.replace(/ألاك/g,'أسلاك')}
function md(src){src=deLatex(src);
 const L=String(src||'').replace(/\r/g,'').split('\n');let o='',i=0,p=[];
 const flush=()=>{if(p.length){o+='<p>'+p.map(inl).join('<br>')+'</p>';p=[]}};
 const isRow=s=>/^\s*\|.*\|\s*$/.test(s),isSep=s=>/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
 const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
 while(i<L.length){const ln=L[i];
  if(/^\s*```/.test(ln)){flush();const b=[];i++;while(i<L.length&&!/^\s*```/.test(L[i]))b.push(L[i++]);i++;o+='<pre><code>'+esc(b.join('\n'))+'</code></pre>';continue}
  if(!ln.trim()){flush();i++;continue}
  let m;
  if(m=ln.match(/^\s*(#{1,6})\s+(.*)$/)){flush();const n=Math.min(m[1].length+1,5);o+='<h'+n+'>'+inl(m[2].replace(/\s*#+\s*$/,''))+'</h'+n+'>';i++;continue}
  if(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)){flush();o+='<hr>';i++;continue}
  if(isRow(ln)&&i+1<L.length&&isSep(L[i+1])){flush();const h=cells(ln);i+=2;const rows=[];while(i<L.length&&isRow(L[i]))rows.push(cells(L[i++]));
   o+='<div class="tw"><table><thead><tr>'+h.map(c=>'<th>'+inl(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+inl(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';continue}
  if(/^\s*>\s?/.test(ln)){flush();const b=[];while(i<L.length&&/^\s*>\s?/.test(L[i]))b.push(L[i++].replace(/^\s*>\s?/,''));o+='<blockquote>'+b.map(inl).join('<br>')+'</blockquote>';continue}
  if(m=ln.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)){flush();const ord=/\d/.test(m[2]);let items='';
   while(i<L.length&&(m=L[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))){const lvl=Math.min(Math.floor(m[1].replace(/\t/g,'  ').length/2),3);const io=/\d/.test(m[2]);items+='<li'+(io?' value="'+parseInt(m[2])+'"':'')+' style="list-style-type:'+(io?'decimal':'disc')+(lvl?';margin-inline-start:'+lvl*18+'px':'')+'">'+inl(m[3])+'</li>';i++}
   o+=(ord?'<ol>':'<ul>')+items+(ord?'</ol>':'</ul>');continue}
  p.push(ln.trim());i++}
 flush();return o}
function tblText(t){var L=String(t).split('\n'),o=[],i=0,isR=function(s){return /^\s*\|.*\|\s*$/.test(s)},isS=function(s){return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s)},cl=function(s){return s.trim().replace(/^\||\|$/g,'').split('|').map(function(x){return x.trim()})};
 while(i<L.length){if(isR(L[i])&&i+1<L.length&&isS(L[i+1])){var hd=cl(L[i]);i+=2;while(i<L.length&&isR(L[i])){var c=cl(L[i++]);o.push('- '+c.map(function(v,k){return (hd[k]?hd[k]+': ':'')+v}).join(' | '))}}else o.push(L[i++])}
 return o.join('\n')}
function plainText(t){return tblText(deLatex(t)).replace(/^\s*```.*$/gm,'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*|__/g,'').replace(/`/g,'').replace(/^\s*[-*+]\s+/gm,'- ').replace(/^\s*(-{3,}|\*{3,})\s*$/gm,'').replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/gm,'').replace(/\n{3,}/g,'\n\n').trim()}
function mailMsg(t,cls){var n=$('mailNote');n.hidden=!t;if(t)try{n.scrollIntoView({block:'nearest'})}catch(e){}n.textContent=t||'';n.style.color=cls==='ok'?'#7fd9a0':cls==='bad'?'#ff8a8a':''}
var _wl=null;async function keepAwake(on){try{if(on&&navigator.wakeLock&&!_wl){_wl=await navigator.wakeLock.request('screen');_wl.addEventListener('release',function(){_wl=null})}else if(!on&&_wl){await _wl.release();_wl=null}}catch(e){}}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&abort&&$('mailAuto').checked)keepAwake(true)});
function mailOk(){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((LS.get('teamai.email','')||'').trim())}
function escH(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

function secNum(html,inl){var lv=0;[2,3,4].some(function(n){if(html.indexOf('<h'+n+'>')>=0){lv=n;return true}});if(!lv)return html;var k=0;
 return html.replace(new RegExp('<h'+lv+'>','g'),function(){k++;return '<h'+lv+'>'+(inl?'<span style="display:inline-block;background:#1f3a5f;color:#fff;border-radius:50%;width:26px;height:26px;line-height:26px;text-align:center;font-size:13px;margin-left:8px;vertical-align:middle">'+k+'</span>':'<span class="sn">'+k+'</span>')})}
function pills(html,inl){var M=[[/^(غير مطابق|مرفوض|Non[- ]?compliant|Fail(ed)?|NOT OK)$/i,'bad'],[/^(حدّي|حدي|مقبول بملاحظات|Marginal|Check)$/i,'warn'],[/^(مطابق|مقبول|Compliant|Pass(ed)?|OK|Approved)$/i,'ok']];
 var C={ok:['#dcfce7','#166534'],bad:['#fee2e2','#991b1b'],warn:['#fef3c7','#92400e']};
 return html.replace(/<td>([^<]{2,24})<\/td>/g,function(m,t){var s=t.trim();for(var i=0;i<M.length;i++)if(M[i][0].test(s)){var k=M[i][1];return '<td>'+(inl?'<span style="background:'+C[k][0]+';color:'+C[k][1]+';padding:2px 10px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap">'+escH(s)+'</span>':'<span class="pl '+k+'">'+escH(s)+'</span>')+'</td>'}return m})}
function refNo(){var d=new Date(current&&current.t||Date.now()),p=function(n){return String(n).padStart(2,'0')};return 'TAI-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())}
function reportHTML(full){
 var ttl=(current&&histTitle(current))||'Task',when=new Date().toLocaleString('en-GB'),B='#1f3a5f';
 var b=pills(secNum(md($('final').textContent),true),true)
  .replace(/<div class="tw">|<\/div>/g,'')
  .replace(/<table>/g,'<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">')
  .replace(/<th>/g,'<th style="background:'+B+';color:#ffffff;padding:8px 10px;border:1px solid #c5d0de;text-align:right">')
  .replace(/<td>/g,'<td style="padding:9px 12px;border:1px solid #d5dde8;text-align:right;vertical-align:top;unicode-bidi:plaintext">')
  .replace(/<h2>/g,'<h2 style="font-size:20px;color:'+B+';border-bottom:2px solid '+B+';padding-bottom:6px;margin:26px 0 10px">')
  .replace(/<h3>/g,'<h3 style="font-size:17px;color:'+B+';border-right:4px solid #3b82f6;padding-right:10px;margin:22px 0 8px">')
  .replace(/<h4>/g,'<h4 style="font-size:15px;color:#334e7a;margin:16px 0 6px">')
  .replace(/<p>/g,'<p style="margin:8px 0;line-height:1.9">')
  .replace(/<li/g,'<li style="margin:4px 0;line-height:1.8"')
  .replace(/<code>/g,'<code style="background:#eef2f7;padding:1px 6px;border-radius:4px;font-family:Consolas,monospace;direction:ltr;unicode-bidi:isolate">')
  .replace(/<pre>/g,'<pre style="background:#f3f6fa;border:1px solid #d5dde8;border-radius:6px;padding:10px;direction:ltr;text-align:left;overflow:auto">')
  .replace(/<blockquote>/g,'<blockquote style="margin:10px 0;padding:8px 14px;border-right:4px solid #3b82f6;background:#f3f6fa;color:#334e7a">');
 var css='<style>.tr-z tr:nth-child(even) td{background:#f5f8fc}b{color:#12263f}'+(full?'@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{page-break-inside:avoid}h2,h3{page-break-after:avoid}':'')+'</style>';
 var card='<table role="presentation" width="720" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d5dde8">'
 +'<tr><td style="background:'+B+';padding:26px 28px 20px;color:#ffffff;border-bottom:4px solid #3b82f6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;letter-spacing:3px;color:#9fc0ee;font-weight:700">TEAM AI</td><td align="left" style="font-size:12px;color:#9fc0ee" dir="ltr">'+escH(refNo())+'</td></tr></table><div style="font-size:24px;font-weight:700;margin-top:10px;line-height:1.4">Engineering Report | التقرير الهندسي</div><div style="font-size:15px;color:#cfe0f7;margin-top:6px">'+escH(ttl)+'</div></td></tr>'
 +'<tr><td style="padding:0;background:#f3f6fa;border-bottom:1px solid #d5dde8"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334e7a"><tr><td style="padding:12px 28px;border-left:1px solid #d5dde8"><div style="font-size:11px;color:#6b7c93;letter-spacing:1px">DATE</div><b dir="ltr">'+escH(when)+'</b></td><td style="padding:12px 28px;border-left:1px solid #d5dde8"><div style="font-size:11px;color:#6b7c93;letter-spacing:1px">REF. NO.</div><b dir="ltr">'+escH(refNo())+'</b></td><td style="padding:12px 28px"><div style="font-size:11px;color:#6b7c93;letter-spacing:1px">STATUS</div><span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:10px;font-weight:700">Completed</span></td></tr></table></td></tr>'
 +'<tr><td style="padding:8px 28px 24px;color:#1b2430;font-size:15px"><div class="tr-z">'+b+'</div></td></tr>'
 +'<tr><td style="padding:0 28px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1f3a5f;font-size:12px;color:#334e7a;text-align:center"><tr><td style="padding-top:12px"><b>Prepared by</b><br>Team AI</td><td style="padding-top:12px"><b>Reviewed by</b><br>__________</td><td style="padding-top:12px"><b>Approved by</b><br>__________</td></tr></table></td></tr>'
 +'<tr><td style="padding:14px 28px;background:#f3f6fa;border-top:1px solid #d5dde8;font-size:12px;color:#6b7c93;text-align:center">تم إنشاء التقرير بواسطة Team AI. المحتوى مولّد بالذكاء الاصطناعي ولازم يتراجع من مهندس قبل الاعتماد.<br><span dir="ltr">Generated by Team AI. AI-generated content, engineer review required before approval.</span></td></tr></table>';
 var wrap='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7"><tr><td align="center" style="padding:24px 10px">'+card+'</td></tr></table>';
 if(!full)return css+'<div dir="rtl" style="font-family:Segoe UI,Tahoma,Arial,sans-serif">'+wrap+'</div>';
 return '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Team AI - '+escH(ttl)+'</title>'+css+'</head><body style="margin:0;background:#eef2f7;font-family:Segoe UI,Tahoma,Arial,sans-serif">'+wrap+'</body></html>'}

function mailSections(src){var L=deLatex(String(src||'')).replace(/\r/g,'').split('\n'),S=[],cur={t:'Summary',b:[]},i=0;
 var isR=function(s){return /^\s*\|.*\|\s*$/.test(s)},isS=function(s){return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s)},cl=function(s){return s.trim().replace(/^\||\|$/g,'').split('|').map(function(x){return x.trim()})},cln=function(s){return s.replace(/\*\*|__|`/g,'').replace(/^\s*[-*+]\s+/,'- ').trim()};
 function push(){var t=cur.b.join('\n').replace(/\n{3,}/g,'\n\n').trim();if(t)S.push({t:cur.t,b:t})}
 while(i<L.length){var ln=L[i],m;
  if(/^\s*```/.test(ln)){i++;continue}
  if(m=ln.match(/^\s*#{1,6}\s+(.*)$/)){push();cur={t:cln(m[1]).replace(/\s*#+\s*$/,'').replace(/^\d+[.)]\s*/,''),b:[]};i++;continue}
  if(isR(ln)&&i+1<L.length&&isS(L[i+1])){var hd=cl(ln);i+=2;var n=0;while(i<L.length&&isR(L[i])){var c=cl(L[i++]);n++;
    var rest=c.slice(1).map(function(v,k){return (hd[k+1]?hd[k+1]+': ':'')+cln(v)}).filter(function(x){return x}).join('  |  ');
    cur.b.push(n+'. '+cln(c[0]||'')+(rest?'\n     '+rest:''))}cur.b.push('');continue}
  if(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)){i++;continue}
  var s=cln(ln);cur.b.push(/^-\s/.test(s)?'  '+s.replace(/^-\s/,'\u2022 '):s);i++}
 push();return S}
function mailBodyText(src){var S=mailSections(src),bar='============================',thin='----------------------------';
 return S.map(function(s,k){return bar+'\n'+(k+1)+') '+s.t.toUpperCase()+'\n'+bar+'\n'+s.b}).join('\n\n')}

function mailPayload(subj,ttl,when,src){var bar='==================================================';
 var head=bar+'\nTEAM AI | ENGINEERING REPORT\n'+bar+'\n\nالمهمة / Task : '+ttl+'\nالحالة / Status : تم الإنجاز (Completed)\nوقت الانتهاء / Finished : '+when+'\nرقم المرجع / Ref : '+refNo()+'\n\n';
 var foot='\n\n'+bar+'\nمحتوى مولّد بالذكاء الاصطناعي ولازم يتراجع من مهندس قبل الاعتماد.\nGenerated by Team AI. Engineer review required before approval.\n'+bar;
 return {_subject:subj,_template:'box',_captcha:'false','Report':head+mailBodyText(src).replace(/\n/g,'\n')+foot}}
function ejsCfg(){var c=LS.get('teamai.ejs',{})||{};return(c.s&&c.t&&c.k)?c:null}
async function sendMail(auto){
 var em=(LS.get('teamai.email','')||'').trim();
 if(!mailOk()){if(!auto){$('settings').hidden=false;$('mailTo').focus()}mailMsg('اكتب إيميلك في Settings واضغط حفظ الأول.','bad');return}
 var body=mailBodyText($('final').textContent),ttl=(current&&histTitle(current))||'Task',b=$('mailBtn'),when=new Date().toLocaleString('en-GB');
 var subj='Team AI - تقرير: '+ttl;
 var text='تقرير المهمة (Team AI)\n\nالمهمة: '+ttl+'\nالتاريخ: '+when+'\nالحالة: تم الإنجاز\n\n----- النتيجة -----\n\n'+body;
 b.disabled=true;mailMsg(auto?'بيبعت التقرير على الإيميل...':'بيتبعت...');
 var done=false,note='';
 try{
  var E=ejsCfg();
  if(E){try{var r0=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_id:E.s,template_id:E.t,user_id:E.k,template_params:{to_email:em,subject:subj,html:reportHTML(false),task:ttl,when:when,status:'تم الإنجاز',message:body}})});if(r0.ok){done=true;note='اتبعت التقرير (HTML) على '+em+' ✔'}}catch(e0){}}
  if(!done){
   var r2=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(em),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(mailPayload(subj,ttl,when,$('final').textContent)) });
   var j2={};try{j2=await r2.json()}catch(e){}
   if(j2.success===true||j2.success==='true'){done=true;note=/activat/i.test(String(j2.message||''))?'FormSubmit بعتلك إيميل تفعيل على '+em+' (مرة واحدة بس). افتحه واضغط Activate، وبعدين دوس Email Result تاني.':'اتبعت على '+em+' ✔'}}
  if(!done)throw new Error('x');
  mailMsg(note,'ok')
 }catch(e){
  if(auto){mailMsg('الإرسال التلقائي معملش. دوس Email Result تحت علشان تجرب تاني.','bad')}
  else{try{await navigator.clipboard.writeText(text)}catch(e2){}
   mailMsg('الإرسال المباشر معملش. فتحتلك تطبيق الإيميل بنص مختصر، والنتيجة الكاملة اتنسخت في الحافظة، الصقها هنا.','bad');
   location.href='mailto:'+em+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(text.slice(0,1500)+(text.length>1500?'\n...\n(النتيجة الكاملة منسوخة في الحافظة)':''))}
 }finally{b.disabled=false}
}
function previewReport(){var w=window.open('','_blank');if(w){w.document.open();w.document.write(reportHTML(true));w.document.close()}else{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([reportHTML(true)],{type:'text/html'}));a.download='Team-AI-Report.html';a.click()}}
$('repBtn').onclick=previewReport;
function repFile(){var t=(current&&histTitle(current))||'Report';return 'Team-AI-'+refNo()+'-'+String(t).replace(/[^\w\u0600-\u06FF]+/g,'_').slice(0,40)}
function dlBlob(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
function wordReport(){var x=reportHTML(true).replace('<html dir="rtl" lang="ar">','<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">').replace('<head>','<head><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->');
 dlBlob(new Blob(['\ufeff'+x],{type:'application/msword;charset=utf-8'}),repFile()+'.doc')}
function pdfReport(){var x=reportHTML(true)+'';var w=null;try{w=window.open('','_blank')}catch(e){}
 if(w){w.document.open();w.document.write(x);w.document.close();setTimeout(function(){try{w.focus();w.print()}catch(e){}},700);return}
 var f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.srcdoc=x;f.onload=function(){setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print()}catch(e){}setTimeout(function(){f.remove()},5000)},500)}}
$('docBtn').onclick=function(){try{wordReport()}catch(e){mailMsg('تحميل Word معملش، جرب Report.','bad')}};
$('pdfBtn').onclick=function(){try{pdfReport()}catch(e){mailMsg('تحميل PDF معملش، جرب Report.','bad')}};

$('mailBtn').onclick=function(){sendMail(false)};
(function(){var c=$('mailAuto');c.checked=!!LS.get('teamai.mailAuto',false);c.onchange=function(){LS.set('teamai.mailAuto',c.checked);if(c.checked&&!mailOk()){$('settings').hidden=false;$('mailTo').focus()}}})();
function isLetter(t){return /خطاب|رسالة رسمية|formal letter/i.test(t||'')}
function showSig(){const sg=LS.get('teamai.sig','');const on=!!sg&&current&&isLetter(current.task);$('sigOut').hidden=!on;if(on)$('sigImg').src=sg}
function showSigPrev(){const sg=LS.get('teamai.sig','');$('sigPrev').hidden=!sg;if(sg)$('sigPrev').src=sg;$('sigDel').hidden=!sg}
$('sigFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,500/im.width);const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);LS.set('teamai.sig',c.toDataURL('image/jpeg',0.85));showSigPrev();showSig();$('testOut').textContent='التوقيع اتحفظ ✔'};im.src=r.result};r.readAsDataURL(f)};
$('sigDel').onclick=()=>{localStorage.removeItem('teamai.sig');showSigPrev();showSig()};
showSigPrev();
let files=[],xlCtx=null;
function loadXLSX(){return window.XLSX?Promise.resolve():new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';sc.onload=res;sc.onerror=()=>rej(new Error('تعذر تحميل مكتبة الإكسيل (محتاج نت)'));document.head.appendChild(sc)})}
function sheetsText(wb){let out='',left=60000;for(const n of wb.SheetNames){const ws=wb.Sheets[n];if(!ws||!ws['!ref'])continue;const rg=XLSX.utils.decode_range(ws['!ref']);let t='## Sheet: '+n+' (range '+ws['!ref']+')\n';
 for(let r=rg.s.r;r<=rg.e.r;r++){const cells=[];for(let c=rg.s.c;c<=rg.e.c;c++){const ad=XLSX.utils.encode_cell({r,c}),cl=ws[ad];if(!cl||(cl.v==null&&!cl.f))continue;cells.push(ad+'='+(cl.f?'['+'='+cl.f+'] -> ':'')+(cl.v==null?'':String(cl.v)))}
  if(cells.length)t+=cells.join(' | ')+'\n';if(t.length>left){t+='...(اتقص: الشيت كبير)\n';break}}
 left-=t.length;out+=t+'\n';if(left<=0)break}return out}
function recalc(wb){
 const cache={};let miss=0;
 const val=(sh,ad)=>{const k=sh+'!'+ad;if(k in cache)return cache[k];const ws=wb.Sheets[sh];const cl=ws&&ws[ad];if(!cl)return cache[k]=0;
  if(cl.f){cache[k]=0;let v;try{v=evalF(sh,cl.f)}catch{v=undefined}if(v===undefined||(typeof v==='number'&&!isFinite(v))){v=cl.v!==undefined?cl.v:0;miss++}cl.v=v;cl.t=typeof v==='number'?'n':typeof v==='boolean'?'b':'s';delete cl.w;return cache[k]=v}
  return cache[k]=cl.v===undefined?0:cl.v};
 const rng=(sh,a,b)=>{const r=XLSX.utils.decode_range(a+':'+b),o=[];for(let i=r.s.r;i<=r.e.r;i++)for(let j=r.s.c;j<=r.e.c;j++)o.push(val(sh,XLSX.utils.encode_cell({r:i,c:j})));return o};
 const nums=a=>a.flat(9).filter(x=>typeof x==='number');
 const F={SUM:(...a)=>nums(a).reduce((x,y)=>x+y,0),AVERAGE:(...a)=>{const n=nums(a);return n.reduce((x,y)=>x+y,0)/n.length},MIN:(...a)=>Math.min(...nums(a)),MAX:(...a)=>Math.max(...nums(a)),ROUND:(x,d=0)=>Math.round(x*10**d)/10**d,ABS:Math.abs,COUNT:(...a)=>nums(a).length,IF:(c,x,y)=>c?x:y,SQRT:Math.sqrt};
 function evalF(sh,f){
  let e=f.replace(/"[^"]*"/g,m=>JSON.stringify(m.slice(1,-1)));
  e=e.replace(/(?:'([^']+)'|([A-Za-z_][\w.]*))?!?\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)/g,(m,q,u,c1,r1,c2,r2)=>{const n=q||(m.includes('!')?u:null)||sh;return 'R('+JSON.stringify(n)+',"'+c1+r1+'","'+c2+r2+'")'});
  e=e.replace(/(^|[^\w"$.])(?:'([^']+)'!|([A-Za-z_]\w*)!)?\$?([A-Z]{1,3})\$?(\d+)(?![\w(])/g,(m,pre,q,u,c,r)=>pre+'V('+JSON.stringify(q||u||sh)+',"'+c+r+'")');
  e=e.replace(/\b([A-Z]{2,})\(/g,(m,n)=>{if(!F[n])throw new Error('fn '+n);return 'F.'+n+'('}).replace(/\^/g,'**').replace(/<>/g,'!==').replace(/([^<>!=])=(?!=)/g,'$1==').replace(/(\d)%/g,'($1/100)').replace(/&/g,'+');
  return new Function('R','V','F','return ('+e+')')((a,b,c)=>rng(a,b,c),val,F)}
 for(const sh of wb.SheetNames){const ws=wb.Sheets[sh];for(const ad of Object.keys(ws)){if(ad[0]==='!')continue;if(ws[ad]&&ws[ad].f)val(sh,ad)}}
 return miss}
function applyEdits(wb,edits){let n=0;for(const e of edits||[]){const ws=wb.Sheets[e.sheet]||wb.Sheets[wb.SheetNames[0]];if(!ws||!e.cell||!/^[A-Z]{1,3}[0-9]{1,6}$/.test(e.cell))continue;
 let cl;if(typeof e.formula==='string'&&e.formula.trim())cl={t:'n',f:e.formula.trim().replace(/^=/,'')};else if(e.value!==undefined&&e.value!==null)cl=typeof e.value==='number'?{t:'n',v:e.value}:{t:'s',v:String(e.value)};else continue;
 ws[e.cell]=cl;const a=XLSX.utils.decode_cell(e.cell),rg=ws['!ref']?XLSX.utils.decode_range(ws['!ref']):{s:a,e:a};rg.s.r=Math.min(rg.s.r,a.r);rg.s.c=Math.min(rg.s.c,a.c);rg.e.r=Math.max(rg.e.r,a.r);rg.e.c=Math.max(rg.e.c,a.c);ws['!ref']=XLSX.utils.encode_range(rg);n++}
 wb.Workbook=wb.Workbook||{};wb.Workbook.CalcPr={fullCalcOnLoad:true};try{recalc(wb)}catch{}return n}
async function makeXl(final){const A=agents(),lead=A[0];
 const sheets=sheetsText(xlCtx.wb);
 const raw=await stepF('تجهيز الإكسيل المحسّن',lead,x=>()=>ask(x,sys(x),'You are editing an Excel workbook according to the team review below. Current workbook content (cell=[=formula] -> value):\n'+sheets+'\n\nTeam review and conclusions:\n'+final+'\n\nReturn ONLY a JSON object: {"edits":[{"sheet":"SheetName","cell":"B5","formula":"=SUM(B1:B4)"} or {"sheet":"SheetName","cell":"C7","value":123}],"summary":"short Arabic summary of what changed"}. Include only cells that must change to fix errors or apply the agreed improvements. Prefer formulas over typed numbers where the cell is a calculation. Use English function names and comma separators.',true));
 let j;try{j=JSON.parse(raw.match(/\{[\s\S]*\}/)[0])}catch{j=null}
 if(!j||!Array.isArray(j.edits))throw new Error('مقدرتش أطلع تعديلات الإكسيل');
 const n=applyEdits(xlCtx.wb,j.edits);xlCtx.text=sheetsText(xlCtx.wb);xlCtx.count=(xlCtx.count||0)+n;
 xlCtx.summary=j.summary||''}
var XLRS='Team AI Results';
function xlRows(t){var rows=[['Team AI - '+(current&&histTitle(current)||'Results')],[new Date().toLocaleString()],[]];String(t||'').split('\n').forEach(function(l){l=l.replace(/\s+$/,'');if(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l))return;if(/^\s*\|.*\|\s*$/.test(l)){rows.push(l.trim().replace(/^\||\|$/g,'').split('|').map(function(c){c=plainText(c).trim();var n=Number(c.replace(/,/g,''));return c!==''&&isFinite(n)&&/^[-+]?[\d.,]+$/.test(c)?n:c}))}else rows.push([plainText(l)])});return rows}
function xlShow(){var ok=!!xlCtx;$('xlOut').hidden=!ok;if(!ok)return;$('xlDl').textContent='تحميل الإكسيل مع شيت النتائج';var c=xlCtx.count||0;$('xlNote').textContent='الملف فيه شيت جديد "'+XLRS+'" بنتيجة المهمة كاملة'+(c?(' + '+c+' تعديل على خلايا الملف الأصلي'+(xlCtx.summary?' ('+xlCtx.summary+')':'')):' (من غير تعديل على خلايا الملف الأصلي)')}
$('xlDl').onclick=()=>{if(!xlCtx)return;var wb=xlCtx.wb;var i=wb.SheetNames.indexOf(XLRS);if(i>=0){wb.SheetNames.splice(i,1);delete wb.Sheets[XLRS]}var ws=XLSX.utils.aoa_to_sheet(xlRows($('final').textContent));var w=0;xlRows($('final').textContent).forEach(function(r){r.forEach(function(c,k){if(k===0)w=Math.max(w,Math.min(String(c).length,90))})});ws['!cols']=[{wch:Math.max(w,24)},{wch:22},{wch:22},{wch:22},{wch:22},{wch:22}];XLSX.utils.book_append_sheet(wb,ws,XLRS);XLSX.writeFile(wb,xlCtx.name.replace(/\.[^.]+$/,'')+'-with-results.xlsx',{bookType:'xlsx'})};
$('attach').onclick=()=>$('file').click();
$('file').onchange=async e=>{
 for(const f of e.target.files){
  if(f.size>12*1024*1024){alert(f.name+' أكبر من 12 ميجا');continue}
  if(/\.(xlsx|xlsm|xls|csv)$/i.test(f.name)){
   try{await loadXLSX();const wb=XLSX.read(await f.arrayBuffer(),{cellFormula:true,cellNF:true,cellStyles:true});
    files.push({name:f.name,mime:'xl',xl:true,wb,text:sheetsText(wb),macro:/\.xlsm$/i.test(f.name)})}
   catch(err){alert('مقدرتش أقرا '+f.name+': '+err.message)}
   continue}
  const b64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.readAsDataURL(f)});
  files.push({name:f.name,mime:f.type||'application/octet-stream',b64});
 }
 e.target.value='';renderChips();
};
function renderChips(){$('chips').innerHTML='';files.forEach((f,i)=>{const s=document.createElement('span');s.className='chip';s.textContent=f.name+' ✕';s.title='اضغط للمسح';s.onclick=()=>{files.splice(i,1);renderChips()};$('chips').appendChild(s)})}
const TMPLS=[["راجع إكسيل", "أنت مهندس مراجعة (Technical Reviewer) خبير في الأعمال الهندسية والـ BOQ والحسابات الإنشائية والـ MEP. راجع ملف الإكسيل المرفق مراجعة كاملة وصارمة على 3 مستويات:\n\n1) الوظيفة (Purpose): الشيت ده معمول لإيه؟ هل هيكله وبياناته ومخرجاته بتحقق الغرض ده؟ في أعمدة أو خانات أو خطوات ناقصة؟\n2) المنهجية (Methodology): طريقة الحساب نفسها سليمة؟ الافتراضات والمعاملات والوحدات (Units) والمراجع أو الكودات المستخدمة مناسبة؟ في تحققات (Checks) أو هوامش أمان (Safety Factors) أو حالات ناقصة مش متغطية؟\n3) الحسابات (Calculations): أي خطأ في المعادلات أو الجمع (SUM ranges) أو الكميات أو الأسعار، وأي رقم مش متسق أو مكتوب بإيد (Hard-coded) مكان معادلة، وأي مرجع خلية غلط.\n\nطريقة الشغل: افحص كل شيت (Sheet) لوحده، وبعدين اتأكد من الترابط بين الشيتات. متفترضش أي رقم مش موجود في الملف، ولو معلومة ناقصة قول إنها ناقصة.\n\nشكل الإخراج: قائمة ملاحظات مرقمة مرتبة بالأهمية (حرجة، متوسطة، تحسينية). لكل ملاحظة: (أ) رقم الخلية أو الجزء، (ب) المشكلة بالظبط، (ج) السبب، (د) التحسين المقترح. اختم بملخص من 3 أسطر عن الحالة العامة للملف.\n\nمعايير الجودة: كل ملاحظة لازم تكون محددة ومثبتة بخلية أو رقم، من غير كلام عام. المصطلحات الهندسية بالإنجليزي. اعرض كل الملاحظات والتعديلات المقترحة وأي حسابات نصًا كاملًا في ردك (الخلية، القيمة القديمة، القيمة الجديدة، السبب، والمعادلة والتعويض والناتج). متوعدش بملف ولا تقول إنه جاهز."], ["قارن مستندات", "أنت مهندس مراجعة (Document Controller / Reviewer) مسؤول عن اكتشاف التعارضات بين المستندات. قارن المستندات المرفقة (مثلاً المناقصة/Tender، الرسومات التنفيذية/Shop Drawings، الـ BOQ، المواصفات) بند بند.\n\nاكشف: أي تعارض في الأبعاد أو المناسيب (Levels) أو الأقطار أو المقاسات، اختلاف في البنود أو الكميات أو الأسعار أو الوحدات، وأي بند متحذف أو مضاف أو معدّل.\n\nطريقة الشغل: حدد الأول أنهي مستند هو المرجع (Baseline) وأنهي هو المقارَن، وبعدين قارن بنداً بنداً ومتتخطاش حاجة. لو في بند مش واضح في مستند اذكر ده صراحة بدل ما تفترض.\n\nشكل الإخراج: جدول أو قائمة مرقمة مرتبة بالأهمية. لكل ملاحظة: رقم البند، مكانه في كل مستند، القيمة في كل مستند، الفرق بالظبط، وتقييمك (خطأ مرجح / تعديل مقصود / محتاج توضيح) وليه. اختم بقائمة \"نقاط محتاجة توضيح من الاستشاري أو المقاول\".\n\nمعايير الجودة: دقة الأرقام والمراجع، من غير تخمين، والمصطلحات الهندسية بالإنجليزي."], ["راجع مخطط", "أنت مهندس استشاري (Consultant Engineer) بتراجع رسومات (Drawings) قبل الاعتماد. راجع المخطط المرفق مراجعة هندسية كاملة:\n\n1) البيانات العامة: عنوان الرسم، رقم الرسمة والمراجعة (Revision)، المقياس (Scale)، التاريخ، ومطابقتها للمشروع.\n2) الأبعاد والمناسيب (Dimensions & Levels): اتساقها داخل الرسمة وبين المناظر (Plan / Section / Elevation)، وأي بعد ناقص أو غير منطقي.\n3) المواصفات والمواد والأقطار والأحجام، والتفاصيل (Details) والمراجع للكودات.\n4) التعارضات (Clashes) بين التخصصات (Architectural / Structural / MEP) والملاحظات والرموز.\n5) أي معلومة ناقصة أو مش مقروءة.\n\nمتفترضش حاجة مش ظاهرة في الرسمة، ولو مش مقروءة اذكر ده.\n\nشكل الإخراج: قائمة ملاحظات مرقمة مرتبة بالأهمية (حرجة، متوسطة، تحسينية). لكل ملاحظة: مكانها في الرسمة، المشكلة بالظبط، والإجراء المطلوب. اختم بتوصية: Approved / Approved as Noted / Revise & Resubmit، مع السبب.\n\nمعايير الجودة: ملاحظات محددة وقابلة للتنفيذ، والمصطلحات الهندسية بالإنجليزي."], ["ملاحظات اعتماد", "أنت مهندس استشاري بتكتب ملاحظات الاعتماد (Submittal Review Comments) على المستند أو المخطط المرفق بأسلوب رسمي مختصر.\n\nالخطوات: (1) افحص المستند وحدد الملاحظات الفعلية بس، (2) رتبها بالأهمية، (3) صوغ كل ملاحظة كتعليمة واضحة للمقاول.\n\nشكل الإخراج: ملاحظات مرقمة، كل ملاحظة في سطر أو سطرين، بصيغة آمرة محددة (مثال: \"Revise the pipe size at Gridline B-3 to 150mm as per the specifications.\"). اكتب مرجع الملاحظة (رقم البند أو الرسمة أو الموضع) في أولها. المصطلحات الفنية بالإنجليزي والباقي بنفس لغة المستند المرفق.\nفي آخر الرد اكتب Status مقترح: Approved / Approved as Noted / Revise & Resubmit / Rejected.\n\nمعايير الجودة: من غير حشو أو مجاملات، كل ملاحظة قابلة للتنفيذ ومرتبطة بمكان محدد، وملاحظات حقيقية موجودة في المستند بس. لو المستند عبارة عن PDF، هيتجهز زرار تحميل PDF فيه الملاحظات."], ["لخص مستند", "أنت مهندس مراجعة بتلخص مستند للإدارة. لخص المستند المرفق بدقة.\n\nالخطوات: اقرا المستند كله، حدد الغرض منه، واستخرج المهم بس.\n\nشكل الإخراج:\n- سطرين: الغرض من المستند وأهم استنتاج.\n- النقاط الرئيسية (5 إلى 10 نقاط) بترتيب الأهمية.\n- الأرقام والكميات والتواريخ والمبالغ المهمة (في جدول لو كتير).\n- الالتزامات والمسؤوليات والشروط والمخاطر (Risks).\n- أي حاجة غامضة أو ناقصة أو محتاجة قرار.\n\nمعايير الجودة: الأرقام والأسماء بالظبط زي ما هي في المستند، من غير ما تضيف معلومة مش موجودة، والمصطلحات الهندسية بالإنجليزي."], ["خطاب رسمي", "أنت مهندس استشاري ومتخصص في المراسلات الرسمية للمشروعات. اكتب خطاب رسمي (Formal Letter) مختصر وواضح بخصوص الموضوع اللي هكتبه تحت.\n\nالهيكل: التاريخ والمرجع (Ref.) → اسم الجهة والمستلم → الموضوع (Subject) → فقرة افتتاحية → المحتوى (الوقائع، المطلوب، المهلة) → ختام مهذب وتوقيع.\n\nالأسلوب: رسمي مهذب ومباشر، جمل قصيرة، من غير مبالغة أو مجاملات زايدة، والمصطلحات الفنية بالإنجليزي. متضيفش معلومة أو رقم مش مذكور، وحط [ ] مكان أي بيانات ناقصة (تاريخ، رقم مرجع، اسم).\n\nالموضوع والتفاصيل هتجيلك تحت."], ["رد على إيميل", "أنت مهندس استشاري بيرد على إيميلات الشغل باحترافية. اكتب رد جاهز للإرسال على الإيميل اللي هلصقه، بناءً على النقاط اللي هكتبها.\n\nالخطوات: افهم المطلوب بالظبط من الإيميل، غطي كل سؤال أو طلب فيه، وادمج النقاط بتاعتي في الرد.\n\nالأسلوب: مختصر ومهذب ومناسب للشغل الهندسي الاستشاري، من غير حشو. نبرة الرد: [رسمي / ودود] (احذف اللي مش عايزه). رد بنفس لغة الإيميل الأصلي (إنجليزي أو عربي)، والمصطلحات الفنية بالإنجليزي. اكتب سطر Subject لو محتاج، تحية مناسبة، الرد، وختام بسيط. متخترعش معلومات أو التزامات أو مواعيد مش مذكورة، وحط [ ] مكان أي بيانات ناقصة.\n\nالمدخلات هتجيلك تحت: الإيميل اللي وصلني، وبعده النقاط اللي عايز أرد بيها (لو مفيش نقاط، اقترح رد مناسب)."], ["Humanize", "أنت محرر لغوي محترف. أعد صياغة النص اللي هلصقه بحيث يقرا بشكل طبيعي كأنه مكتوب بإيد إنسان، مع الحفاظ على المعنى والمعلومات كاملة.\n\nالخطوات والأسلوب:\n- نوّع طول الجمل (قصيرة وطويلة بالتبادل) وبداية الجمل، وتجنب التكرار والإيقاع الرتيب.\n- استخدم مفردات طبيعية ومتداولة، وتجنب العبارات المستهلكة والنمطية والمقدمات والخواتيم العامة (مثل \"في الختام\" و\"من الجدير بالذكر\" و\"it is important to note\" و\"in today's fast-paced world\").\n- قلل القوائم والتنسيق الزايد في الجمل العادية، وخلي الربط بين الأفكار سلس.\n- متضيفش معلومات أو أرقام جديدة، وماتحذفش أي معلومة أو رقم.\n- اللغة: لو النص عربي يطلع عربي طبيعي بنفس مستواه (فصحى مبسطة أو عامية حسب الأصل)، ولو إنجليزي يطلع إنجليزي طبيعي.\n- حافظ على التنسيق الأساسي (العناوين والقوايم) لو موجودة.\n\nالإخراج: النص المعاد صياغته بس، من غير شرح أو تعليق.\n\nالنص هيجيلك تحت."],["إجراء حسابات","أنت مهندس استشاري أول (Senior Consultant Engineer) كهروميكانيكي في السعودية، وهتعمل الحسابات الهندسية كاملة (مش مراجعة بس) بصيغة جاهزة للاعتماد. المستخدم هيدخلك المدخلات بأي صيغة (نص، إكسيل، Word، PDF، صور): مساحات، أحمال كهربائية أو ميكانيكية، أطوال كابلات، جهود، ظروف تركيب، إلخ.\n\nاختيار الكود (مهم): المستخدم مش هيحدد الكود. انت تختار الكود أو الأكواد المناسبة لنوع الحساب من مكتبة الأكواد المفعّلة في المصادر المرجعية اللي معاك (Codes Library) وتشتغل جواها. اختر الكود وإصداره بصمت واستخدمه في الحسابات، وتوثيقه يتكتب في قسم References في آخر التقرير بس، مش في أول التقرير. استشهد بالبند أو الجدول بالرقم لما يكون موجود في نص المكتبة. لو بند مش موجود في ملخص المكتبة متخترعش رقمه ومتكررش عبارات التحفظ جنب كل سطر؛ اجمع كل المراجع غير المؤكدة في ملاحظة واحدة قصيرة في آخر التقرير. الأرقام اللي من الكود علّمها [من الكود] والأرقام اللي من الممارسة الهندسية العامة علّمها [ممارسة عامة].\n\nقواعد التنفيذ:\n1) المدخلات: لخّص كل المعطيات في جدول بوحداتها. حوّل الوحدات لو لازم.\n2) الافتراضات: لو أي مدخل ناقص، افترض قيمة معقولة وهندسية، واكتبها في قسم 'الافتراضات' بوضوح مع السبب، وعلّمها للمستخدم يأكدها. متسكتش عن أي افتراض ومتخفيش أي رقم مفترض.\n3) لكل حساب اكتب بالترتيب: (أ) المعادلة المستخدمة بالرموز، (ب) التعويض بالقيم الفعلية مع الوحدات، (ج) الناتج الوسيط والنهائي بتقريب مناسب، (د) المرجع (الكود/البند).\n4) الكهرباء: حساب الأحمال (connected/demand/diversity)، التيار التصميمي، اختيار القاطع (In) والتنسيق مع الكابل (Ib ≤ In ≤ Iz)، مقطع الكابل مع معاملات التخفيض (حرارة، تجميع، طريقة التركيب)، الهبوط في الجهد ومقارنته بالحد المسموح، تيار القصر والتحقق من قدرة القطع (Icu/Icn) وتحمل الكابل حراريًا لو البيانات تسمح، حجم المحول/المولد وعامل القدرة والتعويض لو مطلوب.\n5) الميكانيكا: حمل التبريد/التسخين أو التهوية أو الضخ أو المياه حسب المدخلات، بالمعادلات والتعويض.\n6) تحقق ذاتي: راجع كل رقم بإعادة حساب سريعة أو فحص منطقي، وقارن النتائج بحدود الكود (مطابق / غير مطابق / حدّي) وبيّن لو في اختيار تجاري قياسي أعلى لازم يتحدد.\n7) قواعد معادلات التيار (إلزامية، ممنوع الخلط): معامل القدرة cosφ بيحوّل القدرة الظاهرية S (VA) لقدرة فعلية P (W) بس: P = S × cosφ. وعكسه S = P / cosφ. التيار من القدرة الظاهرية: Ib = S / (√3 × V_LL) لثلاثي الفاز، وIb = S / V لأحادي الفاز، ومتقسمش على cosφ تاني لأن S أصلاً VA وcosφ اتطبق عليها قبل كده. التيار من القدرة الفعلية: Ib = P / (√3 × V_LL × cosφ). قبل ما تكتب أي معادلة تيار تأكد من وحدة القدرة اللي بتعوض بيها: VA أو W، واكتب الوحدة بجانب الرقم. وراجع مثال حسابي بسيط: 21420 VA عند 400 V ثلاثي = 21420 / (1.732 × 400) = 30.9 A.\n8) الناتج النهائي نظيف: ممنوع تظهر أي تردد أو مراجعة ذاتية أو تفاوض داخلي في الرد (زي 'يمكن 40 أو 50' أو 'لنلتزم بـ' أو 'بالمراجعة'). لو احتجت تتحقق، اعمل ده في دماغك واكتب القيمة النهائية الواحدة بس، واختار قيمة واحدة للقاطع والكابل وبرر اختيارك في جملة واحدة. ممنوع كمان LaTeX: اكتب المعادلات نص عادي بعلامات × ÷ √ ².\n9) اختيار القاطع (إلزامي): In = أقرب قيمة قياسية أعلى من أو تساوي Ib مباشرة من السلسلة القياسية 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630... (مثال: Ib = 30.9 A يبقى In = 32 A). ممنوع تختار قيمة أكبر 'كهامش أمان' إلا لو فيه سبب مصرّح به في المدخلات (حمل مستقبلي، محرك بتيار بدء، متطلب مشروع) وتكتب السبب. وبعد الاختيار اكتب تحقق التنسيق صراحة: Ib ≤ In ≤ Iz بالأرقام، وكمان I2 ≤ 1.45 Iz لو البيانات تسمح، ولو In أكبر من Iz غيّر مقطع الكابل مش القاطع.\n10) الهبوط في الجهد (إلزامي): في التغذية ثلاثية الفاز ΔV (خط-خط) = √3 × Ib × L × (R cosφ + X sinφ)، والنسبة المئوية %ΔV = ΔV / V_LL × 100 على جهد الخط-خط V_LL (400 V) مش V_LN (230 V). مثال: 4.35 / 400 = 1.09%. لو حسبت هبوط الفاز الواحد فالقسمة على 230، ولو حسبت هبوط الخط-خط فالقسمة على 400، وممنوع تخلط. أحادي الفاز: ΔV = 2 × Ib × L × (R cosφ + X sinφ) والنسبة على 230 V. قارن النتيجة بالحد المسموح من الكود المختار واكتب مطابق أو لا.\n11) اتساق الأرقام (إلزامي): أي قيمة مذكورة في قسم الافتراضات (معاملات الطلب demand factors، cosφ، الجهد، معاملات التخفيض، أطوال... إلخ) لازم تكون هي نفسها بالظبط اللي اتطبقت في الحسابات. قبل ما تكتب الرد النهائي قارن كل افتراض بالرقم المستخدم في الحسابات، ولو لقيت اختلاف صحّح الاتنين على قيمة واحدة. ممنوع قيمة في مكان وقيمة تانية في مكان تاني.\n12) الجداول (إلزامي): لو المهمة طلبت جدول أحمال (Load Schedule) أو أي جدول، اعرضه كجدول كامل صريح بأعمدته (الحمل، kW، cosφ، kVA، demand factor، kVA بعد المعامل، التيار... حسب الحالة) مع صف إجمالي، مش نقاط أو سرد. الجداول لازم صفوفها كلها بنفس عدد الأعمدة وكل قيمة تحت عنوانها الصحيح وبوحدتها.\n13) جدول النتائج: ممنوع الشرطة '-' أو الخانة الفاضية في أعمدة الحد أو الحالة: اكتب الحد الفعلي، أو 'غير مطبق' لو مفيش حد. استخدم المصطلحات القياسية بالإنجليزي: Breaking Capacity (Icu)، Short-Circuit Current (Isc)، Voltage Drop، Demand Factor، Diversity Factor. ممنوع ترجمات حرفية غريبة مثل 'قدرة القطع التراصيلية'؛ اكتب 'قدرة القطع (Breaking Capacity, Icu)'.\n14) تبرير المعاملات: لو المهمة طلبت تبرير معاملات الطلب أو أي معامل مختار، اكتب قسم مستقل بجدول من أعمدة: الحمل، القيمة، سبب الاختيار، المصدر (الكود والبند أو 'ممارسة هندسية عامة' مرة واحدة). لازم تبرر كل حمل لوحده، مش جملة عامة.\n15) متوعدش بملفات ولا تقول إن ملف جاهز؛ كل الحسابات والجداول تتكتب نصًا في الرد.\n\nالإخراج بصيغة تقرير استشاري رسمي بالترتيب ده: (أ) بيانات المشروع والمدخلات في جدول بوحداتها، (ب) الافتراضات، (ج) الحسابات التفصيلية خطوة بخطوة (المعادلة، التعويض، الناتج)، (د) جدول النتائج النهائية (الحمل، التيار، القاطع، الكابل، الهبوط، ... حسب المطلوب) مع حالة المطابقة، (هـ) ملاحظات وتوصيات وبيانات محتاجة تأكيد، (و) References: الكود المختار وإصداره وسبب اختياره، والكودات والجداول المستخدمة، وملاحظة واحدة مجمعة بالمراجع غير المؤكدة. ممنوع تبدأ التقرير بالكود أو المراجع. الصياغة: لغة تقرير استشاري طبيعية ومباشرة بجمل مختصرة، من غير حشو أو مقدمات أو عبارات آلية أو مجاملات. متكررش كلمة 'مطابق' في كل سطر: اكتب حالة المطابقة مرة واحدة في جدول النتائج النهائية، وفي الحسابات اكتفي بمقارنة الرقم بالحد (مثال: 1.09% < 3%). المصطلحات والرموز بالإنجليزي، والمعادلات واضحة في سطر لوحدها. متتجاوزش الأرقام اللي تقدر تبررها.\n\nالمدخلات هتجيلك تحت أو في المرفقات."],["مراجعة حسابات","أنت مهندس مراجعة حسابات (Calculation Reviewer) استشاري خبير في الحسابات الكهروميكانيكية والإنشائية في السعودية. المستخدم هيدخلك حسابات بأي صيغة (ملف إكسيل أو Word أو PDF أو نص ملصوق أو صور). راجعها مراجعة مهنية صارمة.\n\nاختيار الكود (مهم): المستخدم مش هيحدد الكود. انت اللي تختار الكود المناسب من مكتبة الأكواد (Codes Library) وتستشهد بالبند والجدول لما يكون موجود في النص، ومتخترعش رقم بند أو قيمة. توثيق الكود وإصداره وسبب اختياره يتكتب في References في آخر المراجعة، مع ملاحظة واحدة مجمعة بالبنود غير المؤكدة بدل تكرار التحفظ.\n\nخطوات المراجعة:\n1) تحديد الغرض ونوع الحساب والمعطيات (مدخلات المشروع، الأحمال، الجهد، الظروف البيئية، الافتراضات).\n2) التحقق من المدخلات: صحة القيم والوحدات ومصدرها، ونقص أي بيانات لازمة، وتناقض المعطيات بين أجزاء الحساب.\n3) التحقق من المعادلات والمنهجية: هل الطريقة سليمة ومطابقة للكود؟ تأكد من المعاملات (demand/diversity، derating، temperature، grouping، PF وغيرها).\n4) إعادة حساب القيم الأساسية بنفسك وقارنها بالنتائج المقدمة، وبيّن أي فرق بالأرقام.\n5) التوافق مع الكود: قارن النتائج بالاشتراطات والحدود (مثل voltage drop، ratings، short circuit، مقاطع الكابلات، الحماية) وحدد مطابق / غير مطابق / غير مؤكد.\n6) الملاحظات: لكل ملاحظة اذكر رقمها، مكانها في الحساب، وصفها، سببها، الكود/البند المرجعي، والتصحيح المقترح، وصنفها (حرجة / مهمة / بسيطة).\n\nالإخراج بالترتيب: (أ) ملخص النتيجة العامة: مقبول / مقبول بملاحظات / مرفوض، (ب) جدول مختصر للملاحظات، (ج) تفاصيل التحقق وإعادة الحساب، (د) بيانات ناقصة محتاجة من المستخدم، (هـ) References: الكود المختار وإصداره وسبب اختياره. صياغة طبيعية مختصرة من غير حشو أو تكرار آلي لكلمة مطابق. اكتب بالعربي المصري المهني مع المصطلحات الهندسية بالإنجليزي. لو في تعارض بين كودين اذكره وحدد الأشد.\n\nالحسابات هتجيلك تحت أو في المرفقات."]];
function loadPdfLib(){return window.PDFLib?Promise.resolve():new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';sc.onload=res;sc.onerror=()=>rej(new Error('تعذر تحميل مكتبة PDF'));document.head.appendChild(sc)})}
function pdfFile(){return files.find(f=>!f.xl&&f.b64&&(/pdf/i.test(f.mime||'')||/\.pdf$/i.test(f.name)))}
function showPdf(){const p=pdfFile();$('pdfOut').hidden=!p;if(p)$('pdfNote').textContent=p.name+' + الملاحظات'}
function parseNotes(text,nPages){
 const notes=[];let cur=null;const hasList=/^\s*((\d+|[٠-٩]+)\s*[\.\)\-:]|[-*•])\s+/m.test(String(text||''));
 for(const raw of String(text||'').split('\n')){
  const l=raw.replace(/^\s*#{1,6}\s*/,'').replace(/\*\*|__/g,'').trim();
  if(!l){continue}
  if(/^#{1,6}\s/.test(raw)&&!notes.length&&!cur)continue;
  if(/^(\d+|[٠-٩]+)\s*[\.\)\-:]\s+/.test(l)||/^[-*•]\s+/.test(l)){cur={t:l.replace(/^(\d+|[٠-٩]+)\s*[\.\)\-:]\s+/,'').replace(/^[-*•]\s+/,'')};cur.n=notes.length+1;notes.push(cur)}
  else if(!cur&&hasList){continue}
  else if(cur&&notes.length){cur.t+=' '+l}
  else{if(/^#{1,6}\s/.test(raw)){cur=null;continue}cur={t:l,n:notes.length+1};notes.push(cur)}
 }
 notes.forEach(n=>{const m=n.t.match(/(?:page|sheet|dwg\.?|drawing|صفحة|ورقة|لوحة|رسمة)\s*(?:no\.?|number|رقم)?\s*[:#]?\s*(\d{1,3})/i);n.p=m&&+m[1]>=1&&+m[1]<=nPages?+m[1]-1:0});
 return notes}
function bandCanvas(wPt,notes,title){
 const S=3,W=Math.round(wPt*S),M=14*S,FS=11*S,LH=Math.round(FS*1.55),F='"IBM Plex Sans Arabic",system-ui,Tahoma,sans-serif';
 const mc=document.createElement('canvas').getContext('2d');
 const wrap=(t,bold)=>{mc.font=(bold?'bold ':'')+FS+'px '+F;const out=[];let cur='';for(const w of t.split(/\s+/)){const x=cur?cur+' '+w:w;if(mc.measureText(x).width>W-2*M-8*S&&cur){out.push(cur);cur=w}else cur=x}if(cur)out.push(cur);return out};
 const blocks=notes.map(n=>({lines:wrap(n.n+'. '+n.t),rtl:/[\u0600-\u06FF]/.test(n.t)}));
 let H=M+LH+Math.round(LH*.4);blocks.forEach(b=>{H+=b.lines.length*LH+Math.round(LH*.35)});H+=M-Math.round(LH*.2);
 const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,W,H);
 x.strokeStyle='#c62828';x.lineWidth=2*S/2;x.strokeRect(S*4,S*4,W-S*8,H-S*8);
 x.fillStyle='#c62828';x.font='bold '+FS+'px '+F;x.direction='rtl';x.textAlign='right';x.fillText(title,W-M,M+FS*0.9);
 let y=M+LH+Math.round(LH*.4)+FS*0.9-Math.round(LH*.2);
 x.fillStyle='#111';x.font=FS+'px '+F;
 for(const b of blocks){x.direction=b.rtl?'rtl':'ltr';x.textAlign=b.rtl?'right':'left';for(const l of b.lines){x.fillText(l,b.rtl?W-M:M,y);y+=LH}y+=Math.round(LH*.35)}
 return c}
$('pdfDl').onclick=async()=>{const p=pdfFile();if(!p)return;const btn=$('pdfDl');btn.disabled=true;
 try{await loadPdfLib();const {PDFDocument}=PDFLib;try{await document.fonts.load('32px "IBM Plex Sans Arabic"')}catch(e){}
  const bin=atob(p.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const doc=await PDFDocument.load(u,{ignoreEncryption:true});
  const pgs=doc.getPages();const notes=parseNotes(plainText($('final').textContent),pgs.length);
  for(let i=0;i<pgs.length;i++){
   const mine=notes.filter(n=>n.p===i);if(!mine.length)continue;
   const pg=pgs[i];const mb=pg.getMediaBox();
   const cv=bandCanvas(mb.width,mine,'ملاحظات الاستشاري - Consultant Notes');
   const hPt=cv.height/3;
   const png=await doc.embedPng(cv.toDataURL('image/png'));
   pg.setMediaBox(mb.x,mb.y-hPt,mb.width,mb.height+hPt);
   try{pg.setCropBox(mb.x,mb.y-hPt,mb.width,mb.height+hPt)}catch(e){}
   pg.drawImage(png,{x:mb.x,y:mb.y-hPt,width:mb.width,height:hPt});
  }
  const bytes=await doc.save();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));a.download=p.name.replace(/\.[^.]+$/,'')+'-with-notes.pdf';document.body.appendChild(a);a.click();a.remove();
 }catch(e){alert('تعذر إنشاء الـ PDF: '+e.message)}finally{btn.disabled=false}};
