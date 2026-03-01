/**
 * TeamBuild.jsx — оптимизированный тимбилдер
 * Виртуализация · Сортировка · Фильтры · Custom покемоны · memo/useCallback
 */
import React, {
  useState, useEffect, useMemo, useRef, useCallback, memo,
} from 'react';
import './TeamBuild.css';
import { getAllPokemonsList, getPokemonCompleteData } from '../../utils/pokemonData';
import { Moves } from '../../Data/moves';

/* ── CONSTANTS ──────────────────────────────────────────────── */
const ALL_NATURES = [
  'Hardy','Lonely','Brave','Adamant','Naughty',
  'Bold','Docile','Relaxed','Impish','Lax',
  'Timid','Hasty','Serious','Jolly','Naive',
  'Modest','Mild','Quiet','Bashful','Rash',
  'Calm','Gentle','Sassy','Careful','Quirky',
];
const NATURE_MODS = {
  Hardy:{},Lonely:{plus:'atk',minus:'def'},Brave:{plus:'atk',minus:'spe'},
  Adamant:{plus:'atk',minus:'spa'},Naughty:{plus:'atk',minus:'spd'},
  Bold:{plus:'def',minus:'atk'},Docile:{},Relaxed:{plus:'def',minus:'spe'},
  Impish:{plus:'def',minus:'spa'},Lax:{plus:'def',minus:'spd'},
  Timid:{plus:'spe',minus:'atk'},Hasty:{plus:'spe',minus:'def'},
  Serious:{},Jolly:{plus:'spe',minus:'spa'},Naive:{plus:'spe',minus:'spd'},
  Modest:{plus:'spa',minus:'atk'},Mild:{plus:'spa',minus:'def'},
  Quiet:{plus:'spa',minus:'spe'},Bashful:{},Rash:{plus:'spa',minus:'spd'},
  Calm:{plus:'spd',minus:'atk'},Gentle:{plus:'spd',minus:'def'},
  Sassy:{plus:'spd',minus:'spe'},Careful:{plus:'spd',minus:'spa'},Quirky:{},
};
const STAT_KEYS   = ['hp','atk','def','spa','spd','spe'];
const STAT_LABELS = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };
const STAT_COLORS = { hp:'#ff4444', atk:'#f08030', def:'#f8d030', spa:'#6890f0', spd:'#78c850', spe:'#f85888' };
const TYPE_COLORS = {
  Normal:'#A8A878',Fire:'#F08030',Water:'#6890F0',Electric:'#F8D030',
  Grass:'#78C850',Ice:'#98D8D8',Fighting:'#C03028',Poison:'#A040A0',
  Ground:'#E0C068',Flying:'#A890F0',Psychic:'#F85888',Bug:'#A8B820',
  Rock:'#B8A038',Ghost:'#705898',Dragon:'#7038F8',Dark:'#705848',
  Steel:'#B8B8D0',Fairy:'#EE99AC',
};
const ALL_TYPES       = Object.keys(TYPE_COLORS);
const FORMATS         = ['gen9ou','gen9ubers','gen9uu','gen9ru','gen9nu','gen9pu','gen9nationaldex','gen9vgc2024','gen9randombattle','gen9customgame'];
const TIERS           = ['Uber','OU','UUBL','UU','RUBL','RU','NUBL','NU','PUBL','PU','ZU','NFE','LC','Illegal'];
const GENERATIONS     = [1,2,3,4,5,6,7,8,9];
const GEN_RANGES      = [{gen:1,min:1,max:151},{gen:2,min:152,max:251},{gen:3,min:252,max:386},{gen:4,min:387,max:493},{gen:5,min:494,max:649},{gen:6,min:650,max:721},{gen:7,min:722,max:809},{gen:8,min:810,max:905},{gen:9,min:906,max:1025}];
const MOVE_CATEGORIES = ['Physical','Special','Status'];
const ROW_H           = 42;

/* ── HELPERS ────────────────────────────────────────────────── */
const numToGen = n => { if (!n||n>1025) return 99; return GEN_RANGES.find(r=>n>=r.min&&n<=r.max)?.gen??0; };

const calcStat = (stat, base, iv, ev, level, nat) => {
  const b=base|0,lv=level|0,evv=Math.min(252,ev|0),ivv=Math.min(31,iv|0),nm=NATURE_MODS[nat]||{};
  if(stat==='hp'){if(b===1)return 1;return Math.floor(((2*b+ivv+Math.floor(evv/4))*lv)/100)+lv+10;}
  let v=Math.floor(((2*b+ivv+Math.floor(evv/4))*lv)/100)+5;
  if(nm.plus===stat)v=Math.floor(v*1.1);if(nm.minus===stat)v=Math.floor(v*0.9);return v;
};
const sumEVs = evs => STAT_KEYS.reduce((s,k)=>s+(evs[k]|0),0);

