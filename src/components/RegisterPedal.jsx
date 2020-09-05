import React, {useState} from 'react';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import {db} from '../firebase';

function RegisterPedal() {

  
  const addPedal = async (vals) => {

    try{
      await db.collection('pedals').add(vals)
      console.log("New pedal registered");
    }
    catch(error){
      console.log("error")
    }
 
  }

  const initialStateValues = {
    Name: '',
    Brand: '',
    Width: '',
    Height: '',
    Image: '',
    Type: '',
    Video: ''
  }

  const [values, setValues] = useState(initialStateValues);

  const handleInputChange = e =>{
    const {name,value} = e.target;
    setValues({...values,[name]:value})
  }

  const handleSubmit = e =>{
    e.preventDefault();
    addPedal(values);
    //console.log(values);
    setValues({...initialStateValues})
  }

  return (
    <form onSubmit={handleSubmit}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <h3>Register Pedal</h3>
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.Name} onChange={handleInputChange} id="standard-basic" label="Name" name ="Name" />
          </Grid>
          <Grid item xs={6}>
          <TextField value= {values.Type} onChange={handleInputChange} id="standard-basic" label="Type" name ="Type"/>
          </Grid>
          <Grid item xs={6}>
          <TextField value= {values.Brand} onChange={handleInputChange} id="standard-basic" label="Brand" name ="Brand"/>
          </Grid>
          <Grid item xs={6}>
          <TextField value= {values.Width} onChange={handleInputChange} id="standard-basic" label="Width (in)" name ="Width" />
          </Grid>
          <Grid item xs={6}>
            <TextField value= {values.Height} onChange={handleInputChange} id="standard-basic" label="Height (in)" name ="Height" />
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.Image} onChange={handleInputChange} id="standard-basic" label="Image" name ="Image"/>
          </Grid>
          <Grid item xs={12}>
          <TextField value= {values.Video} onChange={handleInputChange} id="standard-basic" label="Video URL" name ="Video"/>
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="outlined">Register</Button>
          </Grid>
        </Grid>
        
    </form>
  );  
}

export default RegisterPedal;
