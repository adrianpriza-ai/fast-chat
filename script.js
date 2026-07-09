// ── Constants ──
const MAX_INPUT    = 8000;
const MAX_SESSIONS = 50;
const LS_SESSIONS  = 'fc_s';
const LS_CURRENT   = 'fc_cur';
const LS_PROVIDER  = 'fc_provider';
const LS_GMODEL    = 'fc_gmodel';
const LS_ORMODEL   = 'fc_ormodel';
const LS_GEMINI_MODEL  = 'fc_gemmodel';
const LS_OLLAMA_MODEL  = 'fc_olmodel';
const LS_OLLAMA_URL    = 'fc_olurl';
const LS_THEME     = 'fc_theme';
const LS_ACCENT    = 'fc_accent';
const LS_GKEY      = 'fc_gkey';
const LS_ORKEY     = 'fc_orkey';
const LS_GEMKEY    = 'fc_gemkey';
const SS_GKEY      = 'fc_gkey_ss';
const SS_ORKEY     = 'fc_orkey_ss';
const SS_GEMKEY    = 'fc_gemkey_ss';
const LS_SYSPROMPT = 'fc_sys';

const GROQ_MODELS = [
  { id:'llama-3.1-8b-instant',                           label:'Llama 3.1 8B' },
  { id:'llama-3.3-70b-versatile',  						 label:'Llama 3.3 70B' },
  { id:'meta-llama/llama-4-scout-17b-16e-instruct',      label:'Llama 4 Scout 17B 16E' },
  { id:'openai/gpt-oss-120b',                            label:'GPT OSS 120B' },
  { id:'openai/gpt-oss-20b',                             label:'GPT OSS 20B' },
  { id:'qwen/qwen3-32b',                                 label:'Qwen3 32B' },
  { id:'qwen/qwen3.6-27b',                               label:'Qwen3.6 27B' },
  { id:'groq/compound',                                  label:'Compound' },
  { id:'groq/compound-mini',                             label:'Compound Mini' },
];
const OR_MODELS = [
  { id:'google/gemma-4-26b-a4b-it:free',                 label:'Gemma 4.0 26B A4B (Free)' },
  { id:'google/gemma-4-31b-it:free',                     label:'Gemma 4.0 31B (Free)' },
  { id:'meta-llama/llama-3.3-70b-instruct:free',         label:'Llama 3.3 70B (Free)' },
  { id:'meta-llama/llama-3.2-3b-instruct:free',          label:'Llama 3.2 3B (Free)' },
  { id:'deepseek/deepseek-v4-flash:free',                label:'DeepSeek V4 Flash (Free)' },
  { id:'qwen/qwen3-next-80b-a3b-instruct:free',          label:'Qwen Next 80B A3B (Free)' },
  { id:'liquid/lfm-2.5-1.2b-instruct:free',              label:'LFM 2.5 1.2B (Free)' },
  { id:'nvidia/nemotron-3-nano-30b-a3b:free',            label:'Nemotron 3 Nano 30B A3B (Free)' },
  { id:'openai/gpt-4o-mini-2024-07-18',                  label:'GPT-4o Mini (2024-07-18)' },
  { id:'google/gemini-2.5-flash',                        label:'Gemini 2.5 Flash' },
  { id:'custom',                                         label:'Custom model...' },
];
const GEMINI_MODELS = [
  { id:'gemini-3.5-flash',  			  label:'Gemini 3.5 Flash' },
  { id:'gemini-3.1-pro-preview',    	  label:'Gemini 3.1 Pro Preview' },
  { id:'gemini-3.1-flash-lite',           label:'Gemini 3.1 Flash Lite' },
  { id:'gemini-3-flash-preview',          label:'Gemini 3.0 Flash Preview' },
  { id:'gemini-2.5-pro',                  label:'Gemini 2.5 Pro' },
  { id:'gemini-2.5-flash',                label:'Gemini 2.5 Flash' },
  { id:'gemini-2.5-flash-lite',           label:'Gemini 2.5 Flash Lite' },
  { id:'gemma-4-31b-it',                  label:'Gemma 4 31B' },
  { id:'gemma-4-26b-a4b-it',              label:'Gemma 4 26b A4B' },
];

// ── DOM refs ──
const chatEl       = document.getElementById('chat');
const chatInner    = document.getElementById('chatInner');
const welcome      = document.getElementById('welcome');
const userInput    = document.getElementById('userInput');
const sendBtn      = document.getElementById('sendBtn');
const statusText   = document.getElementById('statusText');
const charCounter  = document.getElementById('charCounter');
const sessionsList = document.getElementById('sessionsList');
const sidebar      = document.getElementById('sidebar');
const overlay      = document.getElementById('overlay');
const settingsModal= document.getElementById('settingsModal');
const fileInput    = document.getElementById('fileInput');
const imgPreviewStrip = document.getElementById('imgPreviewStrip');
const imgPreviewEl = document.getElementById('imgPreviewEl');

let sessions = {}, currentId = null, isLoading = false;
let pendingImage = null;
let cbId = 0, thinkIdx = 0;

// ── XSS helpers ──
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function sanitizeKey(k){return k.replace(/[^\x21-\x7E]/g,'').slice(0,500);}

// ── Think extraction ──
function extractThink(raw){
  const thinks=[];
  const cleaned=raw.replace(/<think>([\s\S]*?)<\/think>/gi,(_,inner)=>{thinks.push(inner.trim());return '';});
  const partial=cleaned.replace(/<think>[\s\S]*/i,'');
  return {thinks,content:partial.trim()};
}

