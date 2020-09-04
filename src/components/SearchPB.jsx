import React from 'react';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import {db} from '../firebase';


function SearchPB() {


//THIS SECTION IS FOR CONSULTING THE DB
  //Seting the state for the actual pedalboards
  const [pbs,setPbs] = React.useState([]);

  React.useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const data = await db.collection('pedalboards').get()
        console.log("asdsad")
        const arrayData = data.docs.map(doc => ({id:doc.id, ...doc.data()}))
        console.log(arrayData)
        setPbs(arrayData)
      } catch (error) {
        console.log(error)
      }
    }

    obtenerDatos()
    
  },[])





//IN THIS SECTION WE MANAGE THE SELECT OF THE PB
  const [pedalboard, setPedalBoard] = React.useState([]);
  //Here we set the actual state value of the selected pedalboard
  const handleChange = (event) => {
    setPedalBoard(event.target.value);
  };

  return (
  
    <form noValidate autoComplete="off">
      <div>

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