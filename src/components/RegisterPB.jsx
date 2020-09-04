import React, {useState} from 'react';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import {db} from '../firebase';

function RegisterPB() {

  
  const addPB = async (vals) => {

    try{
      await db.collection('pedalboards').add(vals)
      console.log("Nueva PB agregada");
    }
    catch(error){
      console.log("error")
    }
 
  }

  const initialStateValues = {
    PBName: '',
    PBBrand: '',
    PBWidth: '',
    PBHeight: '',
    PBImage: ''
  }

  const [values, setValues] = useState(initialStateValues);

  const handleInputChange = e =>{
    const {name,value} = e.target;
    setValues({...values,[name]:value})
  }

  const handleSubmit = e =>{
    e.preventDefault();
    addPB(values);
    //console.log(values);
    setValues({...initialStateValues})
  }

  return (
    <form onSubmit={handleSubmit}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <h3>Register PB</h3>
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.PBName} onChange={handleInputChange} id="standard-basic" label="Name" name ="PBName" />
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.PBbrand} onChange={handleInputChange} id="standard-basic" label="Brand" name ="PBBrand"/>
          </Grid>
          <Grid item xs={6}>
          <TextField value= {values.PBWidth} onChange={handleInputChange} id="standard-basic" label="Width (in)" name ="PBWidth" />
          </Grid>
          <Grid item xs={6}>
            <TextField value= {values.PBHeight} onChange={handleInputChange} id="standard-basic" label="Height (in)" name ="PBHeight" />
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.PBImage} onChange={handleInputChange} id="standard-basic" label="Image" name ="PBImage"/>
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="outlined">Default</Button>
          </Grid>
        </Grid>
        
    </form>
  );  
}

export default RegisterPB;