const spr = name => `https://play.pokemonshowdown.com/sprites/ani/${(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;
const mkFb = name => {
  let n=0; return e=>{n++;const s=(name||'').toLowerCase().replace(/[^a-z0-9-]/g,''),cu=(name||'').toLowerCase().replace(/\s+/g,'_');
    if(n===1)e.target.src=`https://play.pokemonshowdown.com/sprites/gen5/${s}.png`;
    else if(n===2)e.target.src=`/image_pokemons/${cu}.gif`;
    else if(n===3)e.target.src=`/image_pokemons/${cu}.png`;
    else e.target.style.display='none';};
};

const exportPaste = team => (team.mons||[]).filter(Boolean).map(m=>{
  const hdr=m.nickname?`${m.nickname} (${m.name})`:m.name;
  const evStr=STAT_KEYS.filter(s=>m.evs?.[s]).map(s=>`${m.evs[s]} ${STAT_LABELS[s]}`).join(' / ');
  const ivStr=STAT_KEYS.filter(s=>(m.ivs?.[s]??31)!==31).map(s=>`${m.ivs[s]} ${STAT_LABELS[s]}`).join(' / ');
  return[`${hdr} @ ${m.item||'None'}`,`Ability: ${m.ability}`,`Level: ${m.level||100}`,`Shiny: ${m.shiny?'Yes':'No'}`,
    `Tera Type: ${m.teraType||m.types?.[0]||'Normal'}`,evStr&&`EVs: ${evStr}`,`${m.nature||'Serious'} Nature`,
    ivStr&&`IVs: ${ivStr}`,...(m.moves||[]).filter(Boolean).map(mv=>`- ${mv}`)].filter(Boolean).join('\n');
}).join('\n\n');

const importPaste = text => text.split(/\n\n+/).filter(Boolean).map(block=>{
  const lines=block.trim().split('\n');
  const mon={nickname:'',name:'',item:'',ability:'None',level:100,shiny:false,teraType:'Normal',nature:'Serious',moves:[],evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0},ivs:{hp:31,atk:31,def:31,spa:31,spd:31,spe:31}};
  lines.forEach((line,i)=>{
    if(i===0){const at=line.match(/^(.+?)\s*@\s*(.+)$/),ns=at?at[1]:line,pm=ns.match(/^(.+?)\s*\((.+)\)$/);
      mon.nickname=pm?pm[1].trim():'';mon.name=pm?pm[2].trim():ns.trim();mon.item=at?at[2].trim():'';return;}
    if(line.startsWith('Ability:'))mon.ability=line.slice(8).trim();
    if(line.startsWith('Level:'))mon.level=parseInt(line.slice(6))||100;
    if(line.startsWith('Shiny: Yes'))mon.shiny=true;
    if(line.startsWith('Tera Type:'))mon.teraType=line.slice(10).trim();
    if(line.includes('Nature'))mon.nature=line.split(' ')[0];
    const parseSL=(raw,obj)=>raw.split('/').forEach(p=>{const m=p.trim().match(/(\d+)\s+(\w+)/);if(m){const k=Object.keys(STAT_LABELS).find(x=>STAT_LABELS[x]===m[2]);if(k)obj[k]=+m[1];}});
    if(line.startsWith('EVs:'))parseSL(line.slice(4),mon.evs);
    if(line.startsWith('IVs:'))parseSL(line.slice(4),mon.ivs);
    if(line.startsWith('- '))mon.moves.push(line.slice(2).trim());
  });
  while(mon.moves.length<4)mon.moves.push('');return mon;
});

const mkDefault = data=>({...data,nickname:'',item:'',ability:data.abilities?Object.values(data.abilities)[0]:'None',
  level:100,gender:'M',shiny:false,teraType:data.types?.[0]||'Normal',nature:'Serious',moves:['','','',''],
  evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0},ivs:{hp:31,atk:31,def:31,spa:31,spd:31,spe:31}});

/* ── MODULE-LEVEL PKMN CACHE ────────────────────────────────── */
let _cache=null;
const getCache=()=>{
  if(_cache)return _cache;
  _cache=getAllPokemonsList().map(p=>{
    const full=getPokemonCompleteData(p.id)||p;const bs=full.baseStats||{};
    return{...full,id:p.id,bst:STAT_KEYS.reduce((s,k)=>s+(bs[k]||0),0),gen:numToGen(full.num)};
  });
  return _cache;
};

