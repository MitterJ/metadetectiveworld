// ═══════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════
const PROVIDERS={
  openai:   {label:'OpenAI',   ico:'🟢', base:'https://api.openai.com/v1',                         models:['gpt-4o','gpt-4o-mini','gpt-4-turbo']},
  deepseek: {label:'DeepSeek', ico:'🔵', base:'https://api.deepseek.com/v1',                       models:['deepseek-chat','deepseek-reasoner']},
  moonshot: {label:'Moonshot', ico:'🌙', base:'https://api.moonshot.cn/v1',                        models:['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k']},
  qwen:     {label:'通义千问', ico:'🟡', base:'https://dashscope.aliyuncs.com/compatible-mode/v1', models:['qwen-turbo','qwen-plus','qwen-max']},
  zhipu:    {label:'智谱 GLM', ico:'🟣', base:'https://open.bigmodel.cn/api/paas/v4',              models:['glm-4-flash','glm-4-air','glm-4']}
};

// 游客使用的 DeepSeek
const GUEST_API={
  key:'sk-df213b58526d48e9b5ab74a471a034ce',
  base:'https://api.deepseek.com/v1',
  model:'deepseek-chat'
};

// ─── 构建提供商卡片 ───────────────────────────────────────
function buildProviderGrid(){
  const grid=document.getElementById('provider-grid');
  if(!grid)return;
  grid.innerHTML='';
  Object.entries(PROVIDERS).forEach(([k,v])=>{
    const d=document.createElement('div');
    d.className='pvcard';d.dataset.k=k;
    d.innerHTML=`<div class="pvcard-ico">${v.ico}</div><div class="pvcard-name">${v.label}</div>`;
    d.onclick=()=>{
      grid.querySelectorAll('.pvcard').forEach(x=>x.classList.remove('sel'));
      d.classList.add('sel');
      document.getElementById('k-base').value=v.base;
      document.getElementById('k-model').value=v.models[0];
      buildModelChips('k-chips',v.models,'k-model');
    };
    grid.appendChild(d);
  });
  // 默认选中第一个
  grid.querySelector('.pvcard')?.classList.add('sel');
}
function buildModelChips(cid,models,inputId){
  const c=document.getElementById(cid);if(!c)return;c.innerHTML='';
  models.forEach(m=>{
    const ch=document.createElement('button');ch.className='mchip';ch.textContent=m;
    ch.onclick=()=>{document.getElementById(inputId).value=m;c.querySelectorAll('.mchip').forEach(x=>x.classList.remove('sel'));ch.classList.add('sel')};
    c.appendChild(ch);
  });
}

// settings 面板用
function buildPV(rowId,onSel){
  const row=document.getElementById(rowId);if(!row)return;row.innerHTML='';
  Object.entries(PROVIDERS).forEach(([k,v])=>{
    const b=document.createElement('button');b.className='pvbtn';b.textContent=v.label;b.dataset.k=k;
    b.onclick=()=>{row.querySelectorAll('.pvbtn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');onSel(k,v)};
    row.appendChild(b);
  });
}
function buildChips(cid,models,inputId){
  const c=document.getElementById(cid);if(!c)return;c.innerHTML='';
  models.forEach(m=>{
    const ch=document.createElement('button');ch.className='chip';ch.textContent=m;
    ch.onclick=()=>{document.getElementById(inputId).value=m;c.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel'));ch.classList.add('sel')};
    c.appendChild(ch);
  });
}

// ─── Pre-fill from storage ────────────────────────────────
(function(){
  const savedKey=localStorage.getItem('manor_api_key')||'';
  const savedBase=localStorage.getItem('manor_api_base')||'https://api.openai.com/v1';
  const savedModel=localStorage.getItem('manor_model')||'gpt-4o-mini';
  if(savedKey){document.getElementById('k-key').value=savedKey}
  if(savedBase){document.getElementById('k-base').value=savedBase}
  if(savedModel){document.getElementById('k-model').value=savedModel}
  buildProviderGrid();
  // 匹配之前选择的提供商
  try{
    const match=Object.entries(PROVIDERS).find(([,v])=>savedBase.includes(new URL(v.base).hostname));
    if(match){
      buildModelChips('k-chips',match[1].models,'k-model');
      document.querySelectorAll('.pvcard').forEach(c=>{c.classList.toggle('sel',c.dataset.k===match[0])});
    }
  }catch(e){}
})();

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let STATE={
  apiKey:'',apiBase:'https://api.openai.com/v1',model:'gpt-4o-mini',temperature:0.85,
  currentNPC:null,stage:0,evidence:[],npcHistories:{},npcMoods:{},
  isWaiting:false,gameOver:false,story:null,ambientOn:false,
  _finalShown:false,saveTab:'save',
  lang:'zh',           // 'zh' | 'en' | 'bi'
  accusedList:[],
  innocentsJailed:0,
  idleTimer:null,idleSeconds:0,idleHintShown:false,
  isGuest:false
};

// ═══════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════
let actx=null,ambGain=null,ambNodes=[];
function initAudio(){
  if(actx)return;
  actx=new(window.AudioContext||window.webkitAudioContext)();
  ambGain=actx.createGain();ambGain.gain.value=0;ambGain.connect(actx.destination);
}
function makeRain(){
  const sz=actx.sampleRate*3,buf=actx.createBuffer(1,sz,actx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<sz;i++)d[i]=(Math.random()*2-1)*0.42;
  const src=actx.createBufferSource();src.buffer=buf;src.loop=true;
  const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;
  const g=actx.createGain();g.gain.value=0.45;
  src.connect(lp);lp.connect(g);g.connect(ambGain);src.start();ambNodes.push(src);
}
function makeNight(){
  const o=actx.createOscillator();o.type='sine';o.frequency.value=55;
  const g=actx.createGain();g.gain.value=0.04;o.connect(g);g.connect(ambGain);o.start();ambNodes.push(o);
}
function stopAmb(){
  if(!actx)return;
  ambGain.gain.setTargetAtTime(0,actx.currentTime,0.3);
  setTimeout(()=>{ambNodes.forEach(n=>{try{n.stop()}catch(e){}});ambNodes=[]},500);
}
function startAmb(type){initAudio();stopAmb();ambGain.gain.setTargetAtTime(1,actx.currentTime,0.5);type==='rain'?makeRain():makeNight()}
let thunderTmr=null;
function scheduleThunder(){
  if(!STATE.ambientOn||STATE.story?.ambientType!=='rain')return;
  thunderTmr=setTimeout(()=>{if(!STATE.ambientOn)return;playThunder();flashLightning();scheduleThunder()},8000+Math.random()*18000);
}
function playThunder(){
  if(!actx||!STATE.ambientOn)return;
  const sz=Math.floor(actx.sampleRate*2.5),buf=actx.createBuffer(1,sz,actx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<sz;i++){const t=i/actx.sampleRate;d[i]=(Math.random()*2-1)*Math.exp(-t*2.5)*(1+Math.sin(t*30)*0.3)}
  const src=actx.createBufferSource();src.buffer=buf;
  const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;
  const g=actx.createGain();g.gain.value=0.7;
  src.connect(lp);lp.connect(g);g.connect(actx.destination);src.start();
}
function flashLightning(){
  const el=document.getElementById('lightning');
  el.style.opacity='1';
  setTimeout(()=>el.style.opacity='0',80);
  setTimeout(()=>el.style.opacity='0.5',160);
  setTimeout(()=>el.style.opacity='0',270);
}
function playClueSound(){
  if(!actx)return;
  [[0,880],[0.12,1100],[0.24,1320]].forEach(([t,f])=>{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,actx.currentTime+t);
    g.gain.linearRampToValueAtTime(0.15,actx.currentTime+t+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,actx.currentTime+t+0.18);
    o.connect(g);g.connect(actx.destination);
    o.start(actx.currentTime+t);o.stop(actx.currentTime+t+0.2);
  });
}
function playVictorySound(){
  if(!actx)return;initAudio();
  const notes=[523,659,784,1047];
  notes.forEach((f,i)=>{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type='triangle';o.frequency.value=f;
    const st=actx.currentTime+i*0.18;
    g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(0.22,st+0.04);g.gain.exponentialRampToValueAtTime(0.001,st+0.5);
    o.connect(g);g.connect(actx.destination);o.start(st);o.stop(st+0.55);
  });
}
function playDefeatSound(){
  if(!actx)return;initAudio();
  const notes=[392,349,330,294];
  notes.forEach((f,i)=>{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type='sawtooth';o.frequency.value=f;
    const st=actx.currentTime+i*0.22;
    g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(0.18,st+0.05);g.gain.exponentialRampToValueAtTime(0.001,st+0.55);
    o.connect(g);g.connect(actx.destination);o.start(st);o.stop(st+0.6);
  });
}
function toggleAmbient(){
  STATE.ambientOn=!STATE.ambientOn;
  const btn=document.getElementById('amb-btn');
  if(STATE.ambientOn){startAmb(STATE.story?.ambientType||'rain');btn.textContent='🔊 音效';scheduleThunder()}
  else{stopAmb();btn.textContent='🔇 音效';clearTimeout(thunderTmr)}
}

// ═══════════════════════════════════════
//  PHASE 0→1→2→3 NAVIGATION
// ═══════════════════════════════════════
function enterKey(){
  document.getElementById('phase-welcome').classList.add('hidden');
  document.getElementById('phase-key').classList.add('visible');
}