// ── Markdown renderer ──
function md(raw){
  const {thinks,content}=extractThink(raw);
  let thinkHtml='';
  thinks.forEach(t=>{
    const id='th'+(++thinkIdx);
    thinkHtml+=`<div class="think-block"><button class="think-toggle" onclick="toggleThink('${id}')"><span class="think-arrow" id="arr_${id}">&#9654;</span> Thinking</button><div class="think-body" id="${id}">${escHtml(t)}</div></div>`;
  });

  const CB=[],CI=[];
  let s=content;

  // Stash math blocks $$...$$
  s=s.replace(/\$\$([\s\S]+?)\$\$/g,(_,m)=>{CB.push({type:'mathblock',val:m});return`\x00MB${CB.length-1}\x00`;});
  // Stash fenced code
  s=s.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
    const id='cb'+(++cbId);
    CB.push({type:'code',lang:(lang||'').toLowerCase(),val:code.trim(),id});
    return`\x00MB${CB.length-1}\x00`;
  });
  // Stash inline math $...$
  s=s.replace(/\$([^$\n]+?)\$/g,(_,m)=>{CI.push({type:'mathinline',val:m});return`\x00MI${CI.length-1}\x00`;});
  // Stash inline code
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>{CI.push({type:'code',val:c});return`\x00MI${CI.length-1}\x00`;});

  // Escape HTML
  s=escHtml(s);

  // Tables
  s=s.replace(/((?:[^\n]+\|[^\n]*\n)+)/g,block=>{
    const rows=block.trim().split('\n');
    if(rows.length<2)return block;
    const isSep=r=>/^[\s|:\-]+$/.test(r);
    let html='<table>';let inBody=false;
    rows.forEach((row,ri)=>{
      if(isSep(row)){inBody=true;return;}
      const cells=row.split('|').map(c=>c.trim()).filter((c,i,a)=>(i>0||c)||a.length>1);
      const trimmed=cells.filter((c,i)=>!(i===0&&c==='')&&!(i===cells.length-1&&c===''));
      const tag=(!inBody&&ri===0)?'th':'td';
      html+='<tr>'+trimmed.map(c=>`<${tag}>${c}</${tag}>`).join('')+'</tr>';
    });
    return html+'</table>';
  });

  // HR
  s=s.replace(/^---+$/gm,'<hr>');

  // Headings
  s=s.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  s=s.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  s=s.replace(/^# (.+)$/gm,'<h1>$1</h1>');

  // Ordered list items
  s=s.replace(/^\d+\. (.+)$/gm,'<li data-ol>$1</li>');
  // Unordered list items
  s=s.replace(/^[-*] (.+)$/gm,'<li>$1</li>');
  // Wrap consecutive <li> in ul/ol
  s=s.replace(/((?:<li(?:[^>]*)>[\s\S]*?<\/li>\n?)+)/g,block=>{
    const isOl=block.includes('data-ol');
    const cleaned=block.replace(/ data-ol/g,'');
    return isOl?`<ol>${cleaned}</ol>`:`<ul>${cleaned}</ul>`;
  });

  // Blockquote
  s=s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');

  // Inline styles
  s=s.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  s=s.replace(/~~(.+?)~~/g,'<del>$1</del>');
  s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Newlines → <br>
  s=s.replace(/\n/g,'<br>');
  // Clean extra <br> around block elements
  s=s.replace(/<br>(<(?:h[1-6]|ul|ol|table|blockquote|hr|div))/g,'$1');
  s=s.replace(/(<\/(?:h[1-6]|ul|ol|table|blockquote|div)>)<br>/g,'$1');

  // Restore code blocks
  s=s.replace(/\x00MB(\d+)\x00/g,(_,idx)=>{
    const item=CB[idx];
    if(item.type==='mathblock') return`<div class="katex-block" data-math="${escHtml(item.val)}"></div>`;
    const lang=item.lang||'plaintext';
    return`<div class="code-block-wrap"><div class="code-header"><span class="code-lang">${lang}</span><button class="copy-btn" data-target="${item.id}">Copy</button></div><pre id="${item.id}"><code class="language-${lang}" data-code="${encodeURIComponent(item.val)}">${escHtml(item.val)}</code></pre></div>`;
  });
  // Restore inline
  s=s.replace(/\x00MI(\d+)\x00/g,(_,idx)=>{
    const item=CI[idx];
    if(item.type==='mathinline') return`<span class="katex-inline" data-math="${escHtml(item.val)}"></span>`;
    return`<code>${escHtml(item.val)}</code>`;
  });

  return thinkHtml+s;
}

// ── Post-process: Prism highlight + KaTeX ──
function postProcess(el){
  el.querySelectorAll('code[data-code]').forEach(code=>{
    code.textContent=decodeURIComponent(code.dataset.code);
    if(typeof Prism!=='undefined') Prism.highlightElement(code);
    else setTimeout(()=>{if(typeof Prism!=='undefined')Prism.highlightElement(code);},600);
  });
  if(typeof katex==='undefined'){setTimeout(()=>postProcess(el),300);return;}
  el.querySelectorAll('.katex-block[data-math]').forEach(node=>{
    try{katex.render(node.dataset.math,node,{displayMode:true,throwOnError:false});}
    catch(e){node.textContent=node.dataset.math;}
  });
  el.querySelectorAll('.katex-inline[data-math]').forEach(node=>{
    try{katex.render(node.dataset.math,node,{displayMode:false,throwOnError:false});}
    catch(e){node.textContent=node.dataset.math;}
  });
}

