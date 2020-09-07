import {db} from '../firebase';

//CONSTANTS
const initialData = {
    userPedals:[]
}


const SET_USERPB = 'SET_USERPB'



//REDUCER
export default function userPBReducer(state = initialData, action){
    switch(action.type){
        case SET_USERPB:
            //These '...' are to get al the elements of the state and the payload at the same time
            return {...state,...action.payload}
        default:    
            return state
    }
}

//ACTIONS
export const setAddPedalToPBAction = (id,image) => async(dispatch, getState) => {

    try{

        //const data = await db.collection('pedalboards').where('__name__',"==",pb).get()
        //console.log("Reading actual PedalBoard")
        //const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
        //console.log(arrayData[0].PBName)
        const newPedal = {
            pedalID: id,
            pedalImg: image,
            left: 0,
            top: 0
        }

        const allPedals = getState().userPB.userPedals;

        console.log("estateactual",allPedals);
        console.log(newPedal);
        
        dispatch({
            type: SET_USERPB,
            //With this we send all of the data of the PB Collection selected
            payload: {
                userPedals: [...allPedals,{
                        pedalID: id,
                        pedalImg: image,
                        left: 0,
                        top: 0
                    }
                ]
            }
        })
    }
    catch(err){
        console.log(err)
    }
    
}


/*
Pid:"",
    left:"",
    top:"",*/