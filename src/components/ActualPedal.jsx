import React from 'react'
import {useSelector} from 'react-redux'
//Styles for material UI
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import ReactPlayer from "react-player";
import {useDispatch} from 'react-redux'
import {setAddPedalToPBAction} from '../redux/userPBDucks'


const useStyles = makeStyles({
    root: {
      minWidth: "100%",
    },
    bullet: {
      display: 'inline-block',
      margin: '0 2px',
      transform: 'scale(0.8)',
    },
    title: {
      fontSize: 14,
    },
    pos: {
      marginBottom: 12,
    },
  });



const ActualPedal = () => {

    //THIS SECTION IS FOR GETTING THE INFO OF THE SELECTED PEDAL
    const actPedal = useSelector(store => store.actualPedal)
    
    //For Material UI Styles
    const classes = useStyles();

    //For Redux
    const dispatch = useDispatch()

    const styles = {
        pedalImg: {
            width: "100%"
        },
        video:{
            width: "100%"
        }
    }

    const addPedalToPB = () => {
      dispatch(setAddPedalToPBAction(actPedal.id,actPedal.Image))
    }

    return (
        <div>
            
            { //If there's no pedal, the card is not shown
            actPedal.Name!=="" ? 
            <Card className={classes.root}>
                <CardContent>
                    <Typography className={classes.title} color="textSecondary" gutterBottom>
                    Selected Pedal
                    </Typography>
                    <Typography variant="h5" component="h4">
                    {actPedal.Name}
                    </Typography>
                    <Typography className={classes.pos} color="textSecondary">
                    {actPedal.Brand}
                    </Typography>
                    <img src={actPedal.Image} style={styles.pedalImg} alt=""/>
                    <Typography variant="subtitle2" color="textSecondary">
                    {actPedal.Type}
                    </Typography>
                </CardContent>
                <CardActions style={{justifyContent: 'center'}}>
                    <Button onClick={() => addPedalToPB()} size="large" color="primary" variant="outlined">ADD</Button>
                </CardActions>
                <br/>
                <ReactPlayer url={actPedal.Video} width="100%" height="100%" controls="true"/>
            </Card>
            :
            "No pedal selected yet"
        }
        </div>
    )
}

export default ActualPedal