// ── Prism autoloader path ──
document.addEventListener('DOMContentLoaded',()=>{
  if(typeof Prism!=='undefined'&&Prism.plugins&&Prism.plugins.autoloader){
    Prism.plugins.autoloader.languages_path='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
  }
});

// Copy code button (event delegation)
document.addEventListener('click',e=>{
  const btn=e.target.closest('.copy-btn');
  if(!btn)return;
  const pre=document.getElementById(btn.dataset.target);
  if(!pre)return;
  const code=pre.querySelector('code');
  const text=code?code.textContent:pre.textContent;
  navigator.clipboard.writeText(text).then(()=>{
    btn.textContent='✓ Copied';
    setTimeout(()=>btn.textContent='Copy',2000);
  }).catch(()=>{btn.textContent='Error';});
});

// ── Think toggle ──
function toggleThink(id){
  document.getElementById(id)?.classList.toggle('open');
  document.getElementById('arr_'+id)?.classList.toggle('open');
}

// ── Provider / Model ──
function getProvider(){ return localStorage.getItem(LS_PROVIDER)||'groq'; }
function getModel(){
  const p=getProvider();
  if(p==='groq')   return localStorage.getItem(LS_GMODEL)||GROQ_MODELS[0].id;
  if(p==='gemini') return localStorage.getItem(LS_GEMINI_MODEL)||GEMINI_MODELS[0].id;
  if(p==='ollama') return localStorage.getItem(LS_OLLAMA_MODEL)||'';
  // openrouter
  const m=localStorage.getItem(LS_ORMODEL)||OR_MODELS[0].id;
  return m==='custom'?'':m;
}
function getModelLabel(){
  const p=getProvider(); const m=getModel();
  if(p==='groq')   return GROQ_MODELS.find(x=>x.id===m)?.label||m||'—';
  if(p==='gemini') return GEMINI_MODELS.find(x=>x.id===m)?.label||m||'—';
  if(p==='ollama') return m||'Ollama';
  return OR_MODELS.find(x=>x.id===m)?.label||m.split('/').pop()||'—';
}
function getOllamaUrl(){ return (localStorage.getItem(LS_OLLAMA_URL)||'http://localhost:11434').replace(/\/+$/,''); }

// ── API Keys ──
function getKey(p){
  p=p||getProvider();
  if(p==='groq')   return localStorage.getItem(LS_GKEY)||sessionStorage.getItem(SS_GKEY)||null;
  if(p==='gemini') return localStorage.getItem(LS_GEMKEY)||sessionStorage.getItem(SS_GEMKEY)||null;
  if(p==='ollama') return 'ollama'; // no key needed, return dummy truthy
  return localStorage.getItem(LS_ORKEY)||sessionStorage.getItem(SS_ORKEY)||null;
}
function saveKey(p,val,remember){
  const clean=sanitizeKey(val);
  if(p==='groq'){
    if(remember){localStorage.setItem(LS_GKEY,clean);sessionStorage.removeItem(SS_GKEY);}
    else{sessionStorage.setItem(SS_GKEY,clean);localStorage.removeItem(LS_GKEY);}
  } else if(p==='gemini'){
    if(remember){localStorage.setItem(LS_GEMKEY,clean);sessionStorage.removeItem(SS_GEMKEY);}
    else{sessionStorage.setItem(SS_GEMKEY,clean);localStorage.removeItem(LS_GEMKEY);}
  } else {
    if(remember){localStorage.setItem(LS_ORKEY,clean);sessionStorage.removeItem(SS_ORKEY);}
    else{sessionStorage.setItem(SS_ORKEY,clean);localStorage.removeItem(LS_ORKEY);}
  }
}
function isKeyRemembered(p){
  if(p==='groq')   return !!localStorage.getItem(LS_GKEY);
  if(p==='gemini') return !!localStorage.getItem(LS_GEMKEY);
  return !!localStorage.getItem(LS_ORKEY);
}

// ── System prompt ──
function getSysPrompt(){ return localStorage.getItem(LS_SYSPROMPT)||''; }

// ── Ollama: fetch available models ──
async function fetchOllamaModels(){
  const url=document.getElementById('ollamaUrlInput').value.trim()||'http://localhost:11434';
  const btn=document.getElementById('ollamaFetchBtn');
  btn.textContent='Fetching…'; btn.disabled=true;
  try{
    const res=await fetch(url.replace(/\/+$/,'')+'/api/tags');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    const models=(data.models||[]).map(m=>m.name||m.model||m);
    const sel=document.getElementById('ollamaModelSelect');
    sel.innerHTML='';
    models.forEach(m=>{
      const opt=document.createElement('option');opt.value=m;opt.textContent=m;sel.appendChild(opt);
    });
    // Restore saved selection
    const saved=localStorage.getItem(LS_OLLAMA_MODEL);
    if(saved&&models.includes(saved)) sel.value=saved;
    else if(models.length){ localStorage.setItem(LS_OLLAMA_MODEL,models[0]); sel.value=models[0]; }
    sel.style.display='block';
    document.getElementById('ollamaModelInput').style.display='none';
    localStorage.setItem(LS_OLLAMA_URL,url.replace(/\/+$/,''));
    updateTopbar();
    setStatus('Found '+models.length+' models',true);
    // Listen for changes
    sel.onchange=e=>{
      localStorage.setItem(LS_OLLAMA_MODEL,e.target.value);
      updateTopbar();
    };
  }catch(e){
    setStatus('Ollama error: '+e.message,false,true);
    document.getElementById('ollamaModelSelect').style.display='none';
    document.getElementById('ollamaModelInput').style.display='block';
  }finally{
    btn.textContent='Fetch models'; btn.disabled=false;
  }
}