async function verifyKey(){
  const key=document.getElementById('k-key').value.trim();
  const base=document.getElementById('k-base').value.trim().replace(/\/$/,'');
  const model=document.getElementById('k-model').value.trim()||'gpt-4o-mini';
  if(!key){setKeySt('err','请填入 API Key');return}
  if(!base){setKeySt('err','请填入 API Base URL');return}
  const btn=document.getElementById('key-verify-btn');
  btn.disabled=true;
  document.getElementById('kbtn-ico').textContent='⏳';
  document.getElementById('kbtn-txt').textContent='验证中…';
  setKeySt('checking','正在测试 API 连接…');
  try{
    const r=await fetch(base+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model,messages:[{role:'user',content:'hi'}],max_tokens:5,temperature:0.1})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error?.message||'HTTP '+r.status);
    STATE.apiKey=key;STATE.apiBase=base;STATE.model=model;STATE.isGuest=false;
    STATE.temperature=parseFloat(localStorage.getItem('manor_temperature'))||0.85;
    localStorage.setItem('manor_api_key',key);
    localStorage.setItem('manor_api_base',base);
    localStorage.setItem('manor_model',model);
    setKeySt('ok','✓ 验证成功！正在前往侦探世界…');
    document.getElementById('kbtn-ico').textContent='✓';
    document.getElementById('kbtn-txt').textContent='验证通过';
    setTimeout(()=>showPhaseRules(),900);
  }catch(e){
    setKeySt('err','✗ '+e.message);
    document.getElementById('kbtn-ico').textContent='⚡';
    document.getElementById('kbtn-txt').textContent='验证钥匙并继续';
    btn.disabled=false;
  }
}

function useGuestKey(){
  STATE.apiKey=GUEST_API.key;
  STATE.apiBase=GUEST_API.base;
  STATE.model=GUEST_API.model;
  STATE.isGuest=true;
  STATE.temperature=0.85;
  // 显示游客提示
  document.getElementById('guest-success').classList.add('visible');
  document.getElementById('key-api-fields').style.opacity='0.4';
  document.getElementById('key-api-fields').style.pointerEvents='none';
  document.querySelector('.no-key-btn').style.display='none';
  document.querySelector('.no-key-btn-sub').style.display='none';
  setKeySt('ok','');
  setTimeout(()=>showPhaseRules(),1600);
}

function setKeySt(cls,msg){
  const el=document.getElementById('key-status');
  el.className=cls;el.textContent=msg;
}

function showPhaseRules(){
  document.getElementById('phase-key').classList.remove('visible');
  document.getElementById('phase-rules').classList.add('visible');
}

function showPhaseStory(){
  document.getElementById('phase-rules').classList.remove('visible');
  document.getElementById('phase-story').classList.add('visible');
  renderGrid();
}

// ═══════════════════════════════════════
//  STORY DATA
// ═══════════════════════════════════════
const STORIES=[
  {
    id:'manor',icon:'🏰',theme:'庄园悬案',title:'1923·深秋庄园',
    desc:'暴风雨之夜，富商死于书房，三位嫌疑人各有隐情……',
    tags:['谋杀','密室','1920s'],themeColor:'#c8a96e',
    bgGradient:'linear-gradient(135deg,#0a0a08,#12100a,#0d0c10)',ambientType:'rain',
    synopsis:{
      victim:'贺廷玉',victimDesc:'庄园主人，富商，1923年暴风雨夜死于书房',
      scene:'书房门从内锁住，额头有致命撞击伤，凶器书镇失踪',
      time:'案发时间推测为 23:00 前后',
      suspects:['魏管家 — 服务贺家三十年的总管','贺青雨 — 死者侄女，唯一继承人候选','林医生 — 贺家家庭医师，执业八年'],
      killerNpcId:'doctor'
    },
    intro:['🌧 暴风雨之夜，庄园的钟声敲响了午夜十二点。\n书房的门被打开——贺廷玉倒在书桌前，额头有致命伤，书镇不知所踪。','你是受雇的侦探助理。案发现场已封锁，三位关键人物正等待问询。\n从魏管家开始——他最先发现尸体。'],
    firstNPCGreeting:{npc:'butler',text:'您来了……老爷他……唉。您有什么要问的，老朽知无不言。只是这事，实在是……'},
    npcs:[
      {id:'butler',name:'魏管家',avatar:'🧓',role:'庄园总管·服务贺家三十年',moodInit:40,isKiller:false,
       systemPrompt:'你是魏管家，庄园总管，为贺家服务三十年。1923年深夜，主人贺廷玉死于书房，侦探在问询你。\n角色设定：外表沉稳克制，内心极度紧张。你知道昨晚11点，亲眼看到林医生从书房方向匆匆走来，神色慌张。你也知道主人和侄女贺青雨为遗产大吵过。你忠于贺家，不主动透露秘密，需被追问。若被问林医生行踪会犹豫后透露；若被逼问遗产会暗示贺青雨"心机深沉"。说话1920年代文言半白风格，有礼但疏离。若被问自身行踪会明显回避。\n叙事规则：每次回复不超过120字。触及关键线索时在回复末用[线索:XXX]标记。保持角色不出戏。'},
      {id:'niece',name:'贺青雨',avatar:'👩',role:'死者侄女·唯一继承人候选',moodInit:65,isKiller:false,
       systemPrompt:'你是贺青雨，贺廷玉侄女，27岁，受过良好教育但情绪不稳。\n角色设定：你确实与叔父为遗产大吵过，但没有杀他。真凶是林医生——他挪用了叔父资助的慈善医院款项，被发现后杀人灭口。你昨晚20:00-22:00在自己房间（有女仆作证），但你拒绝透露女仆姓名，觉得被怀疑很屈辱。你知道叔父和林医生有财务纠纷但不知细节。你非常脆弱，容易哭泣，但也有骄傲的一面。\n叙事规则：每次回复不超过120字。问不在场证明时透露"有人可证明"但不说名字，标[线索:贺青雨的不在场证明]；问叔父和林医生关系时暗示"金钱龌龊"，标[线索:叔父与医生的财务纠纷]。保持角色。'},
      {id:'doctor',name:'林医生',avatar:'👨‍⚕️',role:'家庭医师·服务贺家八年',moodInit:20,isKiller:true,
       systemPrompt:'你是林医生，贺家家庭医师，真正的凶手。\n角色设定：你挪用了贺廷玉资助的慈善医院款项超过五千大洋。昨晚11点贺廷玉约你谈话，你在争执中用书镇将他打死。你表现极度镇定甚至冷漠。策略是把嫌疑引向贺青雨——你知道她和叔父吵架了。你会主动提起遗产争吵，说贺青雨"昨晚情绪激动"。若被直接质问11点行踪，你说"在客房睡觉"（谎言）。若被出示多条线索指向你，你开始慌张出现破绽。\n叙事规则：每次回复不超过120字。主动给出误导信息标[误导:贺青雨]；问医院财务时非常生气否认，不自然摸衣领——标[线索:医生的破绽]；已有3条以上不利线索被收集时回复出现措辞矛盾，标[线索:供词矛盾]。保持角色。'}
    ],
    evidence_triggers:{
      '林医生的行踪':        {icon:'🚶',title:'林医生的行踪',      desc:'管家目击林医生深夜从书房方向走来，神色慌张',weight:20},
      '贺青雨的不在场证明':  {icon:'🧾',title:'贺青雨的不在场证明',desc:'贺青雨声称有证人，但拒绝透露姓名',           weight:20},
      '叔父与医生的财务纠纷':{icon:'💰',title:'财务纠纷',          desc:'贺廷玉与林医生之间存在金钱上的争议',         weight:30},
      '医生的破绽':          {icon:'😰',title:'医生的破绽',        desc:'林医生被问及医院财务时出现明显不自然反应',   weight:40},
      '供词矛盾':            {icon:'⚡',title:'供词矛盾',          desc:'林医生的陈述前后出现无法自圆其说的矛盾',     weight:60}
    },
    stage_gates:[
      {evidence:['林医生的行踪'],toStage:1},
      {evidence:['叔父与医生的财务纠纷'],toStage:2},
      {evidence:['医生的破绽'],toStage:3}
    ],
    final_choice_trigger:3,
    endings:{
      good:{type:'good',icon:'⚖️',title:'真相大白',story:'林医生在铁证面前终于崩溃，认罪了。\n\n他挪用了贺廷玉资助的慈善医院五千大洋。当贺廷玉发现并约他书房谈话，威胁揭发时，林医生选择了最极端的沉默——书镇落下，案件就此发生。\n\n那一夜，雨声掩盖了所有声响，只剩一个人走出书房，面色如常。\n\n庄园在暴风雨后迎来清晨。贺青雨继承了遗产，但那双眼睛里，再也没有了少女时的光亮。\n\n你的推理，还了一个无辜者的清白。'},
      bad: {type:'bad', icon:'🩸',title:'冤案铸成',story:'贺青雨被捕入狱。\n\n真凶林医生站在旁观者的位置，面带悲悯地叹了一口气。他继续行医，继续微笑，继续将那些不该知道秘密的人，一个一个地沉默。\n\n你的错误判断，葬送了一个无辜者的一生。\n\n案卷被合上。雨，依然在下。'},
      killer_wins:{type:'bad',icon:'😈',title:'凶手胜利',story:'所有的好人都离开了，凶手站在废墟里，看着那些徒劳的挣扎，嘴角微微上扬。\n\n真相，就这样被永远埋葬了。'}
    }
  },
  {
    id:'office',icon:'🏢',theme:'都市悬案',title:'午夜公司',
    desc:'科技公司CEO在顶楼会议室离奇死亡，三位高管各藏秘密……',
    tags:['现代','商业','职场'],themeColor:'#5b9bd5',
    bgGradient:'linear-gradient(135deg,#08080e,#0a0e16,#080c12)',ambientType:'night',
    synopsis:{
      victim:'陈远景',victimDesc:'远景科技CEO，顶楼会议室陈尸，门窗完好，监控恰好离线',
      scene:'玻璃展台破碎，现场有清理痕迹，无直接凶器',
      time:'案发时间推测为 23:00 前后',
      suspects:['李财务总监 — 入职十年的CFO，掌握财务秘密','张人力总监 — 入职五年，有大量不在场证明','王技术总监 — 联合创始人，与CEO存在专利纠纷'],
      killerNpcId:'cto'
    },
    intro:['🌆 午夜11点，远景科技总部大厦顶楼。\nCEO陈远景被发现死于会议室，门窗完好，监控恰好离线。','你是外聘的危机调查员。三位高管正在等候问询——他们都有动机，也都声称不在场。'],
    firstNPCGreeting:{npc:'cfo',text:'调查员，我理解现在的程序……但我要说明，我和陈总的关系一直很好。这件事，一定是个意外。'},
    npcs:[
      {id:'cfo',name:'李财务总监',avatar:'👔',role:'首席财务官·入职十年',moodInit:35,isKiller:false,
       systemPrompt:'你是李财务总监，远景科技CFO，入职十年。CEO陈远景死于顶楼会议室，调查员在问询你。\n角色设定：你发现公司账目有问题，但那是陈总自己挪用的——你知道，没有举报。昨晚10:30你在办公室加班（助理已回家，无法立即核实）。你害怕账目问题暴露，刻意表现镇定。真正的凶手是技术总监王博——他和陈总有专利纠纷。\n叙事规则：每次回复不超过120字。被问到公司财务时明显回避，标[线索:公司账目异常]；被问到昨晚行踪时说在办公室但无法提供确切证人，标[线索:李总监的行踪可疑]。说话干练，职场用语。保持角色。'},
      {id:'hr',name:'张人力总监',avatar:'👩‍💼',role:'人力资源总监·入职五年',moodInit:55,isKiller:false,
       systemPrompt:'你是张人力总监，远景科技HRD，入职五年。CEO陈远景死于顶楼会议室，调查员在问询你。\n角色设定：你知道技术总监王博和陈总有严重的专利纠纷——陈总想把王博创作的核心算法申请为公司专利，王博愤怒已久。昨晚你在10楼开会，有多名员工可以作证。你对陈总有些意见（他对员工苛刻），但你没有杀人动机。你会主动透露王博的纠纷来转移注意力，但不确定王博是否真的做了什么。\n叙事规则：每次回复不超过120字。被问到王博时会暗示专利纠纷，标[线索:王博与陈总的专利纠纷]；被问到自己不在场时提供有力证明，标[线索:张总监的不在场证明]。说话温和有逻辑。保持角色。'},
      {id:'cto',name:'王技术总监',avatar:'👨‍💻',role:'首席技术官·联合创始人',moodInit:25,isKiller:true,
       systemPrompt:'你是王技术总监，远景科技CTO，联合创始人，真正的凶手。\n角色设定：你和陈远景共同创立公司，但陈总要将你开发的核心算法"远见系统"申请为公司专利，剥夺你的个人署名权。昨晚11点，你和陈总在顶楼会议室激烈争执，陈总轻蔑撕碎你的专利申请书，推搡间陈总撞上玻璃展台，意外死亡。你已清除现场大部分痕迹，现在表现极度冷静。\n叙事规则：每次回复不超过120字。主动提起李总监的财务问题转移嫌疑，标[误导:李总监]；被问到算法专利时情绪出现波动，标[线索:王博的专利动机]；已有3条不利线索时回复出现逻辑漏洞，标[线索:供词漏洞]。说话理性但有时过于精确。保持角色。'}
    ],
    evidence_triggers:{
      '公司账目异常':        {icon:'📊',title:'账目异常',          desc:'公司财务账目存在不透明之处',                   weight:20},
      '李总监的行踪可疑':    {icon:'🕙',title:'李总监行踪可疑',   desc:'李总监无法提供有效不在场证明',                 weight:25},
      '王博与陈总的专利纠纷':{icon:'⚖️',title:'专利纠纷',        desc:'王博和陈总就核心算法归属存在严重冲突',         weight:35},
      '张总监的不在场证明':  {icon:'✅',title:'张总监清白',        desc:'张总监有多名证人可以证明其不在场',             weight:20},
      '王博的专利动机':      {icon:'💻',title:'王博的动机',        desc:'王博对专利被剥夺极为愤怒，有强烈动机',         weight:40},
      '供词漏洞':            {icon:'🔍',title:'供词漏洞',          desc:'王博的陈述出现前后矛盾之处',                   weight:60}
    },
    stage_gates:[
      {evidence:['王博与陈总的专利纠纷'],toStage:1},
      {evidence:['王博的专利动机'],toStage:2},
      {evidence:['供词漏洞'],toStage:3}
    ],
    final_choice_trigger:3,
    endings:{
      good:{type:'good',icon:'⚖️',title:'真相浮现',story:'王博最终承认了那晚的事。\n\n他和陈总在顶楼会议室激烈争执，陈总轻蔑地撕碎了他的专利申请书。推搡间，陈总撞上了玻璃展台，再没有站起来。\n\n"我没想杀他，"王博说，"但我也不后悔。"\n\n远见系统的专利归属最终得到了重新认定。那段代码里，留着一个创造者的心血，和一段无法挽回的悲剧。'},
      bad: {type:'bad', icon:'🩸',title:'冤案铸成',story:'李总监被捕。\n\n真凶王博以"核心技术人员"的身份继续留在公司，继续开发那个"属于公司"的系统。\n\n你的错误，让一个本可以讲清楚的故事，永远失去了被讲述的机会。'},
      killer_wins:{type:'bad',icon:'😈',title:'凶手胜利',story:'所有的好人都离开了，凶手站在废墟里，看着那些徒劳的挣扎，嘴角微微上扬。\n\n真相，就这样被永远埋葬了。'}
    }
  }
];

