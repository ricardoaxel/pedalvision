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

        let arrayData = {}
        let arrayDataAux = []
        //IF the values of the pedals are in the local storage we will get them from there
        if(localStorage.getItem("avPedals")){
            arrayDataAux = JSON.parse(localStorage.getItem("avPedals"))
        }

        //IF there are no data on local storage we check on the data base
        else{
            const data = await db.collection('pedals').get()
            arrayDataAux = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
            //Saving in localStorage for future consults
            localStorage.setItem("avPedals",JSON.stringify(arrayDataAux))
        }
        //Searching for the selected pedal data
        arrayData = arrayDataAux.find(sPed => sPed.id === pedal)
          
        dispatch({
            type: SET_PEDAL,
            //With this we send all of the data of the PB Collection selected
            payload: arrayData
            
        })
    }
    catch(err){
        console.log(err)
    }
    
}