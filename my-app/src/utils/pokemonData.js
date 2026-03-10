import {Pokedex} from '../Data/pokedex'
import {FormatsData} from '../Data/formats-data'
import {Learnsets} from '../Data/learnsets'


export const getPokemonCompleteData = (id) => {
    if (!id) return null;
    // Приводим ID к нижнему регистру без спецсимволов, как это обычно в данных Showdown
    const safeId = id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pokemon = Pokedex[id] || Pokedex[safeId]; 
    
    if (!pokemon) return null;

    const learnsetData = Learnsets[safeId] || Learnsets[id];
    
    const moves = (learnsetData && learnsetData.learnset) 
        ? Object.keys(learnsetData.learnset) 
        : [];

    return {
        ...pokemon,
        id: id,
        learnset: moves // Проверь, что это попадает сюда!
    };
};

export const getAllPokemonsList = () => {
    return Object.keys(Pokedex).map(id => ({
        id: id,
        ...Pokedex[id]
    }));
};