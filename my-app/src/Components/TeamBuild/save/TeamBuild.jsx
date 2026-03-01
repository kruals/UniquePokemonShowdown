import React, { useState, useEffect, useMemo } from 'react';
import './TeamBuild.css';
import PokemonDex from '../Dex/PokemonDex'; 
import { 
    getAllPokemonsList, 
    getPokemonCompleteData 
} from '../../utils/pokemonData'; 
import { Moves } from '../../Data/moves';

const NATURES = {
    Adamant: { plus: 'atk', minus: 'spa' }, Jolly: { plus: 'spe', minus: 'spa' },
    Timid: { plus: 'spe', minus: 'atk' }, Modest: { plus: 'spa', minus: 'atk' },
    Calm: { plus: 'spd', minus: 'atk' }, Bold: { plus: 'def', minus: 'atk' },
    Serious: { plus: null, minus: null }, Impish: { plus: 'def', minus: 'spa' },
    Careful: { plus: 'spd', minus: 'spa' }
};

const calcStat = (name, base, iv, ev, level, natureName) => {
    const b = parseInt(base) || 0;
    const evVal = parseInt(ev) || 0;
    const ivVal = parseInt(iv) || 0;
    const nature = NATURES[natureName] || NATURES.Serious;
    
    if (name === 'hp') {
        if (b === 1) return 1; 
        return Math.floor(((2 * b + ivVal + Math.floor(evVal / 4)) * level) / 100) + level + 10;
    }
    
    let val = Math.floor(((2 * b + ivVal + Math.floor(evVal / 4)) * level) / 100) + 5;
    if (nature.plus === name) val = Math.floor(val * 1.1);
    if (nature.minus === name) val = Math.floor(val * 0.9);
    return val;
};

