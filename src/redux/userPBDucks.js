//This library are for simplifly the process of updating and deleting objects in the state
import { omit } from 'lodash'

//CONSTANTS
const initialData = {
    userPedals:{}
}


const SET_USERPB = 'SET_USERPB'
const SET_MOVEPEDAL = 'SET_MOVEPEDAL'
const SET_DELETEPEDAL = 'SET_DELETEPEDAL'
const SET_LOADPB = 'SET_LOADPB'



//REDUCER
export default function userPBReducer(state = initialData, action){
    switch(action.type){
        case SET_USERPB:
            //These '...' are to get al the elements of the state and the payload at the same time
            return {
                ...state,
            userPedals: {...state.userPedals,
                [Math.random().toString(36).substr(2, 9)]: {
                    ...action.payload.newPedal
                }
            }
            }


        case SET_MOVEPEDAL:
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
        
        case SET_DELETEPEDAL:
            const key2 = action.payload;
            return {
                ...state,
                userPedals: omit(state.userPedals,key2)
            }

        case SET_LOADPB:
            return {
                ...state,
                userPedals: action.payload
            }
             
             
        default:    
            return state
    }
}

//ACTIONS


//This function is actioned when a pedal is added to the PB
export const setAddPedalToPBAction = (image,width,height,pedalID) => async(dispatch, getState) => {

    try{
        const newPedal = {
            image,
            width,
            height,
            left: 0,
            top: 0,
            pedalID
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

//This function is for update the coordenates of pedal that was moved
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

//This function is for remove the pedal for the users PB
export const setDeletePedalAction = (id) => async(dispatch, getState) => {

    try{
        dispatch({
            type: SET_DELETEPEDAL,
            //With this we send all of the data of the PB Collection selected
            payload: id
            
        })
        
    }
    catch(err){
        console.log(err)
    }
    
}

//This function is for changing the state of user's PB to the loaded one
export const setLoadPBAction = (loadedPB) => async(dispatch, getState) => {

    try{
        dispatch({
            type: SET_LOADPB,
            //With this we send all of the data of the PB Collection selected
            payload: loadedPB
            
        })
        
    }
    catch(err){
        console.log(err)
    }
    
}