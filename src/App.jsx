import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import SearchPB from './components/SearchPB';
import SearchPedal from './components/SearchPedal';
import RegisterPB from './components/RegisterPB';
import Pedalboard from './components/Pedalboard';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

export default function FullWidthGrid() {
  const classes = useStyles();


  return (
    <div className={classes.root}>
      <Grid container spacing={1}>
        <Grid item xs={10}>
          <Paper className={classes.paper}>
            <Pedalboard>
            </Pedalboard>
          </Paper>
        </Grid>
        <Grid item xs={2}>
          <Paper className={classes.paper}>
          <SearchPB/>
          <br/>
          <SearchPedal/> 
          <br/>
          <RegisterPB/>
          </Paper>
          
        </Grid>    
      </Grid>
    </div>
  );
}