// ── Init ──
function init(){
  window.addEventListener('load',()=>{
    if(typeof Prism!=='undefined'&&Prism.plugins?.autoloader)
      Prism.plugins.autoloader.languages_path='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
  });

  const saved=localStorage.getItem(LS_SESSIONS);
  sessions=saved?JSON.parse(saved):{};
  // Always start at fresh new-chat state — never resume last session
  currentId=null;
  applyTheme(localStorage.getItem(LS_THEME)||'auto',false);
  applyAccent(localStorage.getItem(LS_ACCENT)||'#4da8da',false);
  renderSidebar(); renderChat(); updateTopbar();
  const p=getProvider();
  if(p!=='ollama'&&!getKey()) openSettings('apikeys');
}

// ── Sessions ──
function newSession(focus=true){
  // Don't create a session object yet — only created when user sends first message
  currentId=null;
  renderSidebar(); renderChat();
  if(focus){ closeSidebar(); userInput.focus(); }
}
function switchSession(id){currentId=id;saveSessions();renderSidebar();renderChat();closeSidebar();}
function deleteSessionById(id){
  delete sessions[id]; saveSessions();
  if(currentId===id){
    // Go to fresh new-chat state instead of jumping to another session
    currentId=null;
  }
  renderSidebar(); renderChat();
}
function deleteSession(id,e){ e.stopPropagation(); deleteSessionById(id); }
function saveSessions(){
  try{localStorage.setItem(LS_SESSIONS,JSON.stringify(sessions));}
  catch(e){
    const stripped=JSON.parse(JSON.stringify(sessions));
    Object.values(stripped).forEach(s=>s.msgs.forEach(m=>delete m.image));
    try{localStorage.setItem(LS_SESSIONS,JSON.stringify(stripped));}catch(_){}
  }
  // currentId is intentionally NOT persisted — always start fresh on reload
}
function setTitle(id,text){
  const safe=text.slice(0,40);
  sessions[id].title=safe.length<text.length?safe+'…':safe;
  saveSessions(); renderSidebar();
}

function renameSession(id){
  const items=sessionsList.querySelectorAll('.session-item');
  items.forEach(el=>{
    const idAttr=el.dataset.sid;
    if(idAttr!==id) return;
    const nm=el.querySelector('.session-name');
    if(!nm||nm.querySelector('input')) return;
    const oldTitle=sessions[id].title;
    const inp=document.createElement('input');
    inp.type='text'; inp.className='session-rename-input';
    inp.value=oldTitle; inp.maxLength=60;
    nm.textContent=''; nm.appendChild(inp);
    inp.focus(); inp.select();
    const commit=()=>{ const v=inp.value.trim()||oldTitle; setTitle(id,v); };
    inp.addEventListener('blur',commit);
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();inp.blur();}
      if(e.key==='Escape'){inp.value=oldTitle;inp.blur();}
      e.stopPropagation();
    });
    inp.addEventListener('click',e=>e.stopPropagation());
  });
}

function cloneSession(id){
  const src=sessions[id];
  if(!src) return;
  const ids=Object.keys(sessions);
  if(ids.length>=MAX_SESSIONS) delete sessions[ids[0]];
  const newId='s'+Date.now();
  sessions[newId]={title:src.title+' (copy)', msgs:JSON.parse(JSON.stringify(src.msgs))};
  currentId=newId;
  saveSessions(); renderSidebar(); renderChat();
  setStatus('Chat cloned',true);
}
let openCtxId = null;
function closeAllCtx(){ document.querySelectorAll('.session-ctx.open').forEach(m=>m.classList.remove('open')); openCtxId=null; }

function renderSidebar(){
  sessionsList.innerHTML='';
  const count=Object.keys(sessions).length;

  // Near-limit / at-limit notice
  if(count>=MAX_SESSIONS){
    const n=document.createElement('div');
    n.className='sessions-limit-notice';
    n.textContent='Limit reached ('+MAX_SESSIONS+'). Oldest chat removed when new one starts.';
    sessionsList.appendChild(n);
  } else if(count>=MAX_SESSIONS-5){
    const n=document.createElement('div');
    n.className='sessions-limit-notice near';
    n.textContent=(MAX_SESSIONS-count)+' chat slot'+(MAX_SESSIONS-count===1?'':'s')+' remaining before oldest is removed.';
    sessionsList.appendChild(n);
  }

  Object.keys(sessions).reverse().forEach(id=>{
    const el=document.createElement('div');
    el.className='session-item'+(id===currentId?' active':'');
    el.dataset.sid=id;
    el.onclick=()=>switchSession(id);

    const nm=document.createElement('div');nm.className='session-name';nm.textContent=sessions[id].title;

    const menuWrap=document.createElement('div');menuWrap.className='session-menu-wrap';
    const menuBtn=document.createElement('button');menuBtn.className='session-menu-btn';menuBtn.textContent='···';
    menuBtn.setAttribute('aria-label','More');
    menuBtn.onclick=ev=>{
      ev.stopPropagation();
      const ctx=menuWrap.querySelector('.session-ctx');
      const wasOpen=ctx.classList.contains('open');
      closeAllCtx();
      if(!wasOpen){ctx.classList.add('open');openCtxId=id;}
    };

    const ctx=document.createElement('div');ctx.className='session-ctx';

    const btnRename=document.createElement('button');
    btnRename.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Rename';
    btnRename.onclick=ev=>{ev.stopPropagation();renameSession(id);closeAllCtx();};

    const btnClone=document.createElement('button');
    btnClone.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Clone';
    btnClone.onclick=ev=>{ev.stopPropagation();cloneSession(id);closeAllCtx();};

    const btnMd=document.createElement('button');
    btnMd.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Export .md';
    btnMd.onclick=ev=>{ev.stopPropagation();exportChatById(id,'md');closeAllCtx();};

    const btnTxt=document.createElement('button');
    btnTxt.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Export .txt';
    btnTxt.onclick=ev=>{ev.stopPropagation();exportChatById(id,'txt');closeAllCtx();};

    const btnDel=document.createElement('button');btnDel.className='danger';
    btnDel.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Delete';
    btnDel.onclick=ev=>{ev.stopPropagation();deleteSessionById(id);closeAllCtx();};

    ctx.appendChild(btnRename);ctx.appendChild(btnClone);ctx.appendChild(btnMd);ctx.appendChild(btnTxt);ctx.appendChild(btnDel);
    menuWrap.appendChild(menuBtn);menuWrap.appendChild(ctx);
    el.appendChild(nm);el.appendChild(menuWrap);
    sessionsList.appendChild(el);
  });
}

