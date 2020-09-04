//Constants
const initialData = {
    pb : ""
}

const SET_PB = 'SET_PB'
//Reducer
export default function pbReducer(state = initialData, action){
    switch(action.type){
        case SET_PB:
            return {pb:action.payload}
        default:    
            return state
    }
}


//Actions
export const setPBAction = (pb) => (dispatch, getState) => {
    dispatch({
        type: SET_PB,
        payload: pb
    })
}