const TeamBuild = () => {
    const [view, setView] = useState('list');
    const [teams, setTeams] = useState(() => {
        const saved = localStorage.getItem('ps_teams');
        return saved ? JSON.parse(saved) : [];
    });
    const [curIdx, setCurIdx] = useState(0);
    const [activeSlot, setActiveSlot] = useState(0);
    const [search, setSearch] = useState("");
    const [selectMode, setSelectMode] = useState(null); 
    const [activeMoveIdx, setActiveMoveIdx] = useState(0);
    const [items, setItems] = useState([]);

    useEffect(() => {
        localStorage.setItem('ps_teams', JSON.stringify(teams));
    }, [teams]);

    useEffect(() => {
        fetch('https://pokeapi.co/api/v2/item?limit=1000')
            .then(res => res.json())
            .then(data => setItems(data.results || []))
            .catch(() => setItems([]));
    }, []);

    const curMon = teams[curIdx]?.mons[activeSlot];

    const filteredResults = useMemo(() => {
        const q = search.toLowerCase();
        
        if (selectMode === 'pkmn') {
            return getAllPokemonsList()
                .filter(p => p.name.toLowerCase().includes(q))
                .map(p => {
                    const fullData = getPokemonCompleteData(p.id);
                    return { ...p, ...fullData };
                });
        }

        if (selectMode === 'move' && curMon) {
            // Исправлено: если в curMon нет learnset, подтягиваем его принудительно из базы по id
            let moveList = curMon.learnset;
            if (!moveList || moveList.length === 0) {
                const fullData = getPokemonCompleteData(curMon.id);
                moveList = fullData?.learnset || [];
            }

            return moveList
                .filter(moveId => moveId.toLowerCase().includes(q))
                .map(moveId => {
                    const moveInfo = Moves[moveId];
                    return {
                        id: moveId,
                        name: moveInfo?.name || moveId,
                        type: moveInfo?.type || '???',
                        category: moveInfo?.category || '???',
                        basePower: moveInfo?.basePower || 0
                    };
                });
        }
    
        if (selectMode === 'item') {
            return items.filter(i => i.name.toLowerCase().includes(q));
        }
        
        return [];
    }, [search, selectMode, curMon, items]);
    
    const handlePick = (obj) => {
        const nt = [...teams];
        if (selectMode === 'pkmn') {
            const fullInfo = getPokemonCompleteData(obj.id);
            nt[curIdx].mons[activeSlot] = {
                ...fullInfo, // Здесь разворачиваем и learnset, и baseStats
                nickname: "",
                item: "",
                ability: fullInfo.abilities ? Object.values(fullInfo.abilities)[0] : "None",
                level: 100,
                nature: "Serious",
                moves: ["", "", "", ""],
                evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
                ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
            };
        } else if (selectMode === 'item') {
            nt[curIdx].mons[activeSlot].item = obj.name;
        } else if (selectMode === 'move') {
            // Сохраняем имя для отображения, но можно сохранять и ID
            nt[curIdx].mons[activeSlot].moves[activeMoveIdx] = obj.name;
        }
        setTeams(nt);
        setSelectMode(null);
        setSearch("");
    };

    const updateMon = (key, val) => {
        const nt = [...teams];
        nt[curIdx].mons[activeSlot][key] = val;
        setTeams(nt);
    };

    const updateStat = (type, stat, val) => {
        const nt = [...teams];
        const num = parseInt(val) || 0;
        nt[curIdx].mons[activeSlot][type][stat] = Math.max(0, Math.min(type === 'evs' ? 252 : 31, num));
        setTeams(nt);
    };

    const getSpriteName = (name) => name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

    return (
        <div className="ps-teambuilder dark-theme">
            {view === 'list' ? (
                <div className="list-screen">
                    <div className="list-container">
                        <div className="list-header">
                            <h2>Teams</h2>
                            <button className="ps-btn main" onClick={() => {
                                const newTeam = { name: "New Team", mons: Array(6).fill(null) };
                                setTeams([...teams, newTeam]); 
                                setCurIdx(teams.length); 
                                setView('editor');
                            }}>+ New Team</button>
                        </div>
                        {teams.map((t, idx) => (
                            <div key={idx} className="team-row-card" onClick={() => { setCurIdx(idx); setView('editor'); }}>
                                <span>{t.name}</span>
                                <div className="t-icons">
                                    {t.mons.map((m, i) => m ? (
                                        <img key={i} src={`/image_pokemons/${getSpriteName(m.name)}.png`} 
                                             onError={(e) => e.target.src = `https://play.pokemonshowdown.com/sprites/ani/${m.id}.gif`} alt="" />
                                    ) : (
                                        <div key={i} className="empty-slot-min" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="editor-screen">
                    <div className="editor-nav">
                        <button className="back-link" onClick={() => setView('list')}>&lt; Teams</button>
                        <div className="slot-tabs">
                            {teams[curIdx].mons.map((m, i) => (
                                <button key={i} className={`tab-btn ${activeSlot === i ? 'active' : ''}`} 
                                        onClick={() => {setActiveSlot(i); if(!m) setSelectMode('pkmn');}}>
                                    <span>{m ? m.name : '(empty)'}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {curMon ? (
                        <div className="mon-editor-card">
                            <div className="card-layout">
                                <div className="avatar-side">
                                    <div className="mon-sprite-frame">
                                        <img src={`/image_pokemons/${getSpriteName(curMon.name)}.png`} 
                                             onError={(e) => e.target.src = `https://play.pokemonshowdown.com/sprites/ani/${curMon.id}.gif`} alt="p" />
                                    </div>
                                    <input className="ps-input nick-in" placeholder="Nickname" value={curMon.nickname} onChange={e => updateMon('nickname', e.target.value)} />
                                </div>
                                
                                <div className="main-fields">
                                    <div className="input-group">
                                        <label>Pokémon</label>
                                        <input className="ps-input bold" value={curMon.name} onFocus={() => setSelectMode('pkmn')} readOnly />
                                    </div>
                                    <div className="input-group">
                                        <label>Item</label>
                                        <input className="ps-input" placeholder="None" value={curMon.item} onFocus={() => setSelectMode('item')} readOnly />
                                    </div>
                                    <div className="input-group">
                                        <label>Ability</label>
                                        <select className="ps-input" value={curMon.ability} onChange={e => updateMon('ability', e.target.value)}>
                                            {curMon.abilities && Object.values(curMon.abilities).map((ab, idx) => (
                                                <option key={idx} value={ab}>{ab}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="moves-column">
                                    <label>Moves</label>
                                    {curMon.moves.map((m, i) => (
                                        <div key={i} className="move-input-wrap">
                                            <input className="ps-input" placeholder="-" value={m} onFocus={() => {setSelectMode('move'); setActiveMoveIdx(i);}} readOnly />
                                        </div>
                                    ))}
                                </div>

                                <div className="stats-column">
                                    <div className="nature-row">
                                        <label>Nature: </label>
                                        <select className="ps-input tiny-sel" value={curMon.nature} onChange={e => updateMon('nature', e.target.value)}>
                                            {Object.keys(NATURES).map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                    <table className="stats-grid">
                                        <tbody>
                                            {['hp','atk','def','spa','spd','spe'].map((s) => {
                                                const base = curMon.baseStats?.[s] || 0;
                                                const total = calcStat(s, base, curMon.ivs[s], curMon.evs[s], curMon.level, curMon.nature);
                                                return (
                                                    <tr key={s}>
                                                        <td className="st-name">{s.toUpperCase()}</td>
                                                        <td className="st-base">{base}</td>
                                                        <td><input type="number" className="st-in" value={curMon.evs[s]} onChange={e => updateStat('evs', s, e.target.value)}/></td>
                                                        <td><input type="number" className="st-in" value={curMon.ivs[s]} onChange={e => updateStat('ivs', s, e.target.value)}/></td>
                                                        <td className="st-total">{total}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-notice-box" onClick={() => setSelectMode('pkmn')}>+ Click to select a Pokémon</div>
                    )}

                    {selectMode && (
                        <div className="selection-overlay">
                            <div className="search-header">
                                <input autoFocus className="ps-input search-main" placeholder={`Search ${selectMode}...`} value={search} onChange={e => setSearch(e.target.value)} />
                                <button className="ps-btn" onClick={() => setSelectMode(null)}>Close</button>
                            </div>
                            
                            <div className="dex-table-wrapper">
                                {selectMode === 'pkmn' ? (
                                    <PokemonDex 
                                        pokemons={filteredResults} 
                                        onSelect={handlePick} 
                                    />
                                ) : (
                                    <table className="ps-dex-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                {selectMode === 'move' && <><th>Type</th><th>Cat</th><th>BP</th></>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResults.slice(0, 100).map((res, i) => (
                                                <tr key={i} onClick={() => handlePick(res)}>
                                                    <td className="ent-name">{res.name}</td>
                                                    {selectMode === 'move' && (
                                                        <>
                                                            <td><span className={`type-badge ${res.type?.toLowerCase()}`}>{res.type}</span></td>
                                                            <td>{res.category}</td>
                                                            <td>{res.basePower || '--'}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeamBuild;