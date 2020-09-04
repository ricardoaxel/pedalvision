import {db} from '../firebase';

//CONSTANTS
const initialData = {
    id:"",
    PBName:"",
    PBBrand:"",
    PBImage:"",
    PBHeight:"",
    PBWidth:""
}

const SET_PB = 'SET_PB'

//REDUCER
export default function pbReducer(state = initialData, action){
    switch(action.type){
        case SET_PB:
            //These '...' are to get al the elements of the state and the payload at the same
            return {...state,...action.payload}
        default:    
            return state
    }
}


//ACTIONS
export const setPBAction = (pb) => async(dispatch, getState) => {

    try{

        const data = await db.collection('pedalboards').where('__name__',"==",pb).get()
        console.log("Leyendo PB ACT")
        const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
        //console.log(arrayData[0].PBName)
        
        dispatch({
            type: SET_PB,
            //With this we send all of the data of the PB Collection selected
            payload: arrayData[0]
            
        })
    }
    catch(err){
        console.log(err)
    }
    
}
