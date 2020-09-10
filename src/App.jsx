//For Redux
import {Provider} from 'react-redux'
import generateStore from './redux/store'
//For DND
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

//Others
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import SearchPB from './components/SearchPB';
import SearchPedal from './components/SearchPedal';
import ActualPedal from './components/ActualPedal';
import PBContainer from './components/PBContainer';


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


  const store = generateStore() 
  return (
    <Provider store ={store}>
      <div className={classes.root}>
      <Grid container spacing={1}>
        <Grid item xs={9}>
          <Paper className={classes.paper}>
            <h3 style={{textAlign: "left"}}>Pedalboard Planner</h3>
          </Paper>
          <br/>
          <Paper className={classes.paper} >
          <DndProvider backend={HTML5Backend}>
            <PBContainer/>
          </DndProvider>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper className={classes.paper}>
          {/*<SearchPB/>*/}
          <SearchPedal/> 
          <br/>
          <ActualPedal/>
          <br/>
          </Paper> 
        </Grid>    
      </Grid>
      </div>
    </Provider>
  );
}