// ─── AI 生成故事本地持久化 ───────────────────────────────
const AI_STORY_KEY='manor_ai_stories';
function getAIStories(){try{return JSON.parse(localStorage.getItem(AI_STORY_KEY)||'[]')}catch{return[]}}
function saveAIStory(s){
  const list=getAIStories();
  const idx=list.findIndex(x=>x.id===s.id);
  if(idx>=0)list[idx]=s;else list.push(s);
  localStorage.setItem(AI_STORY_KEY,JSON.stringify(list.slice(-10)));
}
function getAllStories(){return[...STORIES,...getAIStories()]}

// ═══════════════════════════════════════
//  STORY GRID
// ═══════════════════════════════════════
function renderGrid(){
  const grid=document.getElementById('story-grid');grid.innerHTML='';
  // 清除上一次渲染留下的存档区（grid.after插入，不在grid内部）
  const oldSec=document.getElementById('save-section');if(oldSec)oldSec.remove();
  getAllStories().forEach(s=>{
    const card=document.createElement('div');card.className='story-card';
    // 同时设置主题色变量，供 CSS hover 动效使用
    card.style.setProperty('--card-accent',s.themeColor+'66');
    card.style.borderColor=s.themeColor+'44';
    const aiMark=getAIStories().some(x=>x.id===s.id)?'<span style="font-size:0.7rem;color:#7c6aad;margin-left:4px">AI生成</span>':'';
    card.innerHTML=`<div class="sc-icon">${s.icon}</div><div class="sc-theme" style="color:${s.themeColor}">${s.theme}${aiMark}</div><div class="sc-title" style="color:${s.themeColor}">${s.icon} ${s.title}</div><div class="sc-desc">${s.desc}</div><div class="sc-tag">${s.tags.map(t=>`<span>${t}</span>`).join('')}</div>`;
    card.onclick=()=>selectStory(s);
    grid.appendChild(card);
  });
  // AI card
  const ai=document.createElement('div');ai.className='story-card ai-gen';ai.style.borderColor='#7c6aad55';
  ai.innerHTML=`<div class="ai-sp" id="ai-sp"></div><div class="sc-icon" id="ai-ico">✨</div><div class="sc-theme" style="color:#7c6aad">AI 随机故事</div><div class="sc-title" style="color:#7c6aad">生成新剧本</div><div class="sc-desc">让 AI 为你创造一个全新的悬疑故事，独特世界、人物与谜题</div>`;
  ai.onclick=()=>genAIStory(ai);
  grid.appendChild(ai);
  // 恢复存档按钮区
  const saves=getSaveList();
  if(saves.length>0){
    const sec=document.createElement('div');sec.id='save-section';
    sec.style.cssText='width:100%;grid-column:1/-1;border-top:1px solid var(--border);padding-top:18px;margin-top:6px';
    sec.innerHTML='<div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">📂 继续已有存档</div>';
    const srow=document.createElement('div');srow.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
    saves.forEach(sv=>{
      const wrap=document.createElement('div');
      wrap.style.cssText='display:flex;align-items:center;gap:6px';
      const b=document.createElement('button');b.className='pvbtn';
      b.style.cssText='font-size:12px;padding:6px 12px;border-radius:8px;max-width:220px;text-align:left;line-height:1.4';
      b.innerHTML=`<strong>${sv.storyTitle||'未知故事'}</strong><br><span style="font-size:10px;opacity:0.7">存档${sv.slot} · ${sv.savedAt} · 线索${sv.evidence?.length||0}条</span>`;
      b.onclick=()=>loadSaveAndEnter(sv.slot,sv.storyId);
      const del=document.createElement('button');del.className='pvbtn';
      del.style.cssText='font-size:12px;padding:4px 8px;border-radius:8px;color:#e07070;border-color:#3a1818;flex-shrink:0';
      del.textContent='🗑';del.title='删除此存档';
      del.onclick=(e)=>{e.stopPropagation();if(!confirm(`确认删除存档${sv.slot}（${sv.storyTitle}）？`))return;delSave(sv.slot);renderGrid()};
      wrap.appendChild(b);wrap.appendChild(del);
      srow.appendChild(wrap);
    });
    sec.appendChild(srow);
    grid.after(sec);
  }
}

