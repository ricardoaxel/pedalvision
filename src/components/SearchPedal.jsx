import React from 'react';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import {db} from '../firebase';
//For redux states
import {useDispatch} from 'react-redux'
import {setPedalAction} from '../redux/pedalDucks'


function SearchPedal() {


//THIS SECTION IS FOR CONSULTING THE DB
  //Seting the state for the finded pedals
  const dispatch = useDispatch()
  const [pedals,setPedals] = React.useState([]);

  React.useEffect(() => {
    
  //If the page was previously consulted
    if(localStorage.getItem("avPedals")){
      setPedals(JSON.parse(localStorage.getItem("avPedals")))
    }
    else{
      const obtenerDatos = async () => {
        try {
          const data = await db.collection('pedals').get()
          const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
          setPedals(arrayData)
          //Saving in localStorage for avoiding future extra consults
          localStorage.setItem("avPedals",JSON.stringify(arrayData))
  
        } catch (error) {
          console.log(error)
        }
      }
      obtenerDatos()
    }
     
  },[])


//IN THIS SECTION WE MANAGE THE SELECTION OF THE PEDAL
  const [selPedal, setSelPedal] = React.useState([]);
  //Here we set the actual selected pedal
  const handleChange = (event) => {
    setSelPedal(event.target.value);
    dispatch(setPedalAction(event.target.value)); 
  };


  return (
  
    <form noValidate autoComplete="off">
      <div>

        <TextField
          select
          id = "pbselect"
          label="Pedal"
          value={selPedal}
          onChange={handleChange} 
          helperText="Please select a pedal"
        >
          {pedals.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.Name}
            </MenuItem>
          ))}
        </TextField>


      </div>
    </form>
    
  );  

  
}

export default SearchPedal;