/* ── VIRTUAL LIST ───────────────────────────────────────────── */
const VirtualList=memo(({items,rowH,render,height=460})=>{
  const [top,setTop]=useState(0);
  const onScroll=useCallback(e=>setTop(e.currentTarget.scrollTop),[]);
  const start=Math.max(0,Math.floor(top/rowH)-2),vis=Math.ceil(height/rowH)+5,end=Math.min(items.length,start+vis);
  return(
    <div className="vlist" style={{height,overflowY:'auto'}} onScroll={onScroll}>
      <div style={{height:items.length*rowH,position:'relative'}}>
        <div style={{position:'absolute',top:start*rowH,left:0,right:0}}>
          {items.slice(start,end).map((it,i)=>render(it,start+i))}
        </div>
      </div>
    </div>
  );
});

/* ================================================================
   ROOT
================================================================ */
const TeamBuild=()=>{
  const[view,setView]=useState('list');
  const[teams,setTeams]=useState(()=>{try{return JSON.parse(localStorage.getItem('ps_teams')||'[]');}catch{return[];}});
  const[curIdx,setCurIdx]=useState(0);
  const[activeSlot,setActiveSlot]=useState(0);
  const[selectMode,setSelectMode]=useState(null);
  const[activeMI,setActiveMI]=useState(0);
  const[showExport,setShowExport]=useState(false);
  const[showImport,setShowImport]=useState(false);
  const[importTxt,setImportTxt]=useState('');
  const[statTab,setStatTab]=useState('evs');
  const saveRef=useRef(null);

  useEffect(()=>{clearTimeout(saveRef.current);saveRef.current=setTimeout(()=>localStorage.setItem('ps_teams',JSON.stringify(teams)),400);},[teams]);

  const curTeam=teams[curIdx],curMon=curTeam?.mons?.[activeSlot];

  const updTeam=useCallback(fn=>setTeams(prev=>{const n=prev.map((t,i)=>i!==curIdx?t:{...t,mons:[...t.mons]});fn(n[curIdx]);return n;}),[curIdx]);
  const updMon=useCallback((k,v)=>updTeam(t=>{if(t.mons[activeSlot])t.mons[activeSlot]={...t.mons[activeSlot],[k]:v};}),[updTeam,activeSlot]);
  const updStat=useCallback((type,stat,raw)=>{const max=type==='evs'?252:31,val=Math.max(0,Math.min(max,parseInt(raw)||0));updTeam(t=>{const m=t.mons[activeSlot];if(!m)return;t.mons[activeSlot]={...m,[type]:{...m[type],[stat]:val}};});},[updTeam,activeSlot]);
  const pickPkmn=useCallback(p=>{const full=getPokemonCompleteData(p.id)||p;updTeam(t=>{t.mons[activeSlot]=mkDefault(full);});setSelectMode(null);},[updTeam,activeSlot]);
  const pickMove=useCallback(mv=>{updTeam(t=>{const m=t.mons[activeSlot];if(!m)return;const moves=[...m.moves];moves[activeMI]=mv.name;t.mons[activeSlot]={...m,moves};});setSelectMode(null);},[updTeam,activeSlot,activeMI]);
  const openS=useCallback((mode,mi=0)=>{setSelectMode(mode);setActiveMI(mi);},[]);
  const closeS=useCallback(()=>setSelectMode(null),[]);
  const clearSlot=useCallback(()=>updTeam(t=>{t.mons[activeSlot]=null;}),[updTeam,activeSlot]);
  const newTeam=useCallback(()=>{setTeams(prev=>{const t={name:'Untitled',format:'gen9ou',mons:Array(6).fill(null)};setCurIdx(prev.length);return[...prev,t];});setActiveSlot(0);setView('editor');},[]);
  const delTeam=useCallback((idx,e)=>{e.stopPropagation();setTeams(prev=>prev.filter((_,i)=>i!==idx));setCurIdx(c=>Math.max(0,c>idx?c-1:c));},[]);
  const doImport=useCallback(()=>{const mons=importPaste(importTxt);updTeam(t=>{t.mons=[...mons.slice(0,6),...Array(6).fill(null)].slice(0,6);});setShowImport(false);setImportTxt('');},[updTeam,importTxt]);

  const monMoves=useMemo(()=>{
    if(!curMon)return[];let ls=curMon.learnset;
    if(!ls?.length)ls=getPokemonCompleteData(curMon.id)?.learnset||[];
    return ls.map(id=>{const m=Moves[id];return{id,name:m?.name||id,type:m?.type||'???',category:m?.category||'???',basePower:m?.basePower||0,pp:m?.pp||'?'};});
  },[curMon?.id]);

  
  if(view==='list')return <ListScreen teams={teams} onOpen={i=>{setCurIdx(i);setActiveSlot(0);setView('editor');}} onNew={newTeam} onDelete={delTeam}/>;
  if(!curTeam){setView('list');return null;}

  return(
    <div className="ps-teambuilder">
      <EditorNav team={curTeam} activeSlot={activeSlot} onBack={()=>setView('list')}
        onSlot={i=>{setActiveSlot(i);closeS();}} onSelectEmpty={i=>{setActiveSlot(i);openS('pkmn');}}
        onNameChange={v=>updTeam(t=>{t.name=v;})} onFormatChange={v=>updTeam(t=>{t.format=v;})}
        onExport={()=>setShowExport(s=>!s)} onImport={()=>setShowImport(true)}/>

      {showExport&&<ExportBox text={exportPaste(curTeam)} onClose={()=>setShowExport(false)}/>}
      {showImport&&<ImportModal value={importTxt} onChange={setImportTxt} onImport={doImport} onClose={()=>setShowImport(false)}/>}

      <div className="editor-body">
        <div className="editor-left">
          {curMon
            ?<MonEditor mon={curMon} statTab={statTab} setStatTab={setStatTab} onUpdate={updMon} onStat={updStat}
                onSelectPkmn={()=>openS('pkmn')} onSelectMove={i=>openS('move',i)} onClear={clearSlot}/>
            :<div className="empty-slot-box" onClick={()=>openS('pkmn')}><div className="esb-ico">+</div><span>Нажмите для добавления покемона</span></div>
          }
        </div>
        {selectMode&&<SearchPanel mode={selectMode} moveList={monMoves} onClose={closeS} onPickPkmn={pickPkmn} onPickMove={pickMove}/>}
      </div>
    </div>
  );
};