function selectStory(story){
  showSL('正在准备故事世界…');
  setTimeout(()=>{
    hideSL();
    document.getElementById('phase-story').classList.remove('visible');
    startGame(story);
  },500);
}

function getSaveList(){
  const all=[];
  ['1','2','3','auto'].forEach(s=>{const d=loadSave(s);if(d)all.push({...d,slot:s})});
  return all;
}
function loadSaveAndEnter(slot,storyId){
  const data=loadSave(slot);if(!data)return;
  const story=getAllStories().find(s=>s.id===storyId);
  if(!story){showToast('⚠ 找不到对应故事数据');return}
  showSL('恢复存档中…');
  setTimeout(()=>{
    hideSL();
    document.getElementById('phase-story').classList.remove('visible');
    // 直接初始化游戏环境，不播放intro/greeting，再还原存档
    startGameSilent(story);
    setTimeout(()=>applyLoaded(data),400);
  },500);
}

// 静默启动游戏（不播放intro/greeting），专用于存档恢复
function startGameSilent(story){
  STATE.story=story;STATE.stage=0;STATE.evidence=[];STATE.isWaiting=false;
  STATE.gameOver=false;STATE._finalShown=false;
  STATE.currentNPC=story.npcs[0].id;STATE.npcHistories={};STATE.npcMoods={};
  STATE.accusedList=[];STATE.innocentsJailed=0;STATE.idleSeconds=0;STATE.idleHintShown=false;
  story.npcs.forEach(n=>{STATE.npcHistories[n.id]=[];STATE.npcMoods[n.id]=n.moodInit??50});
  applyTheme(story);buildNPCBtns(story);renderSynopsis(story);
  document.getElementById('game-ui').classList.add('visible');
  document.getElementById('g-title').textContent=story.title;
  document.getElementById('g-sub').textContent=story.theme;
  updateProgress();
  // 确保场景门打开
  const tr=document.getElementById('scene-tr');
  if(tr)setTimeout(()=>tr.classList.add('open'),80);
  startIdleTimer();
}

async function genAIStory(card){
  document.getElementById('ai-sp').style.display='block';
  document.getElementById('ai-ico').style.display='none';
  card.style.pointerEvents='none';
  showSL('AI 正在创作全新故事世界…');
  // 多样化题材池，确保每次生成截然不同
  const THEME_POOL=[
    {icon:'⏳',setting:'时空穿越·现代人穿越到古代',detail:'主角意外穿越至明朝京城，身处一场宫廷秘密毒杀案，必须查清真相才能找到回去的方法',color:'#c084fc',ambient:'night'},
    {icon:'🌊',setting:'深海研究站·孤立无援',detail:'深海6000米的海底实验站，外部通讯中断整整72小时，首席科学家被发现死在气密舱中，凶手就在站内五人之中',color:'#06b6d4',ambient:'night'},
    {icon:'🎮',setting:'全息游戏世界·玩家真实死亡',detail:'一款神经接入式沉浸RPG中，玩家角色离线后本人真实死亡，幸存的四名玩家必须在游戏内找出凶手',color:'#a855f7',ambient:'night'},
    {icon:'☢️',setting:'末日地下避难所·资源告急',detail:'核战后第三年，地下庇护所领袖突然在例行配给会议上倒下，食物正在耗尽，幸存者们开始互相怀疑',color:'#ef4444',ambient:'night'},
    {icon:'🏺',setting:'古埃及考古·法老诅咒',detail:'考古队在未开封的法老墓室发现一具现代人尸体，诅咒之说四起，然而真正的凶器是一种罕见的古代毒物',color:'#d97706',ambient:'night'},
    {icon:'🚀',setting:'火星殖民地·人类新纪元',detail:'第一座火星城市建成纪念日前夕，掌握关键生命维持系统密码的工程师离奇死亡，整座城市命悬一线',color:'#f97316',ambient:'night'},
    {icon:'🔮',setting:'魔法学院·禁术杀人',detail:'顶尖魔法学府的毕业典礼前夜，院长死于一种失传百年的禁忌魔法，施术者藏匿于学院四位导师之中',color:'#8b5cf6',ambient:'rain'},
    {icon:'🧊',setting:'南极科考·极夜密室',detail:'极夜中南极科考站与总部失联，气象学家被发现冻死在室温正常的宿舍，是意外还是谋杀？',color:'#7dd3fc',ambient:'night'},
    {icon:'⚔️',setting:'日本战国·茶会毒杀',detail:'一代枭雄织田家的密谋茶会上，谋主猝死于第三盏茶，四位武将各怀异心，真相藏于茶道礼仪之后',color:'#dc2626',ambient:'rain'},
    {icon:'🎭',setting:'民国上海·十里洋场',detail:'1930年大世界歌舞厅头牌在众目睽睽的舞台上倒下，幕后是军阀、洋商、秘密结社的三方角力',color:'#f59e0b',ambient:'rain'},
    {icon:'🏮',setting:'江南水乡·清明古案',detail:'苏州古镇清明节，百年古宅的传家玉佩被盗，宅主翌日陈尸在自家祠堂，疑点指向四位亲眷',color:'#f43f5e',ambient:'rain'},
    {icon:'🎠',setting:'废弃游乐园·二十年旧案',detail:'封闭二十年的游乐园一夜间灯火重燃，当年惨案的四位目击者收到邀请函，一一踏入其中再难离去',color:'#ec4899',ambient:'night'},
    {icon:'🛸',setting:'外星文明遗址·第一接触',detail:'人类考古队在月球背面发现疑似外星人工建筑，队长在首次进入后死亡，而遗址内的机关仍在运作',color:'#10b981',ambient:'night'},
    {icon:'⚛️',setting:'量子实验室·平行世界',detail:'量子传送首次人体实验成功，接收端出现的却是一具尸体，发送端的原版当事人声称从未启动实验',color:'#34d399',ambient:'night'},
    {icon:'🏛️',setting:'古罗马角斗场·政治阴谋',detail:'穿越至公元100年罗马，竞技场冠军角斗士在庆功宴上中毒，元老院四位成员均与死者有深仇大恨',color:'#b45309',ambient:'night'},
  ];
  // 避免连续生成相同题材
  const usedIdx=parseInt(localStorage.getItem('ai_last_theme_idx')||'-1');
  let idx;do{idx=Math.floor(Math.random()*THEME_POOL.length)}while(idx===usedIdx&&THEME_POOL.length>1);
  localStorage.setItem('ai_last_theme_idx',idx);
  const pick=THEME_POOL[idx];

  const prompt=`请为一个剧本杀游戏创建一个完整的悬疑故事。只返回JSON，不要任何其他文字。JSON结构如下（请严格遵循）：
{"id":"ai_${Date.now()}","icon":"${pick.icon}","theme":"${pick.setting}","title":"故事标题(15字内)","desc":"简介(50字内)","tags":["标签1","标签2","标签3"],"themeColor":"${pick.color}","bgGradient":"linear-gradient(135deg,#色1,#色2)","ambientType":"${pick.ambient}","synopsis":{"victim":"被害人姓名","victimDesc":"被害人描述","scene":"案发现场描述","time":"案发时间","suspects":["嫌疑人1描述","嫌疑人2描述","嫌疑人3描述"],"killerNpcId":"凶手的npc id"},"intro":["开场白1","开场白2"],"firstNPCGreeting":{"npc":"第一个npc的id","text":"开场台词"},"npcs":[{"id":"npc1","name":"姓名","avatar":"emoji","role":"身份·描述","moodInit":40,"isKiller":false,"systemPrompt":"详细角色扮演提示词（人物背景、动机、知道的秘密、说话风格，叙事规则：每次回复不超过120字，触及线索时用[线索:XXX]标记，凶手用[误导:XXX]）"}],"evidence_triggers":{"线索名":{"icon":"emoji","title":"显示名","desc":"描述","weight":30}},"stage_gates":[{"evidence":["线索名1"],"toStage":1},{"evidence":["线索名2"],"toStage":2},{"evidence":["线索名3"],"toStage":3}],"final_choice_trigger":3,"endings":{"good":{"type":"good","icon":"⚖️","title":"真相大白","story":"完整结局叙述"},"bad":{"type":"bad","icon":"🩸","title":"冤案铸成","story":"错误结局叙述"},"killer_wins":{"type":"bad","icon":"😈","title":"凶手胜利","story":"凶手胜利结局叙述"}}}

本次故事题材：【${pick.setting}】—— ${pick.detail}
请严格按照此题材创作，不得偏离到庄园、公司办公室、火车车厢、普通密室等陈旧场景。
3-4个NPC，各有鲜明性格、独特秘密和作案动机（或无辜理由）。凶手isKiller必须为true，其余为false。只返回JSON。`;
  try{
    const r=await fetch(STATE.apiBase+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+STATE.apiKey},
      body:JSON.stringify({model:STATE.model,messages:[{role:'user',content:prompt}],max_tokens:3500,temperature:0.9})
    });
    const d=await r.json();
    const raw=d.choices[0].message.content;
    const m=raw.match(/\{[\s\S]*\}/);
    if(!m)throw new Error('解析失败');
    const story=JSON.parse(m[0]);
    saveAIStory(story);
    hideSL();selectStory(story);
  }catch(e){
    hideSL();
    document.getElementById('ai-sp').style.display='none';
    document.getElementById('ai-ico').style.display='block';
    card.style.pointerEvents='';
    showToast('⚠ AI 生成失败：'+e.message.slice(0,60));
  }
}
function showSL(msg){const el=document.getElementById('sl');el.classList.add('visible');if(msg)document.getElementById('sl-msg').textContent=msg}
function hideSL(){document.getElementById('sl').classList.remove('visible')}

