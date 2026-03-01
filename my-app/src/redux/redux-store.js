import { combineReducers, legacy_createStore as createStore} from "redux";
import PokemonDataReducer from "./PokemonData-reducer";

let reducers = combineReducers({
    PokemonDataReducer,
})

let store = createStore(reducers)

window.store = store

export default store