/* ── LIST ───────────────────────────────────────────────────── */
const ListScreen=memo(({teams,onOpen,onNew,onDelete})=>(
  <div className="ps-teambuilder"><div className="list-screen"><div className="list-container">
    <div className="list-header"><h2>Мои команды</h2><button className="ps-btn accent" onClick={onNew}>+ Новая команда</button></div>
    {!teams.length&&<div className="list-empty"><div className="lei">📋</div><p>Команд пока нет</p><button className="ps-btn accent" onClick={onNew}>Создать первую</button></div>}
    {teams.map((t,i)=><TeamRow key={i} team={t} onOpen={()=>onOpen(i)} onDelete={e=>onDelete(i,e)}/>)}
  </div></div></div>
));
const TeamRow=memo(({team,onOpen,onDelete})=>(
  <div className="team-row-card" onClick={onOpen}>
    <div className="trc-l"><span className="fmt-badge">{team.format||'gen9ou'}</span><span className="team-name">{team.name||'Untitled'}</span></div>
    <div className="trc-r">
      <div className="t-icons">{(team.mons||[]).map((m,j)=>m?<img key={j} src={spr(m.name)} onError={mkFb(m.name)} className="t-ico" alt={m.name}/>:<div key={j} className="t-empty"/>)}</div>
      <button className="del-btn" onClick={onDelete}>✕</button>
    </div>
  </div>
));

/* ── EDITOR NAV ─────────────────────────────────────────────── */
const EditorNav=memo(({team,activeSlot,onBack,onSlot,onSelectEmpty,onNameChange,onFormatChange,onExport,onImport})=>(
  <div className="editor-nav">
    <div className="nav-top">
      <button className="back-link" onClick={onBack}>← Команды</button>
      <input className="team-name-input" value={team.name} onChange={e=>onNameChange(e.target.value)} placeholder="Название"/>
      <select className="fmt-sel" value={team.format||'gen9ou'} onChange={e=>onFormatChange(e.target.value)}>
        {FORMATS.map(f=><option key={f} value={f}>{f}</option>)}
      </select>
      <div className="nav-btns">
        <button className="ps-btn sm" onClick={onImport}>⬆ Импорт</button>
        <button className="ps-btn sm" onClick={onExport}>⬇ Экспорт</button>
      </div>
    </div>
    <div className="slot-tabs">
      {(team.mons||[]).map((m,i)=>(
        <button key={i} className={`tab-btn${activeSlot===i?' active':''}${m?'':' empty-tab'}`} onClick={()=>m?onSlot(i):onSelectEmpty(i)}>
          {m?<><img src={spr(m.name)} onError={mkFb(m.name)} className="tab-spr" alt=""/><span className="tab-nm">{m.nickname||m.name}</span></>
            :<span className="tab-empty">+ Слот {i+1}</span>}
        </button>
      ))}
    </div>
  </div>
));

