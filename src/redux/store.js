import {createStore, combineReducers, compose, applyMiddleware} from 'redux'
import thunk from 'redux-thunk'

import pbReducer from './pbDucks'
import pedalReducer from './pedalDucks';

const rootReducer = combineReducers({
    pedalboard: pbReducer,
    actualPedal: pedalReducer
})

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

export default function generateStore() {
    const store = createStore(rootReducer,composeEnhancers(applyMiddleware(thunk)))
    return store;
}