let GET_POKEMONS = 'GET-POKEMONS'
export let GetPokemons = (data) =>({type:GET_POKEMONS,data:data})



let initialState = {
    data : []
}


const PokemonDataReducer = (state = initialState, action) =>{
    let stateCopy = {
        ...state
    }
    switch(action.type){
        case GET_POKEMONS:
            stateCopy.data = [...action.data]
            return stateCopy
        default:
            return state
    }
}

export default PokemonDataReducer