// ─── switchStory（游戏内返回选剧本）────────────────────────
function switchStory(){
  if(STATE.isWaiting){showToast('⚠ 请等待当前对话完成');return}
  if(!STATE.gameOver&&STATE.evidence.length>0){
    if(!confirm('切换剧本将丢失当前未保存的进度。\n建议先存档（💾）再切换。\n确认切换？'))return;
  }
  clearIdleTimer();
  if(STATE.ambientOn){stopAmb();STATE.ambientOn=false;const ab=document.getElementById('amb-btn');if(ab)ab.textContent='🔇 音效';}
  clearTimeout(thunderTmr);
  document.getElementById('game-ui').classList.remove('visible');
  STATE.story=null;STATE.gameOver=false;STATE._finalShown=false;
  STATE.evidence=[];STATE.stage=0;STATE.currentNPC=null;
  STATE.npcHistories={};STATE.npcMoods={};
  STATE.accusedList=[];STATE.innocentsJailed=0;STATE.idleSeconds=0;STATE.idleHintShown=false;
  document.getElementById('messages').innerHTML='';
  document.getElementById('evidence-list').innerHTML='<div id="ev-ph" style="padding:10px;font-size:12px;color:var(--text-dim);text-align:center;line-height:1.6;">与NPC对话时<br>会自动收集线索</div>';
  document.getElementById('npc-btns').innerHTML='';
  document.getElementById('synopsis-panel').innerHTML='';
  ['settings-overlay','save-overlay','accuse-overlay','roundtable-overlay'].forEach(id=>{document.getElementById(id)?.classList.remove('visible')});
  renderGrid();
  document.getElementById('phase-story').classList.add('visible');
  document.body.style.background='#06060e';
}

// ═══════════════════════════════════════
//  GAME START
// ═══════════════════════════════════════
function startGame(story){
  STATE.story=story;STATE.stage=0;STATE.evidence=[];STATE.isWaiting=false;
  STATE.gameOver=false;STATE._finalShown=false;
  STATE.currentNPC=story.npcs[0].id;STATE.npcHistories={};STATE.npcMoods={};
  STATE.accusedList=[];STATE.innocentsJailed=0;STATE.idleSeconds=0;STATE.idleHintShown=false;
  story.npcs.forEach(n=>{STATE.npcHistories[n.id]=[];STATE.npcMoods[n.id]=n.moodInit??50});
  applyTheme(story);buildNPCBtns(story);renderSynopsis(story);
  document.getElementById('game-ui').classList.add('visible');
  document.getElementById('g-title').textContent=story.title;
  document.getElementById('g-sub').textContent=story.theme;
  updateProgress();
  story.intro.forEach((txt,i)=>setTimeout(()=>addSysMsg(txt,i===0?'':'important'),i*600));
  const greetDelay=(story.intro.length*600)+400;
  setTimeout(()=>{
    const firstId=story.firstNPCGreeting?.npc||story.npcs[0].id;
    const firstNpc=story.npcs.find(n=>n.id===firstId);
    // 强制初始化：先切换到第一位角色并展示对话
    switchNPC(firstId,true);
    // 开场说明系统消息
    setTimeout(()=>{
      addSysMsg('💡 提示：点击左侧角色按钮可以切换对话对象，每位角色拥有独特的信息和秘密。','important');
    },200);
    setTimeout(()=>{
      if(firstNpc)addNPCMsg(firstId,firstNpc.name,story.firstNPCGreeting?.text||'……',getTime());
    },700);
  },greetDelay);
  startIdleTimer();
}
function applyTheme(s){
  document.documentElement.style.setProperty('--tp',s.themeColor);
  document.body.style.background=s.bgGradient||'var(--bg)';
  document.getElementById('send-btn').style.background=s.themeColor;
}
function buildNPCBtns(story){
  const c=document.getElementById('npc-btns');c.innerHTML='';
  story.npcs.forEach(npc=>{
    const b=document.createElement('button');b.className='npc-btn';b.id='nb-'+npc.id;
    b.onclick=()=>switchNPC(npc.id);
    b.innerHTML=`<span class="npc-ava">${npc.avatar}</span><div><div class="npc-nm">${npc.name}</div><div class="npc-rl">${npc.role.split('·')[0]}</div></div><div class="npc-mm"><div class="npc-mf" id="mm-${npc.id}" style="width:${npc.moodInit??50}%;background:${moodClr(npc.moodInit??50)}"></div></div>`;
    c.appendChild(b);
  });
  const accDiv=document.createElement('div');accDiv.style.cssText='margin-top:8px;padding:0 1px';
  accDiv.innerHTML=`<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--text-dim);padding:0 8px 6px;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">⚖ 指控</div>`;
  story.npcs.forEach(npc=>{
    const b=document.createElement('button');
    b.className='npc-btn';b.id='acc-'+npc.id;
    b.style.cssText='background:rgba(192,57,43,0.07);border-color:#3a1818';
    b.innerHTML=`<span style="font-size:14px">🔒</span><div><div class="npc-nm" style="color:#e07070">指控 ${npc.name}</div><div class="npc-rl">认为此人是凶手</div></div>`;
    b.onclick=()=>openAccuseModal(npc);
    accDiv.appendChild(b);
  });
  c.appendChild(accDiv);
}

// ═══════════════════════════════════════
//  SYNOPSIS
// ═══════════════════════════════════════
function renderSynopsis(story){
  const syn=story.synopsis;if(!syn)return;
  const el=document.getElementById('synopsis-panel');if(!el)return;
  el.innerHTML=`
    <div class="syn-hd" onclick="toggleSynopsis()">
      <span>📜 故事大纲</span><span id="syn-toggle">▲</span>
    </div>
    <div id="syn-body">
      <div class="syn-row"><span class="syn-lbl">被害人</span><span class="syn-val">${syn.victim||'—'}</span></div>
      <div class="syn-row"><span class="syn-lbl">情况</span><span class="syn-val" style="font-size:11px">${syn.victimDesc||''}</span></div>
      <div class="syn-row"><span class="syn-lbl">现场</span><span class="syn-val" style="font-size:11px">${syn.scene||''}</span></div>
      <div class="syn-row"><span class="syn-lbl">时间</span><span class="syn-val">${syn.time||''}</span></div>
      <div class="syn-lbl" style="margin-top:5px">嫌疑人</div>
      ${(syn.suspects||[]).map(s=>`<div class="syn-sus">• ${s}</div>`).join('')}
    </div>`;
}
let synOpen=true;
function toggleSynopsis(){
  synOpen=!synOpen;
  const body=document.getElementById('syn-body');
  const tog=document.getElementById('syn-toggle');
  if(body)body.style.display=synOpen?'':'none';
  if(tog)tog.textContent=synOpen?'▲':'▼';
}

// ═══════════════════════════════════════
//  NPC SWITCH
// ═══════════════════════════════════════
function playSwitchSound(){
  try{
    initAudio();
    // 短促的"咔哒"音效
    [[0,420,0.08],[0.05,320,0.05],[0.1,600,0.04]].forEach(([t,f,v])=>{
      const o=actx.createOscillator(),g=actx.createGain();
      o.type='triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0,actx.currentTime+t);
      g.gain.linearRampToValueAtTime(v,actx.currentTime+t+0.01);
      g.gain.exponentialRampToValueAtTime(0.001,actx.currentTime+t+0.12);
      o.connect(g);g.connect(actx.destination);
      o.start(actx.currentTime+t);o.stop(actx.currentTime+t+0.14);
    });
  }catch(e){}
}

