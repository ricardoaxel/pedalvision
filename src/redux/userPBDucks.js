import {db} from '../firebase';
import update from 'immutability-helper';

//CONSTANTS
const initialData = {
    userPedals:{}
}


const SET_USERPB = 'SET_USERPB'
const SET_MOVEPEDAL = 'MOVE_PEDAL'



//REDUCER
export default function userPBReducer(state = initialData, action){
    switch(action.type){
        case SET_USERPB:
            //These '...' are to get al the elements of the state and the payload at the same time
            console.log(state)
            return {
                ...state,
            userPedals: {...state.userPedals,
                [Math.random().toString(36).substr(2, 9)]: {
                    ...action.payload.newPedal
                }
            }
            }


        case SET_MOVEPEDAL:
            console.log(state)
            const key = action.payload.id;
            return {
                ...state,
                userPedals: {
                    ...state.userPedals,
                    [key]:{
                        ...state.userPedals[key],
                        left: action.payload.left,
                        top: action.payload.top
                    }
                }
            }
             
        default:    
            return state
    }
}

//ACTIONS


//This function is actioned when a pedal is added to the PB
export const setAddPedalToPBAction = (image,width,height) => async(dispatch, getState) => {

    try{
        const newPedal = {
            image,
            width,
            height,
            left: 0,
            top: 0
        }

        dispatch({
            type: SET_USERPB,
            //With this we send all of the data of the PB Collection selected
            payload: {newPedal}
        })
    }
    catch(err){
        console.log(err)
    }
    
}

//THis fucntion is for a pedal is moved
export const setMovePedalAction = (id,left,top) => async(dispatch, getState) => {

    try{
        dispatch({
            type: SET_MOVEPEDAL,
            //With this we send all of the data of the PB Collection selected
            payload: {id,left,top}
            
        })
        
    }
    catch(err){
        console.log(err)
    }
    
}