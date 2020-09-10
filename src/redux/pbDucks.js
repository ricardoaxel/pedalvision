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
            //These '...' are to get al the elements of the state and the payload at the same time
            return {...state,...action.payload}
        default:    
            return state
    }
}


//ACTIONS
export const setPBAction = (pb) => async(dispatch, getState) => {

    try{

        let arrayData = {}
        let arrayDataAux = []
        //IF the values of the pbs are in the local storage we will get them from there
        if(localStorage.getItem("avPBs")){
            arrayDataAux = JSON.parse(localStorage.getItem("avPBs"))
        }
        //If the values of pbs arent in LS there are getting from the DB
        else{
            const data = await db.collection('pedalboards').get()
            arrayDataAux = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
            //Saving in localStorage for future consults
            localStorage.setItem("avPBs",JSON.stringify(arrayDataAux))
        }
        //Searching for the selected PB data
        arrayData = arrayDataAux.find(sPB => sPB.id === pb)
        
        dispatch({
            type: SET_PB,
            //With this we send all of the data of the PB Collection selected
            payload: arrayData
            
        })
    }
    catch(err){
        console.log(err)
    }
    
}