/* ── EXPORT / IMPORT ────────────────────────────────────────── */
const ExportBox=memo(({text,onClose})=>(
  <div className="export-box"><div className="export-hdr"><span>Экспорт Showdown Paste</span><button onClick={onClose}>✕</button></div>
    <textarea readOnly className="paste-ta" value={text}/></div>
));
const ImportModal=memo(({value,onChange,onImport,onClose})=>(
  <div className="modal-overlay" onClick={onClose}><div className="import-modal" onClick={e=>e.stopPropagation()}>
    <h3>Импорт Showdown Paste</h3>
    <textarea className="paste-ta" value={value} onChange={e=>onChange(e.target.value)} placeholder="Вставьте текст команды..."/>
    <div className="modal-btns"><button className="ps-btn accent" onClick={onImport}>Импортировать</button><button className="ps-btn" onClick={onClose}>Отмена</button></div>
  </div></div>
));

/* ── MON EDITOR ─────────────────────────────────────────────── */
const MonEditor=memo(({mon,statTab,setStatTab,onUpdate,onStat,onSelectPkmn,onSelectMove,onClear})=>{
  const clrMv=useCallback(i=>{const m=[...mon.moves];m[i]='';onUpdate('moves',m);},[mon.moves,onUpdate]);
  return(
    <div className="mon-editor">
      <div className="mon-top">
        <div className="mon-spr-col">
          <div className="mon-spr-frame"><img src={spr(mon.name)} onError={mkFb(mon.name)} className="mon-spr" alt={mon.name}/></div>
          <div className="mon-types">{mon.types?.map(t=><span key={t} className="type-pip" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}</div>
          <button className="clear-btn" onClick={onClear}>✕ Убрать</button>
        </div>
        <div className="mon-basic">
          <F label="Никнейм"><input className="ps-input" value={mon.nickname} onChange={e=>onUpdate('nickname',e.target.value)} placeholder={mon.name}/></F>
          <F label="Покемон"><button className="ps-input sel-btn" onClick={onSelectPkmn}>{mon.name}</button></F>
          <F label="Предмет"><input className="ps-input" value={mon.item} onChange={e=>onUpdate('item',e.target.value)} placeholder="Нет"/></F>
          <F label="Способность">
            <select className="ps-input" value={mon.ability} onChange={e=>onUpdate('ability',e.target.value)}>
              {mon.abilities&&Object.entries(mon.abilities).map(([k,v])=><option key={k} value={v}>{v}{k==='H'?' (H)':''}</option>)}
            </select>
          </F>
        </div>
        <div className="mon-details">
          <F label="Уровень"><input type="number" className="ps-input short" value={mon.level} min={1} max={100} onChange={e=>onUpdate('level',Math.max(1,Math.min(100,parseInt(e.target.value)||100)))}/></F>
          <F label="Пол"><select className="ps-input short" value={mon.gender||'M'} onChange={e=>onUpdate('gender',e.target.value)}><option value="M">♂ Муж</option><option value="F">♀ Жен</option><option value="N">— Нет</option></select></F>
          <F label="Блеск"><Toggle checked={!!mon.shiny} onChange={v=>onUpdate('shiny',v)}/></F>
          <F label="Тера-тип"><select className="ps-input" value={mon.teraType||mon.types?.[0]||'Normal'} onChange={e=>onUpdate('teraType',e.target.value)}>{ALL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></F>
        </div>
        <div className="mon-moves-col">
          <div className="moves-lbl">Атаки</div>
          {mon.moves.map((mv,i)=>(
            <button key={i} className={`move-slot${mv?' filled':''}`} onClick={()=>onSelectMove(i)}>
              {mv||<span className="mv-ph">— Атака {i+1}</span>}
              {mv&&<span className="mv-x" onClick={e=>{e.stopPropagation();clrMv(i);}}>✕</span>}
            </button>
          ))}
        </div>
      </div>
      <StatsPanel mon={mon} statTab={statTab} setStatTab={setStatTab} onStat={onStat} onUpdate={onUpdate}/>
    </div>
  );
});

/* ── STATS PANEL ────────────────────────────────────────────── */
const PRESETS=[
  ['Сброс',      evs=>({...evs,...Object.fromEntries(STAT_KEYS.map(s=>[s,0]))})],
  ['Физ стена',  evs=>({...evs,hp:252,def:252})],
  ['Сп стена',   evs=>({...evs,hp:252,spd:252})],
  ['Физ свип',   evs=>({...evs,atk:252,spe:252})],
  ['Сп свип',    evs=>({...evs,spa:252,spe:252})],
  ['Объём свип', evs=>({...evs,hp:252,atk:128,spe:128})],
];

const StatsPanel=memo(({mon,statTab,setStatTab,onStat,onUpdate})=>{
  const nm=NATURE_MODS[mon.nature]||{},evT=sumEVs(mon.evs);
  const applyPreset=useCallback(fn=>{
    const newEvs=fn(mon.evs);STAT_KEYS.forEach(s=>onStat('evs',s,newEvs[s]??0));
  },[mon.evs,onStat]);
  return(
    <div className="stats-area">
      <div className="stats-hdr">
        <div className="nature-wrap">
          <label>Природа</label>
          <select className="ps-input nature-sel" value={mon.nature} onChange={e=>onUpdate('nature',e.target.value)}>
            {ALL_NATURES.map(n=>{const m=NATURE_MODS[n];return<option key={n} value={n}>{n}{m?.plus?` (+${STAT_LABELS[m.plus]} -${STAT_LABELS[m.minus]})`:''}</option>;})}
          </select>
        </div>
        <div className="stat-tabs">
          <button className={`st-tab${statTab==='evs'?' active':''}`} onClick={()=>setStatTab('evs')}>
            EVs <span className={`ev-ctr${evT>508?' over':evT===508?' full':''}`}>{evT}/508</span>
          </button>
          <button className={`st-tab${statTab==='ivs'?' active':''}`} onClick={()=>setStatTab('ivs')}>IVs</button>
        </div>
      </div>
      <table className="stats-tbl"><thead><tr>
        <th className="c-stat">Стат</th><th className="c-base">База</th>
        <th className="c-val">{statTab.toUpperCase()}</th><th className="c-bar"/><th className="c-tot">Итог</th>
      </tr></thead><tbody>
        {STAT_KEYS.map(s=><StatRow key={s} stat={s} mon={mon} nm={nm} statTab={statTab} onStat={onStat}/>)}
      </tbody></table>
      {statTab==='evs'&&<div className="ev-presets"><span className="ep-lbl">Быстро:</span>{PRESETS.map(([l,fn])=><button key={l} className="ep-btn" onClick={()=>applyPreset(fn)}>{l}</button>)}</div>}
    </div>
  );
});

const StatRow=memo(({stat,mon,nm,statTab,onStat})=>{
  const base=mon.baseStats?.[stat]||0,val=mon[statTab][stat];
  const total=calcStat(stat,base,mon.ivs[stat],mon.evs[stat],mon.level,mon.nature);
  const max=statTab==='evs'?252:31,bp=(base/255)*100,ep=(val/max)*100;
  const isP=nm.plus===stat,isM=nm.minus===stat;
  return(
    <tr className="stat-row">
      <td className={`sn${isP?' sp':''}${isM?' sm':''}`}>{STAT_LABELS[stat]}{isP&&<span className="arr">▲</span>}{isM&&<span className="arr">▼</span>}</td>
      <td className="sb">{base}</td>
      <td className="si"><input type="number" min={0} max={max} className="stat-in" value={val} onChange={e=>onStat(statTab,stat,e.target.value)}/></td>
      <td className="sbar">
        <div className="bar-bg"><div className="bar-fill" style={{width:`${bp}%`,background:STAT_COLORS[stat]}}/></div>
        {statTab==='evs'&&<input type="range" min={0} max={252} step={4} value={val} className="ev-slider" onChange={e=>onStat('evs',stat,e.target.value)} style={{'--fill':`${ep}%`,'--clr':STAT_COLORS[stat]}}/>}
      </td>
      <td className={`st${isP?' sp':''}${isM?' sm':''}`}>{total}</td>
    </tr>
  );
});

/* ── SEARCH PANEL ───────────────────────────────────────────── */
const SearchPanel=memo(({mode,moveList,onClose,onPickPkmn,onPickMove})=>{
  const ref=useRef(null);
  const[q,setQ]=useState('');
  const[sKey,setSKey]=useState('num');
  const[sDir,setSDir]=useState(1);
  const[fTier,setFTier]=useState('');
  const[fGen,setFGen]=useState('');
  const[fType,setFType]=useState('');
  const[custom,setCustom]=useState(false);
  const[fCat,setFCat]=useState('');
  const[fMT,setFMT]=useState('');
  const[mSKey,setMSKey]=useState('name');
  const[mSDir,setMSDir]=useState(1);

  useEffect(()=>{ref.current?.focus();},[mode]);

  const togSort=useCallback(key=>{setSKey(p=>{if(p===key){setSDir(d=>d*-1);return key;}setSDir(1);return key;});},[]);
  const togMSort=useCallback(key=>{setMSKey(p=>{if(p===key){setMSDir(d=>d*-1);return key;}setMSDir(1);return key;});},[]);

  const pkmnList=useMemo(()=>{
    const all=getCache(),ql=q.toLowerCase();
    return all.filter(p=>{
      if(ql&&!p.name.toLowerCase().includes(ql))return false;
      if(p.num < 0  || p.num === undefined ) return false;
      const isC=(p.num||0)>1200;
      if(custom&&!isC)return false;
      if(!custom&&isC)return false;
      if(fGen&&String(p.gen)!==fGen)return false;
      if(fTier&&(p.tier||'')!==fTier)return false;
      if(fType&&!p.types?.includes(fType))return false;
      return true;
    }).sort((a,b)=>{
      if(STAT_KEYS.includes(sKey))return sDir*((b.baseStats?.[sKey]||0)-(a.baseStats?.[sKey]||0));
      if(sKey==='bst')return sDir*(b.bst-a.bst);
      if(sKey==='name')return sDir*a.name.localeCompare(b.name);
      return sDir*((b.num||0)-(a.num||0));
    });
  },[q,sKey,sDir,fGen,fTier,fType,custom]);

  const movesFlt=useMemo(()=>{
    const ql=q.toLowerCase();
    return moveList.filter(m=>{
      if(ql&&!m.name.toLowerCase().includes(ql))return false;
      if(fCat&&m.category!==fCat)return false;
      if(fMT&&m.type!==fMT)return false;
      return true;
    }).sort((a,b)=>{
      if(mSKey==='bp')return mSDir*((b.basePower||0)-(a.basePower||0));
      if(mSKey==='pp')return mSDir*((b.pp||0)-(a.pp||0));
      return mSDir*a.name.localeCompare(b.name);
    });
  },[moveList,q,fCat,fMT,mSKey,mSDir]);

  return(
    <div className="search-panel">
      <div className="sp-hdr"><span className="sp-title">{mode==='pkmn'?'🔍 Выбор покемона':'🔍 Выбор атаки'}</span><button className="sp-close" onClick={onClose}>✕</button></div>
      <div className="sp-search"><input ref={ref} className="search-main" placeholder={mode==='pkmn'?'Поиск покемона...':'Поиск атаки...'} value={q} onChange={e=>setQ(e.target.value)}/></div>

      {mode==='pkmn'&&(
        <div className="filter-bar">
          <label className="custom-tog" title="Показать кастомных (num > 1025)">
            <input type="checkbox" checked={custom} onChange={e=>setCustom(e.target.checked)}/>
            <span className="tog-sl"/><span className="tog-txt">★ Custom</span>
          </label>
          <select className="f-sel" value={fGen} onChange={e=>setFGen(e.target.value)}>
            <option value="">Все поколения</option>{GENERATIONS.map(g=><option key={g} value={g}>Gen {g}</option>)}
          </select>
          <select className="f-sel" value={fTier} onChange={e=>setFTier(e.target.value)}>
            <option value="">Все тиры</option>{TIERS.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select className="f-sel" value={fType} onChange={e=>setFType(e.target.value)}>
            <option value="">Все типы</option>{ALL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span className="f-cnt">{pkmnList.length} пок.</span>
        </div>
      )}
      {mode==='move'&&(
        <div className="filter-bar">
          <select className="f-sel" value={fCat} onChange={e=>setFCat(e.target.value)}>
            <option value="">Все категории</option>{MOVE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="f-sel" value={fMT} onChange={e=>setFMT(e.target.value)}>
            <option value="">Все типы</option>{ALL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span className="f-cnt">{movesFlt.length} атак</span>
        </div>
      )}

      {mode==='pkmn'&&<PkmnTable list={pkmnList} sKey={sKey} sDir={sDir} onSort={togSort} onPick={onPickPkmn}/>}
      {mode==='move'&&<MoveTable list={movesFlt} sKey={mSKey} sDir={mSDir} onSort={togMSort} onPick={onPickMove}/>}
    </div>
  );
});

/* ── POKEMON TABLE ──────────────────────────────────────────── */
const PH=[
  {k:'num',l:'#',w:40},{k:'',l:'',w:44},{k:'name',l:'Имя',w:null},
  {k:'',l:'Тип',w:88},{k:'hp',l:'HP',w:36},{k:'atk',l:'Atk',w:36},
  {k:'def',l:'Def',w:36},{k:'spa',l:'SpA',w:36},{k:'spd',l:'SpD',w:36},
  {k:'spe',l:'Spe',w:36},{k:'bst',l:'BST',w:44},{k:'',l:'Тир',w:46},
];

const PkmnTable=memo(({list,sKey,sDir,onSort,onPick})=>{
  const renderRow=useCallback((p,i)=><PkmnRow key={p.id||i} p={p} onPick={onPick}/>,[onPick]);
  return(
    <div className="pkmn-tbl-wrap">
      <div className="pkmn-thead">
        {PH.map((h,i)=>(
          <div key={i} className={`phc${h.k?' sort':''}`} style={{width:h.w||undefined,flex:h.w?'none':1}}
            onClick={h.k?()=>onSort(h.k):undefined}>
            {h.l}{h.k&&sKey===h.k&&<span className="sarr">{sDir===1?'▲':'▼'}</span>}
          </div>
        ))}
      </div>
      <VirtualList items={list} rowH={ROW_H} render={renderRow} height={440}/>
    </div>
  );
});

const PkmnRow=memo(({p,onPick})=>{
  const bs=p.baseStats||{},isC=(p.num||0)>1025;
  return(
    <div className={`pkmn-row${isC?' custom-row':''}`} style={{height:ROW_H}} onClick={()=>onPick(p)}>
      <div className="prc" style={{width:40}}>{p.num||'?'}{isC&&<span className="cstar">★</span>}</div>
      <div className="prc" style={{width:44}}><img src={spr(p.name)} onError={mkFb(p.name)} className="pk-spr" alt=""/></div>
      <div className="prc pk-name" style={{flex:1}}>{p.name}</div>
      <div className="prc" style={{width:88,display:'flex',gap:2,alignItems:'center'}}>
        {(p.types||[]).map(t=><span key={t} className="type-pip sm" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
      </div>
      {STAT_KEYS.map(s=><div key={s} className="prc pk-stat" style={{width:36}}>{bs[s]||'-'}</div>)}
      <div className="prc pk-bst" style={{width:44}}>{p.bst||'-'}</div>
      <div className="prc" style={{width:46}}><span className={`tier-b t-${(p.tier||'').toLowerCase()}`}>{p.tier||''}</span></div>
    </div>
  );
});

/* ── MOVE TABLE ─────────────────────────────────────────────── */
const MH=[{k:'name',l:'Атака'},{k:'',l:'Тип',w:80},{k:'',l:'Кат.',w:76},{k:'bp',l:'BP',w:44},{k:'pp',l:'PP',w:40}];

const MoveTable=memo(({list,sKey,sDir,onSort,onPick})=>(
  <div className="sp-results">
    <div className="move-thead">
      {MH.map((h,i)=>(
        <div key={i} className={`mhc${h.k?' sort':''}`} style={{width:h.w||undefined,flex:h.w?'none':1}}
          onClick={h.k?()=>onSort(h.k):undefined}>
          {h.l}{h.k&&sKey===h.k&&<span className="sarr">{sDir===1?'▲':'▼'}</span>}
        </div>
      ))}
    </div>
    <div className="sp-scroll">
      {list.map(m=><MoveRow key={m.id} m={m} onPick={onPick}/>)}
    </div>
  </div>
));

const MoveRow=memo(({m,onPick})=>(
  <div className="move-row" onClick={()=>onPick(m)}>
    <div className="mrc" style={{flex:1}}>{m.name}</div>
    <div className="mrc" style={{width:80}}><span className="type-pip sm" style={{background:TYPE_COLORS[m.type]||'#777'}}>{m.type}</span></div>
    <div className="mrc" style={{width:76}}><span className={`cat-pip ${(m.category||'').toLowerCase()}`}>{m.category}</span></div>
    <div className="mrc bp" style={{width:44}}>{m.basePower||'—'}</div>
    <div className="mrc" style={{width:40}}>{m.pp||'—'}</div>
  </div>
));

/* ── MICRO ──────────────────────────────────────────────────── */
const F=({label,children})=><div className="field-row"><label>{label}</label>{children}</div>;
const Toggle=memo(({checked,onChange})=>(
  <label className="tog-wrap"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="tog-sl"/></label>
));

export default TeamBuild;
