import React from 'react';
import TextField from '@material-ui/core/TextField';
//useDispatch is for doing the actions and useSelector to read the state
import {useDispatch,useSelector} from 'react-redux'
import {setPBAction} from '../redux/pbDucks'

function SearchPedal() {

  const[value,setValue] = React.useState("");

  const dispatch = useDispatch()

  const handleInputChange = e =>{
    const nvalue = e.target.value;
    setValue(nvalue)
    dispatch(setPBAction(nvalue))
    
  }


  return (
    <form>
      Aqui se escribe el estado a cambiar
        <TextField id="standard-basic" onChange={handleInputChange}  label="Search by name" />
        <br/>
    </form>
  ); 

}

export default SearchPedal;