document.addEventListener('click',()=>closeAllCtx());

// ── Render chat ──
function renderChat(){
  chatInner.innerHTML='';
  if(!currentId){ welcome.style.display='flex'; return; }
  const cur=sessions[currentId];
  if(!cur||!cur.msgs.length){welcome.style.display='flex';return;}
  welcome.style.display='none';
  cur.msgs.forEach(m=>addBubble(m.role,m.content,m.image||null));
  scrollDown();
}

function addBubble(role,content,image){
  welcome.style.display='none';
  const wrap=document.createElement('div');wrap.className='msg '+role;
  const av=document.createElement('div');av.className='msg-avatar';av.textContent=role==='user'?'You':'AI';
  const body=document.createElement('div');body.className='msg-body';
  const nm=document.createElement('div');nm.className='msg-name';nm.textContent=role==='user'?'You':'Assistant';
  body.appendChild(nm);

  if(image){
    const img=document.createElement('img');img.className='msg-image';img.src=image;img.alt='attached image';
    body.appendChild(img);
  } else if(role==='user'&&content===''&&!image){
    const ph=document.createElement('div');ph.className='msg-img-missing';ph.textContent='[Image]';
    body.appendChild(ph);
  }

  const ct=document.createElement('div');ct.className='msg-content';
  if(content){
    if(role==='user'){ct.innerHTML=escHtml(content).replace(/\n/g,'<br>');}
    else{ct.innerHTML=md(content);postProcess(ct);}
  }
  body.appendChild(ct);
  wrap.appendChild(av);wrap.appendChild(body);
  chatInner.appendChild(wrap);
  return ct;
}

// ── Update topbar ──
function updateTopbar(){
  const label=getModelLabel();
  document.getElementById('topbarModelName').textContent=label;
  updateProviderLogo();
}

