import React from 'react';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import {db} from '../firebase';
//For redux states
import {useDispatch,useSelector} from 'react-redux'
import {setPBAction} from '../redux/pbDucks'
//Material UI styles
import Button from '@material-ui/core/Button';


function SearchPB() {


  const dispatch = useDispatch()

  //THIS SECTION IS FOR CONSULTING THE DB

  //Seting the state for the actual pedalboard kind
  const [pbs,setPbs] = React.useState([]);

  //Seting the state for the saved PBs finded
  const [savedPBs,setSavedPBs] = React.useState([]);

  React.useEffect(() => {
    //Obtaining the types of PB's that are registered
    const obtenerDatos = async () => {
      try {
        const data = await db.collection('pedalboards').get()
        const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
        setPbs(arrayData)
      } catch (error) {
        console.log(error)
      }
    }
    obtenerDatos() 


    //Setting the state for consulting saved PB's
    const obtainSavedPBs = async () => {
      try {
        const data2 = await db.collection('userPBs').get()
        const arrayData2 = data2.docs.map(doc => ({id:doc.id, ...doc.data()}))
        setSavedPBs(arrayData2)
      } catch (error) {
        console.log(error)
      }
    }
    obtainSavedPBs() 

  },[])



   


  //IN THIS SECTION WE MANAGE THE SELECT OF THE PB
  const [pedalboard, setPedalBoard] = React.useState([]);
  //Here we set the actual state value of the selected pedalboard
  const handleChange = (event) => {
    setPedalBoard(event.target.value);
    dispatch(setPBAction(event.target.value)); 
  };

  //Here we manage the saved PB selected
  const [loadedPB, setLoadedPB] = React.useState([]);
  //Here we set the actual state value of the selected pedalboard
  const handleChangeSPB = (event) => {
    setLoadedPB(event.target.value)
    console.log(loadedPB)

    //dispatch(setPBAction(event.target.value)); 
  };



  //For saving the users pedalboard
  const userPB = useSelector(store => store.userPB.userPedals)

  const savePB = async () => {
    var pbName = prompt("Please enter a name for the PB")
    console.log(pbName,". Pedales:",userPB,"PB",pedalboard)

    const pbToSave = {
      Name: pbName,
      Pedals: userPB,
      Pedalboard: pedalboard,
      User: "default"
    }

    await db.collection('userPBs').add(pbToSave)
  }




  return (
    
  
    <form noValidate autoComplete="off">
      <div>

      {/*Access to previously saved PB's*/ }
        <TextField
          select
          id = "savedPB"
          label="Saved PB's"
          value={loadedPB}
          onChange={handleChangeSPB} 
        >
          
          {savedPBs.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.Name}
            </MenuItem>
          ))}
        </TextField>
        <br/>

      {/*Save actual PB*/ }
        <Button onClick={() => savePB()} size="large" color="primary" variant="outlined">SAVE PB</Button>
      

      {/*Select a kind of PB*/ }
        <TextField
          select
          id = "pbselect"
          label="PedalBoard"
          value={pedalboard}
          onChange={handleChange} 
          helperText="Please select your Pedalboard"
        >
          {pbs.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.PBName}
            </MenuItem>
          ))}
        </TextField>
      </div>
    </form>
    
  );  

  
}

export default SearchPB;