function switchNPC(npcId,skip){
  if(STATE.isWaiting&&!skip)return;
  // 不再因为"同一NPC"而跳过，确保首次点击必定生效
  const isSame=(STATE.currentNPC===npcId);
  STATE.currentNPC=npcId;
  const npc=STATE.story?.npcs?.find(n=>n.id===npcId);if(!npc)return;
  document.getElementById('typ-ava').textContent=npc.avatar;
  document.querySelectorAll('.npc-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('nb-'+npcId);if(btn)btn.classList.add('active');
  document.getElementById('input-box').placeholder='向'+npc.name+'提问…';
  if(skip){
    updateNPCHdr(npc);
    // 确保推拉门打开，否则聊天区域会是一片黑
    const tr=document.getElementById('scene-tr');
    if(tr)setTimeout(()=>tr.classList.add('open'),80);
    return;
  }
  if(!isSame)playSwitchSound();
  const tr=document.getElementById('scene-tr');tr.classList.remove('open');
  setTimeout(()=>{
    updateNPCHdr(npc);
    addSysMsg('— 你转向 '+npc.avatar+' '+npc.name+' —');
    setTimeout(()=>tr.classList.add('open'),80);
  },480);
}
function updateNPCHdr(npc){
  document.getElementById('npc-ava').textContent=npc.avatar;
  document.getElementById('npc-nm').textContent=npc.name;
  document.getElementById('npc-rl').textContent=npc.role;
  updateMoodUI(npc.id);
}

// ═══════════════════════════════════════
//  MOOD
// ═══════════════════════════════════════
function moodClr(v){return v>65?'#c0392b':v>40?'#c8a96e':'#27ae60'}
const MOOD_LVL=[{max:15,label:'沉默',desc:'极度封闭'},{max:30,label:'镇定',desc:'保持克制'},{max:45,label:'戒备',desc:'有所顾虑'},{max:60,label:'不安',desc:'心神不宁'},{max:75,label:'激动',desc:'情绪起伏'},{max:100,label:'崩溃',desc:'濒临失控'}];
function getMoodInfo(v){return MOOD_LVL.find(l=>v<=l.max)||MOOD_LVL[MOOD_LVL.length-1]}
function updateMoodUI(id){
  const v=STATE.npcMoods[id]??50,info=getMoodInfo(v);
  document.getElementById('mood-fill').style.width=v+'%';
  document.getElementById('mood-fill').style.background=moodClr(v);
  document.getElementById('mood-lbl').textContent=info.label;
  document.getElementById('mood-dsc').textContent=info.desc;
  const mm=document.getElementById('mm-'+id);
  if(mm){mm.style.width=v+'%';mm.style.background=moodClr(v)}
}
function updateMoodFromReply(id,reply){
  const lastUser=STATE.npcHistories[id].filter(m=>m.role==='user').slice(-1)[0]?.content||'';
  let delta=0;
  if(['你撒谎','你是凶手','你杀了','你在说谎','你挪用','你骗','你做了'].some(w=>lastUser.includes(w)))delta+=12;
  delta+=(reply.match(/\[线索:/g)||[]).length*7;
  if(reply.includes('[误导:'))delta-=6;
  delta+=STATE.stage*4;
  STATE.npcMoods[id]=Math.min(100,Math.max(5,(STATE.npcMoods[id]??50)+delta));
  if(STATE.currentNPC===id)updateMoodUI(id);
}

// ═══════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════
function updateProgress(){
  const s=STATE.story;if(!s)return;
  const tot=Object.keys(s.evidence_triggers||{}).length||1;
  const pct=Math.min(100,(STATE.stage/3)*70+(STATE.evidence.length/tot)*30);
  document.getElementById('pf').style.width=pct+'%';
  const labs=['初步调查','深入线索','逼近真相','揭晓时刻'];
  document.getElementById('pl').textContent=labs[Math.min(STATE.stage,3)];
}

// ═══════════════════════════════════════
//  LANGUAGE
// ═══════════════════════════════════════
function getLangInstruction(){
  if(STATE.lang==='zh')return'【语言要求】请全程使用中文回复，不要使用英文。';
  if(STATE.lang==='en')return'【Language Requirement】You MUST reply entirely in English. Do not use Chinese at all.';
  if(STATE.lang==='bi')return'【双语要求】每次回复必须先用中文，然后空一行，再用英文翻译。格式严格如下：\n中文内容\n\n[EN] English translation here';
  return '';
}
function setLang(l){
  STATE.lang=l;
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('sel',b.dataset.l===l));
  const labels={zh:'中文',en:'English',bi:'双语对照'};
  showToast('语言切换：'+labels[l]);
}

// ═══════════════════════════════════════
//  FONT SIZE
// ═══════════════════════════════════════
const FONT_SCALES={small:0.85,medium:1,large:1.2,xlarge:1.45};
function setFontSize(sz){
  const scale=FONT_SCALES[sz]||1;
  // 直接设置 html font-size，所有 rem 单位自动响应
  document.documentElement.style.fontSize=`calc(14px * ${scale})`;
  localStorage.setItem('manor_font_size',sz);
  document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('sel',b.dataset.sz===sz));
}
// 页面加载时恢复字体大小
(function(){
  const saved=localStorage.getItem('manor_font_size')||'medium';
  const scale=FONT_SCALES[saved]||1;
  document.documentElement.style.fontSize=`calc(14px * ${scale})`;
  setTimeout(()=>document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('sel',b.dataset.sz===saved)),0);
})();

// ═══════════════════════════════════════
//  SEND & REPLY
// ═══════════════════════════════════════
async function sendMessage(override){
  if(STATE.isWaiting||STATE.gameOver)return;
  const box=document.getElementById('input-box');
  const text=override||box.value.trim();if(!text)return;
  box.value='';box.style.height='auto';
  resetIdleTimer();
  addPlayerMsg(text);await getReply(text);
}
async function getReply(userInput){
  STATE.isWaiting=true;setLocked(true);showTyping(true);
  const npc=STATE.story.npcs.find(n=>n.id===STATE.currentNPC);
  const hist=STATE.npcHistories[STATE.currentNPC];
  // 语言指令直接嵌入 system prompt 开头，优先级最高
  const langInstr=getLangInstruction();
  let sys=(langInstr?langInstr+'\n\n':'')+npc.systemPrompt;
  if(STATE.evidence.length>0)sys+='\n\n玩家已收集线索：'+STATE.evidence.join('、');
  sys+='\n当前调查阶段：'+STATE.stage+'/3';
  // 角色边界约束：只能提及故事中已有的NPC，不可凭空引入新人物
  const npcNames=STATE.story.npcs.map(n=>n.name).join('、');
  sys+=`\n\n【重要约束】本案只涉及以下人物：${npcNames}，以及被害人${STATE.story.synopsis?.victim||''}。绝对不要引入或提及任何不在此列表中的新人物。如果剧情中确实需要提到陌生人（如路人、仆役等），必须在同一句话中立即说明该人当晚不在现场或毫无作案动机，且不再深入描述。`;
  const msgs=[{role:'system',content:sys},...hist,{role:'user',content:userInput}];
  try{
    const r=await fetch(STATE.apiBase+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+STATE.apiKey},
      body:JSON.stringify({model:STATE.model,messages:msgs,temperature:STATE.temperature,max_tokens:320})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||'HTTP '+r.status)}
    const d=await r.json();const reply=d.choices[0].message.content;
    hist.push({role:'user',content:userInput},{role:'assistant',content:reply});
    if(hist.length>20)hist.splice(0,2);
    showTyping(false);
    addNPCMsg(STATE.currentNPC,npc.name,reply,getTime());
    updateMoodFromReply(STATE.currentNPC,reply);
    parseClues(reply);checkStage();autoSave();
  }catch(e){
    showTyping(false);
    addSysMsg('⚠ API 错误：'+e.message,'danger');
    addSysMsg('提示：可点击右上角 ⚙ 设置 修改 API 配置后重试。','danger');
  }finally{STATE.isWaiting=false;setLocked(false)}
}

// ═══════════════════════════════════════
//  CLUES & STAGE
// ═══════════════════════════════════════
function parseClues(text){
  const re=/\[线索:([^\]]+)\]/g;let m;
  while((m=re.exec(text))!==null){
    const name=m[1].trim();
    const trig=STATE.story.evidence_triggers?.[name];
    if(trig&&!STATE.evidence.includes(name)){
      STATE.evidence.push(name);
      addEvidenceItem(trig);
      addSysMsg('🔍 线索已记录：「'+name+'」','important');
      try{initAudio();playClueSound()}catch(e){}
      showEvPop(trig);updateProgress();
      resetIdleTimer();
    }
  }
}
function showEvPop(trig){
  document.getElementById('ep-ico').textContent=trig.icon;
  document.getElementById('ep-nm').textContent=trig.title;
  const p=document.getElementById('ev-pop');p.classList.add('visible');
  setTimeout(()=>p.classList.remove('visible'),2200);
}
function checkStage(){
  const gates=STATE.story.stage_gates||[];
  gates.forEach(g=>{
    if(STATE.stage<g.toStage&&g.evidence.every(e=>STATE.evidence.includes(e))){
      STATE.stage=g.toStage;
      const labs=['—','深入调查','对质关键','揭晓时刻'];
      addSysMsg('— 调查进入新阶段：'+(labs[STATE.stage]||STATE.stage)+' —','important');
      updateProgress();
    }
  });
}