function resolveTheme(){
  const t=document.documentElement.getAttribute('data-theme');
  if(t==='dark')return'dark';if(t==='light')return'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}

function updateProviderLogo(){
  const p=getProvider(), dark=resolveTheme()==='dark';
  document.getElementById('tbGroqLogo').style.display=   (p==='groq')?'':'none';
  document.getElementById('tbOrDark').style.display=     (p==='openrouter'&&dark)?'':'none';
  document.getElementById('tbOrLight').style.display=    (p==='openrouter'&&!dark)?'':'none';
  document.getElementById('tbGeminiLogo').style.display= (p==='gemini')?'':'none';
  document.getElementById('tbOllamaDark').style.display=  (p==='ollama'&&dark)?'':'none';
  document.getElementById('tbOllamaLight').style.display= (p==='ollama'&&!dark)?'':'none';

  // Update theme-sensitive logos in settings
  const orSrc=dark?'openrouter-dark.png':'openrouter-light.png';
  document.querySelectorAll('.or-logo').forEach(img=>img.src=orSrc);
  const olSrc=dark?'ollama-dark.png':'ollama-light.png';
  document.querySelectorAll('.ollama-logo').forEach(img=>img.src=olSrc);
}

// ── Send / Stream ──
async function send(){
  const text=userInput.value.trim();
  const imgToSend=pendingImage;
  if(!text&&!imgToSend||isLoading)return;
  if(text.length>MAX_INPUT){setStatus('Too long',false,true);return;}

  const p=getProvider(), key=getKey(p), model=getModel();

  if(p!=='ollama'&&!key){openSettings('apikeys');setStatus('API key required',false,true);return;}
  if(!model&&p!=='ollama'){setStatus('Select a model',false,true);return;}

  // Create a session now if we're in "new chat" state
  if(!currentId){
    const ids=Object.keys(sessions);
    if(ids.length>=MAX_SESSIONS){
      delete sessions[ids[0]]; // drop oldest to make room
    }
    const id='s'+Date.now();
    sessions[id]={title:'New Chat',msgs:[]};
    currentId=id;
    renderSidebar();
  }

  const cur=sessions[currentId];
  cur.msgs.push({role:'user',content:text,image:imgToSend});
  if(cur.msgs.length===1) setTitle(currentId,text||'[Image]');
  addBubble('user',text,imgToSend);

  pendingImage=null;
  imgPreviewStrip.style.display='none';
  imgPreviewEl.src='';
  userInput.value='';autoResize();updateCounter();saveSessions();scrollDown();

  isLoading=true;sendBtn.disabled=true;setStatus('Generating…');

  // Build streaming bubble
  const wrap=document.createElement('div');wrap.className='msg assistant';
  const av=document.createElement('div');av.className='msg-avatar';av.textContent='AI';
  const body=document.createElement('div');body.className='msg-body';
  const nm=document.createElement('div');nm.className='msg-name';nm.textContent='Assistant';
  const ct=document.createElement('div');ct.className='msg-content streaming-cursor';
  body.appendChild(nm);body.appendChild(ct);
  wrap.appendChild(av);wrap.appendChild(body);
  chatInner.appendChild(wrap);scrollDown();
  welcome.style.display='none';

  // Build messages array
  const sysPrompt=getSysPrompt();
  const apiMsgs=[];
  if(sysPrompt) apiMsgs.push({role:'system',content:sysPrompt});
  cur.msgs.forEach((m,i)=>{
    if(i===cur.msgs.length-1)return;
    if(m.image){
      apiMsgs.push({role:m.role,content:[{type:'image_url',image_url:{url:m.image}},{type:'text',text:m.content||''}]});
    } else {
      apiMsgs.push({role:m.role,content:m.content});
    }
  });
  // Add current user message
  if(imgToSend){
    apiMsgs.push({role:'user',content:[{type:'image_url',image_url:{url:imgToSend}},{type:'text',text:text||''}]});
  } else {
    apiMsgs.push({role:'user',content:text});
  }

  // ── Endpoint & headers per provider ──
  let endpoint, headers;

  if(p==='groq'){
    endpoint='https://api.groq.com/openai/v1/chat/completions';
    headers={'Content-Type':'application/json','Authorization':'Bearer '+key};
  } else if(p==='openrouter'){
    endpoint='https://openrouter.ai/api/v1/chat/completions';
    headers={'Content-Type':'application/json','Authorization':'Bearer '+key,'HTTP-Referer':location.origin||'https://fast-chat.pages.dev','X-Title':'Fast-chat'};
  } else if(p==='gemini'){
    endpoint='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    headers={'Content-Type':'application/json','Authorization':'Bearer '+key};
  } else {
    // Ollama - OpenAI-compatible
    endpoint=getOllamaUrl()+'/v1/chat/completions';
    headers={'Content-Type':'application/json'};
  }

  const finalModel= p==='ollama' ? (localStorage.getItem(LS_OLLAMA_MODEL)||model) : model;

  let full='';
  try{
    const res=await fetch(endpoint,{
      method:'POST',
      headers,
      body:JSON.stringify({model:finalModel,messages:apiMsgs,stream:true,max_tokens:4096})
    });
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
    const reader=res.body.getReader(),dec=new TextDecoder();
    while(true){
      const {done,value}=await reader.read();if(done)break;
      const lines=dec.decode(value,{stream:true}).split('\n').filter(l=>l.startsWith('data: '));
      for(const line of lines){
        const d=line.slice(6);if(d==='[DONE]')continue;
        try{const delta=JSON.parse(d).choices?.[0]?.delta?.content||'';if(delta){full+=delta;ct.innerHTML=md(full);scrollDown();}}catch(_){}
      }
    }
    ct.classList.remove('streaming-cursor');
    ct.innerHTML=md(full);postProcess(ct);
    cur.msgs.push({role:'assistant',content:full});
    saveSessions();setStatus('Done',true);
  }catch(e){
    ct.classList.remove('streaming-cursor');
    ct.innerHTML=md('**Error:** '+escHtml(e.message));
    setStatus(e.message,false,true);
  }finally{
    isLoading=false;sendBtn.disabled=false;userInput.focus();
  }
}

// ── Theme / Accent ──
function setTheme(t){applyTheme(t,true);}
function applyTheme(t,save){
  if(!t||t==='auto'){document.documentElement.removeAttribute('data-theme');}
  else document.documentElement.setAttribute('data-theme',t);
  ['themeAuto','themeDark','themeLight'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.toggle('on',el.dataset.t===(t||'auto'));
  });
  updateProviderLogo();
  if(save)localStorage.setItem(LS_THEME,t||'auto');
}
function applyAccent(c,save){
  document.documentElement.style.setProperty('--accent',c);
  document.querySelectorAll('.ac-dot').forEach(d=>d.classList.toggle('on',d.dataset.c===c));
  const ac=document.getElementById('accentCustom');if(ac)ac.value=c;
  if(save)localStorage.setItem(LS_ACCENT,c);
}
document.getElementById('accentRow').addEventListener('click',e=>{
  const d=e.target.closest('.ac-dot');if(d)applyAccent(d.dataset.c,true);
});
document.getElementById('accentCustom').addEventListener('input',e=>applyAccent(e.target.value,true));

// Listen to system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{
  const t=localStorage.getItem(LS_THEME)||'auto';
  if(t==='auto')updateProviderLogo();
});

// ── Settings tabs ──
function switchSettingsTab(tab){
  document.querySelectorAll('.snav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.stab').forEach(t=>t.classList.toggle('active',t.id==='stab-'+tab));
}
document.querySelectorAll('.snav-item').forEach(btn=>{
  btn.addEventListener('click',()=>switchSettingsTab(btn.dataset.tab));
});

// ── Switch provider ──
function switchProvider(p){
  localStorage.setItem(LS_PROVIDER,p);
  ['provBtnGroq','provBtnOR','provBtnGemini','provBtnOllama'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.remove('on');
  });
  const activeMap={groq:'provBtnGroq',openrouter:'provBtnOR',gemini:'provBtnGemini',ollama:'provBtnOllama'};
  document.getElementById(activeMap[p])?.classList.add('on');
  populateModelSelect(p);
  updateTopbar();
}

