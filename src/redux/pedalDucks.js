//This file is for managing the current pedal selected by the user
import {db} from '../firebase';

//CONSTANTS
const initialData = {
    id:"",
    Name:"",
    Brand:"",
    Type:"",
    Image:"",
    Video:"",
    Height:"",
    Width:""
}

const SET_PEDAL = 'SET_PEDAL'

//REDUCER
export default function pedalReducer(state = initialData, action){
    switch(action.type){
        case SET_PEDAL:
            //These '...' are to get al the elements of the state and the payload at the same time
            return {...state,...action.payload}
        default:    
            return state
    }
}


//ACTIONS
export const setPedalAction = (pedal) => async(dispatch, getState) => {

    try{

        const data = await db.collection('pedals').where('__name__',"==",pedal).get()
        console.log("Reading actual Pedal")
        const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
        console.log(arrayData[0].Name)
        
        dispatch({
            type: SET_PEDAL,
            //With this we send all of the data of the PB Collection selected
            payload: arrayData[0]
            
        })
    }
    catch(err){
        console.log(err)
    }
    
}