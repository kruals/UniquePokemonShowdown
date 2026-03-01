import React, { useState, useMemo } from 'react';
import './PokemonDex.css';

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

const PokemonDex = ({ pokemons = [], onSelect }) => {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [customOnly, setCustomOnly] = useState(false); // Состояние для кастомных покемонов
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' }); // Настройка сортировки

    // Функция для переключения сортировки
    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const filtered = useMemo(() => {
        let list = Array.isArray(pokemons) ? [...pokemons] : [];

        // 1. Фильтрация
        list = list.filter(p => {
            if (!p) return false;
            const matchesName = p.name?.toLowerCase().includes(search.toLowerCase());
            const matchesType = typeFilter ? p.types?.includes(typeFilter) : true;
            const matchesCustom = customOnly ? p.num === 1000 : true;
            return matchesName && matchesType && matchesCustom;
        });

        // 2. Сортировка
        if (sortConfig.key) {
            list.sort((a, b) => {
                const getVal = (mon) => {
                    const s = mon.baseStats || {};
                    if (sortConfig.key === 'bst') {
                        return (s.hp || 0) + (s.atk || 0) + (s.def || 0) + (s.spa || 0) + (s.spd || 0) + (s.spe || 0);
                    }
                    if (sortConfig.key === 'name') return mon.name.toLowerCase();
                    return s[sortConfig.key] || 0;
                };

                const valA = getVal(a);
                const valB = getVal(b);

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return list.slice(0, 100); 
    }, [search, typeFilter, customOnly, sortConfig, pokemons]);

    // Вспомогательный компонент для стрелочек сортировки
    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return "";
        return sortConfig.direction === 'asc' ? " ▴" : " ▾";
    };

    return (
        <div className="dex-container">
            <div className="dex-filter-panel">
                <div className="filter-row">
                    <input className="ps-input" placeholder="Search Pokemon..." value={search} onChange={e => setSearch(e.target.value)} />
                    
                    <select className="ps-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="">All Types</option>
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <label className="custom-filter-label">
                        <input 
                            type="checkbox" 
                            checked={customOnly} 
                            onChange={e => setCustomOnly(e.target.checked)} 
                        />
                        Custom Only
                    </label>
                </div>
            </div>

            <div className="dex-table-wrapper">
                <table className="ps-table">
                    <thead>
                        <tr>
                            <th className="sortable" onClick={() => requestSort('name')} style={{textAlign:'left'}}>
                                Pokemon{getSortIndicator('name')}
                            </th>
                            <th>Types</th>
                            <th className="sortable" onClick={() => requestSort('hp')}>HP{getSortIndicator('hp')}</th>
                            <th className="sortable" onClick={() => requestSort('atk')}>Atk{getSortIndicator('atk')}</th>
                            <th className="sortable" onClick={() => requestSort('def')}>Def{getSortIndicator('def')}</th>
                            <th className="sortable" onClick={() => requestSort('spa')}>SpA{getSortIndicator('spa')}</th>
                            <th className="sortable" onClick={() => requestSort('spd')}>SpD{getSortIndicator('spd')}</th>
                            <th className="sortable" onClick={() => requestSort('spe')}>Spe{getSortIndicator('spe')}</th>
                            <th className="sortable" onClick={() => requestSort('bst')}>BST{getSortIndicator('bst')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => {
                            const s = p.baseStats || {};
                            const bst = (s.hp||0) + (s.atk||0) + (s.def||0) + (s.spa||0) + (s.spd||0) + (s.spe||0);
                            const idName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');

                            return (
                                <tr key={p.id} onClick={() => onSelect(p)} className="dex-tr">
                                    <td className="mon-cell">
                                        <div className="mon-info-wrapper">
                                            <img 
                                                className="dex-sprite"
                                                src={`/image_pokemons/${idName}.png`} 
                                                onError={(e) => e.target.src = `https://play.pokemonshowdown.com/sprites/ani/${idName}.gif`}
                                                alt="" 
                                            />
                                            <span className="mon-name">{p.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="type-badges">
                                            {p.types?.map(t => <span key={t} className={`type-badge ${t.toLowerCase()}`}>{t}</span>)}
                                        </div>
                                    </td>
                                    <td>{s.hp}</td><td>{s.atk}</td><td>{s.def}</td><td>{s.spa}</td><td>{s.spd}</td><td>{s.spe}</td>
                                    <td className="bst-val"><strong>{bst}</strong></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PokemonDex;