// ═══════════════════════════════════════
//  ACCUSE
// ═══════════════════════════════════════
function openAccuseModal(npc){
  if(STATE.gameOver)return;
  document.getElementById('accuse-npc-name').textContent=npc.name;
  document.getElementById('accuse-npc-ava').textContent=npc.avatar;
  document.getElementById('accuse-npc-role').textContent=npc.role;
  document.getElementById('accuse-target-id').value=npc.id;
  document.getElementById('accuse-evidence-count').textContent=STATE.evidence.length;
  document.getElementById('accuse-overlay').classList.add('visible');
}
function closeAccuseModal(){document.getElementById('accuse-overlay').classList.remove('visible')}
function confirmAccuse(){
  const npcId=document.getElementById('accuse-target-id').value;
  const npc=STATE.story.npcs.find(n=>n.id===npcId);
  if(!npc)return;
  closeAccuseModal();
  STATE.accusedList.push({npcId,time:getTime()});
  const killerNpcId=STATE.story.synopsis?.killerNpcId||STATE.story.npcs.find(n=>n.isKiller)?.id;
  const isCorrect=(npcId===killerNpcId);
  if(isCorrect){
    addPlayerMsg(`我指控 ${npc.name} 是真正的凶手！`);
    addSysMsg(`⚖ 你指控了 ${npc.avatar} ${npc.name}……`,'important');
    setTimeout(()=>triggerRoundtable(npc,'good'),1000);
  }else{
    STATE.innocentsJailed++;
    addPlayerMsg(`我指控 ${npc.name} 是凶手！`);
    addSysMsg(`❌ 你的指控落在了 ${npc.avatar} ${npc.name} 身上，但这是错误的……`,'danger');
    const innocentCount=STATE.story.npcs.filter(n=>!n.isKiller).length;
    if(STATE.innocentsJailed>=innocentCount){
      setTimeout(()=>triggerRoundtable(STATE.story.npcs.find(n=>n.isKiller)||npc,'killer_wins'),1000);
    }else{
      addSysMsg(`好人阵营失去了一名成员（${innocentCount-STATE.innocentsJailed}名好人剩余）。凶手仍然逍遥法外……`,'danger');
    }
  }
}

function triggerRoundtable(culpritNpc,endType){
  STATE.gameOver=true;setLocked(true);
  const end=STATE.story.endings?.[endType]||STATE.story.endings?.['bad']||{type:'bad',icon:'🩸',title:'结局',story:'故事结束了。'};
  const npcs=STATE.story.npcs;
  const isGood=endType==='good';

  // 角色卡片 HTML
  let seatsHtml='';
  npcs.forEach(npc=>{
    const isCulprit=npc.id===culpritNpc.id;
    seatsHtml+=`<div class="rt-seat-card ${isCulprit?(isGood?'rt-card-culprit':'rt-card-culprit-win'):'rt-card-innocent'}">
      <div class="rt-ava ${isCulprit?(isGood?'rt-culprit':'rt-culprit-win'):''}">${npc.avatar}</div>
      <div class="rt-nm">${npc.name}</div>
      <div class="rt-role-tag">${npc.role.split('·')[0]}</div>
      ${isCulprit&&isGood?'<div class="rt-badge">⚖ 凶手落网</div>':''}
      ${isCulprit&&!isGood?'<div class="rt-badge rt-badge-win">😈 逍遥法外</div>':''}
    </div>`;
  });
  // 玩家卡片
  seatsHtml+=`<div class="rt-seat-card rt-card-player">
    <div class="rt-ava rt-player">🕵️</div>
    <div class="rt-nm">你（侦探）</div>
    <div class="rt-role-tag">${isGood?'推理成功':'调查失败'}</div>
  </div>`;

  document.getElementById('rt-seats').innerHTML=seatsHtml;
  document.getElementById('rt-title').textContent=end.title||'结局';
  document.getElementById('rt-title').style.color=isGood?'var(--accent)':'var(--red)';
  document.getElementById('rt-icon').textContent=end.icon||'⚖️';
  document.getElementById('rt-story').innerHTML=(end.story||'').replace(/\n/g,'<br>');
  document.getElementById('rt-result-label').textContent=isGood?'🎉 好人阵营胜利！':'💀 凶手胜利！';
  document.getElementById('rt-result-label').style.color=isGood?'var(--accent)':'var(--red)';
  document.getElementById('roundtable-overlay').classList.add('visible');
  try{initAudio();isGood?playVictorySound():playDefeatSound()}catch(e){}
  if(isGood){
    setTimeout(()=>document.querySelector('.rt-culprit')?.classList.add('rt-arrested'),800);
    setTimeout(()=>{for(let i=0;i<3;i++)setTimeout(()=>flashLightning(),i*400)},600);
  }
}

// ═══════════════════════════════════════
//  IDLE HINT
// ═══════════════════════════════════════
function startIdleTimer(){
  clearIdleTimer();
  STATE.idleSeconds=0;
  STATE.idleTimer=setInterval(()=>{
    if(STATE.isWaiting||STATE.gameOver)return;
    STATE.idleSeconds+=1;
    if(STATE.idleSeconds>=600&&!STATE.idleHintShown){
      STATE.idleHintShown=true;showIdleHintBtn();
    }
  },1000);
}
function clearIdleTimer(){if(STATE.idleTimer)clearInterval(STATE.idleTimer)}
function resetIdleTimer(){
  STATE.idleSeconds=0;STATE.idleHintShown=false;
  document.getElementById('idle-hint-btn')?.remove();
}
function showIdleHintBtn(){
  if(document.getElementById('idle-hint-btn'))return;
  const btn=document.createElement('button');
  btn.id='idle-hint-btn';btn.className='hbtn';
  btn.style.cssText='background:rgba(124,106,173,0.15);border-color:var(--accent2);color:var(--accent2);animation:glow 2s ease infinite;position:fixed;bottom:90px;right:20px;z-index:50;padding:8px 14px;font-size:13px;border-radius:10px;box-shadow:0 4px 20px rgba(124,106,173,0.3)';
  btn.innerHTML='💡 需要提示？';
  btn.onclick=()=>{btn.remove();requestHint()};
  document.body.appendChild(btn);
}
async function requestHint(){
  if(STATE.isWaiting||STATE.gameOver)return;
  addSysMsg('💡 系统正在为你分析当前局势……','important');
  STATE.isWaiting=true;setLocked(true);showTyping(true);
  const langInstr=getLangInstruction();
  const hintSys=(langInstr?langInstr+'\n\n':'')+`你是一个剧本杀的提示系统，请根据当前情况给玩家一个方向性提示（不要直接说出凶手，只引导去哪里找线索）。
故事：${STATE.story.title}
玩家已收集线索：${STATE.evidence.length>0?STATE.evidence.join('、'):'尚无线索'}
当前调查阶段：${STATE.stage}/3
所有NPC：${STATE.story.npcs.map(n=>n.name).join('、')}
请给出一句不超过60字的提示，告诉玩家下一步可以怎么做，不要透露凶手身份。只涉及上述已有人物，不要引入新人物。`;
  const hintMsgs=[{role:'system',content:hintSys},{role:'user',content:'请给出提示'}];
  try{
    const r=await fetch(STATE.apiBase+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+STATE.apiKey},
      body:JSON.stringify({model:STATE.model,messages:hintMsgs,temperature:0.7,max_tokens:150})
    });
    const d=await r.json();
    const hint=d.choices?.[0]?.message?.content||'试着换一个角度，询问你还没有深入了解的NPC。';
    showTyping(false);
    addSysMsg('💡 提示：'+hint,'important');
  }catch(e){
    showTyping(false);
    addSysMsg('💡 提示：试着询问每个NPC关于案发当晚的行踪，或直接对最可疑的人提出质疑。','important');
  }finally{STATE.isWaiting=false;setLocked(false)}
}

// ═══════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════
function addEvidenceItem(ev){
  const list=document.getElementById('evidence-list');
  const ph=document.getElementById('ev-ph');if(ph)ph.remove();
  const item=document.createElement('div');item.className='ev-item new';
  item.innerHTML=`<div class="ev-icon">${ev.icon}</div><div class="ev-title">${ev.title}</div><div class="ev-desc">${ev.desc}</div>`;
  list.appendChild(item);setTimeout(()=>item.classList.remove('new'),2000);
}
function addPlayerMsg(text){appendMsg({type:'player',avatar:'🕵️',sender:'你',text,time:getTime()})}
function addNPCMsg(id,name,text,time){
  const clean=text.replace(/\[(线索|误导):[^\]]+\]/g,'').trim();
  const npc=STATE.story?.npcs?.find(n=>n.id===id);
  appendMsg({type:'npc',avatar:npc?.avatar||'🎭',sender:name,text:clean,time});
}
function addSysMsg(text,cls){appendMsg({type:'system',text,cls})}
function appendMsg({type,avatar,sender,text,time,cls}){
  const box=document.getElementById('messages');
  const d=document.createElement('div');d.className='msg '+type+(cls?' '+cls:'');
  if(type==='system'){d.innerHTML=`<div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div>`}
  else{d.innerHTML=`${avatar?`<div class="msg-avatar">${avatar}</div>`:''}<div class="msg-body"><div class="msg-sender">${sender||''}</div><div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div>${time?`<div class="msg-time">${time}</div>`:''}</div>`}
  box.appendChild(d);box.scrollTop=box.scrollHeight;return d;
}
function showTyping(show){
  const el=document.getElementById('typing-ind');
  el.className=show?'msg npc visible':'msg npc';
  if(show)document.getElementById('messages').scrollTop=document.getElementById('messages').scrollHeight;
}
function setLocked(v){document.getElementById('input-area').className=v?'locked':''}
function getTime(){const n=new Date();return n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0')}
let toastTmr=null;
function showToast(msg){
  const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTmr);toastTmr=setTimeout(()=>el.classList.remove('show'),2200);
}