function populateModelSelect(p){
  const sel=document.getElementById('settingsModelSelect');
  const customInput=document.getElementById('customModelInput');
  const ollamaSettings=document.getElementById('ollamaSettings');
  const modelSelectRow=document.getElementById('modelSelectRow');

  // Show/hide Ollama settings vs normal model select
  if(p==='ollama'){
    modelSelectRow.style.display='none';
    ollamaSettings.style.display='block';
    // Restore saved URL
    document.getElementById('ollamaUrlInput').value=localStorage.getItem(LS_OLLAMA_URL)||'http://localhost:11434';
    // Restore saved model
    const savedModel=localStorage.getItem(LS_OLLAMA_MODEL)||'';
    document.getElementById('ollamaModelInput').value=savedModel;
    document.getElementById('ollamaModelInput').style.display='block';
    document.getElementById('ollamaModelSelect').style.display='none';
    return;
  }

  modelSelectRow.style.display='block';
  ollamaSettings.style.display='none';
  sel.innerHTML='';

  const models=p==='groq'?GROQ_MODELS:p==='gemini'?GEMINI_MODELS:OR_MODELS;
  const lsKey=p==='groq'?LS_GMODEL:p==='gemini'?LS_GEMINI_MODEL:LS_ORMODEL;
  const saved=localStorage.getItem(lsKey);

  models.forEach(m=>{
    const opt=document.createElement('option');opt.value=m.id;opt.textContent=m.label;
    if(saved&&saved===m.id)opt.selected=true;
    sel.appendChild(opt);
  });
  if(!saved&&models.length)sel.value=models[0].id;

  // Custom OpenRouter model
  if(p==='openrouter'&&saved&&!OR_MODELS.find(m=>m.id===saved)){
    sel.value='custom';customInput.value=saved;customInput.style.display='block';
  } else {
    customInput.style.display='none';
    if(!saved&&p==='openrouter') sel.value=OR_MODELS[0].id;
  }
}

document.getElementById('settingsModelSelect').addEventListener('change',e=>{
  const p=getProvider(),v=e.target.value;
  if(p==='openrouter'&&v==='custom'){
    document.getElementById('customModelInput').style.display='';
  } else {
    document.getElementById('customModelInput').style.display='none';
    const lsKey=p==='groq'?LS_GMODEL:p==='gemini'?LS_GEMINI_MODEL:LS_ORMODEL;
    localStorage.setItem(lsKey,v);
    updateTopbar();
  }
});
document.getElementById('customModelInput').addEventListener('input',e=>{
  localStorage.setItem(LS_ORMODEL,e.target.value);updateTopbar();
});
document.getElementById('ollamaModelInput').addEventListener('input',e=>{
  localStorage.setItem(LS_OLLAMA_MODEL,e.target.value);updateTopbar();
});
document.getElementById('ollamaFetchBtn').addEventListener('click',fetchOllamaModels);

// ── Settings modal ──
function openSettings(tab){
  tab=tab||'general';
  switchSettingsTab(tab);
  const p=getProvider();
  ['provBtnGroq','provBtnOR','provBtnGemini','provBtnOllama'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.remove('on');
  });
  const activeMap={groq:'provBtnGroq',openrouter:'provBtnOR',gemini:'provBtnGemini',ollama:'provBtnOllama'};
  document.getElementById(activeMap[p])?.classList.add('on');
  populateModelSelect(p);
  // Keys
  const gkey=getKey('groq'), okey=getKey('openrouter'), gemkey=getKey('gemini');
  document.getElementById('groqKeyInput').value='';
  document.getElementById('orKeyInput').value='';
  document.getElementById('geminiKeyInput').value='';
  document.getElementById('rememberGroqKey').checked=isKeyRemembered('groq');
  document.getElementById('rememberOrKey').checked=isKeyRemembered('openrouter');
  document.getElementById('rememberGeminiKey').checked=isKeyRemembered('gemini');
  updateKeyStatus('groq',gkey);
  updateKeyStatus('openrouter',okey);
  updateKeyStatus('gemini',gemkey);
  // System prompt
  document.getElementById('sysPromptInput').value=getSysPrompt();
  // Theme cards
  const t=localStorage.getItem(LS_THEME)||'auto';
  ['themeAuto','themeDark','themeLight'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.classList.toggle('on',el.dataset.t===t);
  });
  settingsModal.classList.add('open');
}
function closeSettings(){
  localStorage.setItem(LS_SYSPROMPT,document.getElementById('sysPromptInput').value.trim());
  settingsModal.classList.remove('open');
}
function updateKeyStatus(p,key){
  const idMap={groq:'groqKeyStatus',openrouter:'orKeyStatus',gemini:'geminiKeyStatus'};
  const el=document.getElementById(idMap[p]);
  if(!el)return;
  if(p==='ollama'){el.textContent='No key needed';return;}
  if(key&&p!=='ollama'){el.textContent='✓ Key set ('+(isKeyRemembered(p)?'persisted':'session only')+')';el.className='key-status set';}
  else{el.textContent='No key set';el.className='key-status missing';}
}