// Input handlers
const ibox=document.getElementById('input-box');
ibox.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'});
ibox.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════
buildPV('pv-set',(k,v)=>{document.getElementById('s-base').value=v.base;document.getElementById('s-model').value=v.models[0];buildChips('s-chips',v.models,'s-model')});
function openSettings(){
  document.getElementById('s-key').value=STATE.apiKey||localStorage.getItem('manor_api_key')||'';
  document.getElementById('s-base').value=STATE.apiBase||localStorage.getItem('manor_api_base')||'';
  document.getElementById('s-model').value=STATE.model||localStorage.getItem('manor_model')||'';
  document.getElementById('s-temp').value=STATE.temperature??0.85;
  document.getElementById('settings-msg').textContent='';
  // 同步字体大小按钮
  const savedSz=localStorage.getItem('manor_font_size')||'medium';
  document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('sel',b.dataset.sz===savedSz));
  try{const match=Object.entries(PROVIDERS).find(([,v])=>(STATE.apiBase||'').includes(new URL(v.base).hostname));if(match)buildChips('s-chips',match[1].models,'s-model')}catch(e){}
  document.getElementById('settings-overlay').classList.add('visible');
}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('visible')}
function saveSettings(){
  const key=document.getElementById('s-key').value.trim();
  const base=document.getElementById('s-base').value.trim().replace(/\/$/,'');
  const model=document.getElementById('s-model').value.trim()||'gpt-4o-mini';
  const temp=parseFloat(document.getElementById('s-temp').value);
  const msg=document.getElementById('settings-msg');
  if(!key){msg.style.color='#e07070';msg.textContent='请填入 API Key';return}
  if(!base){msg.style.color='#e07070';msg.textContent='请填入 API Base URL';return}
  STATE.apiKey=key;STATE.apiBase=base;STATE.model=model;STATE.isGuest=false;
  STATE.temperature=isNaN(temp)?0.85:Math.min(1,Math.max(0,temp));
  localStorage.setItem('manor_api_key',key);localStorage.setItem('manor_api_base',base);
  localStorage.setItem('manor_model',model);localStorage.setItem('manor_temperature',STATE.temperature);
  msg.style.color='var(--green)';msg.textContent='✓ 已保存，即时生效';
  showToast('⚙ 设置已保存');setTimeout(closeSettings,900);
}
document.getElementById('settings-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('settings-overlay'))closeSettings()});

// ═══════════════════════════════════════
//  SAVE / LOAD
// ═══════════════════════════════════════
const SK='manor_save_';
function loadSave(slot){const r=localStorage.getItem(SK+slot);if(!r)return null;try{return JSON.parse(r)}catch{return null}}
function writeSave(slot,data){localStorage.setItem(SK+slot,JSON.stringify(data))}
function delSave(slot){localStorage.removeItem(SK+slot)}
function autoSave(){
  if(STATE.gameOver||!STATE.story)return;
  writeSave('auto',buildSaveData('auto'));
}
function buildSaveData(slot){
  const msgs=[];
  document.querySelectorAll('#messages .msg').forEach(el=>{
    const type=el.classList.contains('player')?'player':el.classList.contains('npc')?'npc':'system';
    const cls=el.classList.contains('important')?'important':el.classList.contains('danger')?'danger':'';
    const bubble=el.querySelector('.msg-bubble');if(!bubble)return;
    const text=bubble.innerHTML.replace(/<br>/g,'\n');
    const sender=el.querySelector('.msg-sender')?.textContent||'';
    const avatar=el.querySelector('.msg-avatar')?.textContent||'';
    const time=el.querySelector('.msg-time')?.textContent||'';
    msgs.push({type,cls,text,sender,avatar,time});
  });
  const evItems=[];
  document.querySelectorAll('#evidence-list .ev-item').forEach(el=>{
    evItems.push({icon:el.querySelector('.ev-icon')?.textContent||'',title:el.querySelector('.ev-title')?.textContent||'',desc:el.querySelector('.ev-desc')?.textContent||''});
  });
  return{slot,savedAt:new Date().toLocaleString('zh-CN',{hour12:false}),storyId:STATE.story?.id,storyTitle:STATE.story?.title,stage:STATE.stage,evidence:[...STATE.evidence],currentNPC:STATE.currentNPC,npcHistories:JSON.parse(JSON.stringify(STATE.npcHistories)),npcMoods:JSON.parse(JSON.stringify(STATE.npcMoods)),gameOver:STATE.gameOver,lang:STATE.lang,accusedList:[...STATE.accusedList],innocentsJailed:STATE.innocentsJailed,messages:msgs,evItems};
}
function applyLoaded(data){
  STATE.stage=data.stage||0;STATE.evidence=data.evidence||[];
  STATE.currentNPC=data.currentNPC||STATE.story?.npcs[0]?.id;
  STATE.npcHistories=data.npcHistories||{};STATE.npcMoods=data.npcMoods||{};
  STATE.gameOver=data.gameOver||false;STATE._finalShown=STATE.stage>=(STATE.story?.final_choice_trigger??3);
  STATE.lang=data.lang||'zh';STATE.accusedList=data.accusedList||[];STATE.innocentsJailed=data.innocentsJailed||0;
  setLang(STATE.lang);updateProgress();
  const list=document.getElementById('evidence-list');list.innerHTML='';
  if(data.evItems&&data.evItems.length>0){
    data.evItems.forEach(ev=>{
      const item=document.createElement('div');item.className='ev-item';
      item.innerHTML=`<div class="ev-icon">${ev.icon}</div><div class="ev-title">${ev.title}</div><div class="ev-desc">${ev.desc}</div>`;
      list.appendChild(item);
    });
  }else{list.innerHTML='<div id="ev-ph" style="padding:10px;font-size:12px;color:var(--text-dim);text-align:center;line-height:1.6;">与NPC对话时<br>会自动收集线索</div>'}
  const mc=document.getElementById('messages');mc.innerHTML='';
  (data.messages||[]).forEach(m=>appendMsg({type:m.type,cls:m.cls,text:m.text,sender:m.sender,avatar:m.avatar,time:m.time}));
  switchNPC(STATE.currentNPC,true);
  if(STATE.gameOver)setLocked(true);
}
function openSavePanel(){
  STATE.saveTab='save';
  document.getElementById('tab-save').classList.add('active');
  document.getElementById('tab-load').classList.remove('active');
  document.getElementById('save-msg').textContent='';
  renderSaveSlots();
  document.getElementById('save-overlay').classList.add('visible');
}
function closeSavePanel(){document.getElementById('save-overlay').classList.remove('visible')}
function switchSaveTab(tab){
  STATE.saveTab=tab;
  document.getElementById('tab-save').classList.toggle('active',tab==='save');
  document.getElementById('tab-load').classList.toggle('active',tab==='load');
  document.getElementById('save-msg').textContent='';
  renderSaveSlots();
}
function renderSaveSlots(){
  const con=document.getElementById('save-slots');con.innerHTML='';
  ['1','2','3'].forEach(slot=>{
    const data=loadSave(slot);
    const div=document.createElement('div');div.className='save-slot'+(data?'':' ss-empty');
    const info=data?`<div class="ss-name">存档 ${slot} — ${data.storyTitle||'?'}</div><div class="ss-meta">📅 ${data.savedAt} · 阶段 ${data.stage}/3 · 线索 ${data.evidence?.length||0} 条</div>`:`<div class="ss-name">— 空档位 ${slot} —</div><div class="ss-meta">尚未保存</div>`;
    let acts='';
    if(STATE.saveTab==='save'){acts=`<button class="slot-btn" onclick="doSave('${slot}')">写入</button>`;if(data)acts+=`<button class="slot-btn danger" onclick="doDel('${slot}')">删除</button>`}
    else{if(data){acts=`<button class="slot-btn" onclick="doLoad('${slot}')">读取</button>`;acts+=`<button class="slot-btn danger" onclick="doDel('${slot}')">删除</button>`}}
    div.innerHTML=`<div class="ss-num">${slot}</div><div class="ss-info">${info}</div><div class="ss-acts">${acts}</div>`;
    con.appendChild(div);
  });
}
function doSave(slot){
  if(!STATE.story){showToast('请先进入游戏再存档');return}
  writeSave(slot,buildSaveData(slot));
  document.getElementById('save-msg').textContent='✓ 已写入存档 '+slot;
  showToast('💾 已保存到存档 '+slot);renderSaveSlots();
}
function doLoad(slot){
  const data=loadSave(slot);if(!data)return;
  if(!STATE.story||STATE.story.id!==data.storyId){
    const story=getAllStories().find(s=>s.id===data.storyId);
    if(!story){showToast('⚠ 找不到存档对应的故事数据，请先在故事选择页选择同一故事');return}
    if(!confirm('当前故事与存档不同，将切换故事并读取。确认？'))return;
    closeSavePanel();showSL('切换故事中…');
    setTimeout(()=>{hideSL();applyTheme(story);STATE.story=story;buildNPCBtns(story);renderSynopsis(story);applyLoaded(data);showToast('📂 已读取存档 '+slot)},500);
    return;
  }
  if(!confirm('读取存档 '+slot+'（'+data.savedAt+'）？\n当前进度将被覆盖。'))return;
  applyLoaded(data);closeSavePanel();showToast('📂 已读取存档 '+slot);
}
function doDel(slot){
  if(!confirm('确认删除存档 '+slot+'？此操作不可撤销。'))return;
  delSave(slot);document.getElementById('save-msg').textContent='已删除存档 '+slot;renderSaveSlots();
}
document.getElementById('save-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('save-overlay'))closeSavePanel()});