document.getElementById('saveGroqKeyBtn').addEventListener('click',()=>{
  const v=document.getElementById('groqKeyInput').value.trim();
  if(!v)return;
  saveKey('groq',v,document.getElementById('rememberGroqKey').checked);
  document.getElementById('groqKeyInput').value='';
  updateKeyStatus('groq',getKey('groq'));
  setStatus('Groq key saved',true);
});
document.getElementById('saveOrKeyBtn').addEventListener('click',()=>{
  const v=document.getElementById('orKeyInput').value.trim();
  if(!v)return;
  saveKey('openrouter',v,document.getElementById('rememberOrKey').checked);
  document.getElementById('orKeyInput').value='';
  updateKeyStatus('openrouter',getKey('openrouter'));
  setStatus('OpenRouter key saved',true);
});
document.getElementById('saveGeminiKeyBtn').addEventListener('click',()=>{
  const v=document.getElementById('geminiKeyInput').value.trim();
  if(!v)return;
  saveKey('gemini',v,document.getElementById('rememberGeminiKey').checked);
  document.getElementById('geminiKeyInput').value='';
  updateKeyStatus('gemini',getKey('gemini'));
  setStatus('Gemini key saved',true);
});

document.getElementById('settingsBtn')?.addEventListener('click',openSettings);
document.getElementById('sidebarSettingsBtn').addEventListener('click',()=>{closeSidebar();openSettings();});
document.getElementById('topbarModelInfo').addEventListener('click',()=>openSettings('model'));
document.getElementById('closeSettingsBtn').addEventListener('click',closeSettings);
settingsModal.addEventListener('click',e=>{if(e.target===settingsModal)closeSettings();});
document.getElementById('sysPromptInput').addEventListener('input',e=>localStorage.setItem(LS_SYSPROMPT,e.target.value.trim()));

// ── Image attachment ──
document.getElementById('attachBtn').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){setStatus('Only images supported',false,true);return;}
  if(file.size>20*1024*1024){setStatus('Image too large (max 20MB)',false,true);return;}
  const reader=new FileReader();
  reader.onload=ev=>{
    pendingImage=ev.target.result;
    imgPreviewEl.src=pendingImage;
    imgPreviewStrip.style.display='flex';
  };
  reader.readAsDataURL(file);
  fileInput.value='';
});
function clearPendingImage(){pendingImage=null;imgPreviewStrip.style.display='none';imgPreviewEl.src='';}

// ── Export ──
function clearAllSessions(){
  if(!confirm('Delete all conversations? This cannot be undone.'))return;
  sessions={};newSession(false);saveSessions();renderSidebar();renderChat();
  setStatus('All chats cleared',true);
}

function exportChatById(id, format){
  const cur=sessions[id];
  if(!cur||!cur.msgs.length){setStatus('Nothing to export',false,true);return;}
  let out='';
  if(format==='md'){
    out=`# ${cur.title}\n\n`;
    cur.msgs.forEach(m=>{out+=`## ${m.role==='user'?'You':'Assistant'}\n\n${m.content||'[image]'}\n\n---\n\n`;});
  } else {
    out=cur.title+'\n'+'='.repeat(Math.min(cur.title.length,60))+'\n\n';
    cur.msgs.forEach(m=>{out+=(m.role==='user'?'You':'Assistant')+':\n'+(m.content||'[image]')+'\n\n';});
  }
  const blob=new Blob([out],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download=cur.title.replace(/[^a-z0-9_\-\s]/gi,'').trim().slice(0,40).replace(/\s+/g,'_')+'.'+format;
  a.click();URL.revokeObjectURL(url);
  setStatus('Exported',true);
}

function exportChat(format){ exportChatById(currentId, format); }

// ── Sidebar / overlay ──
function closeSidebar(){
  if(window.innerWidth<=640){sidebar.classList.remove('mobile-open');overlay.classList.remove('show');}
}
document.getElementById('sidebarToggle').addEventListener('click',()=>{
  if(window.innerWidth<=640){const o=sidebar.classList.toggle('mobile-open');overlay.classList.toggle('show',o);}
  else sidebar.classList.toggle('closed');
});
overlay.addEventListener('click',closeSidebar);
document.getElementById('newChatBtn').addEventListener('click',()=>newSession(true));

// ── Misc ──
function setStatus(msg,ok,err){statusText.textContent=msg;statusText.className='input-meta-text'+(ok?' status-ok':err?' status-err':'');}
function updateCounter(){const l=userInput.value.length;charCounter.textContent=l+' / '+MAX_INPUT;charCounter.className='input-counter'+(l>=MAX_INPUT?' over':l>=MAX_INPUT*.85?' warn':'');}
function autoResize(){userInput.style.height='auto';userInput.style.height=Math.min(userInput.scrollHeight,180)+'px';}
function scrollDown(){chatEl.scrollTop=9999999;}

userInput.addEventListener('input',()=>{autoResize();updateCounter();});
userInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
sendBtn.addEventListener('click',send);

// ── Mobile keyboard: keep input visible above soft keyboard ──
(function(){
  const inputArea = document.querySelector('.input-area');
  const chatEl2 = document.getElementById('chat');
  if (!window.visualViewport) return;
  let prevH = window.visualViewport.height;
  function onViewportChange(){
    const vv = window.visualViewport;
    const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    if (keyboardH > 50) {
      inputArea.style.bottom = keyboardH + 'px';
      chatEl2.style.paddingBottom = (keyboardH + 160) + 'px';
      if (vv.height < prevH) scrollDown();
    } else {
      inputArea.style.bottom = '';
      chatEl2.style.paddingBottom = '';
    }
    prevH = vv.height;
  }
  window.visualViewport.addEventListener('resize', onViewportChange);
  window.visualViewport.addEventListener('scroll', onViewportChange);
})();

init();
