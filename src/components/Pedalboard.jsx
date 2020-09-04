import React from 'react';
import TextField from '@material-ui/core/TextField';
//useDispatch is for doing the actions and useSelector to read the state
import {useDispatch,useSelector} from 'react-redux'




function SearchPedal() {

  const actPedalboard = useSelector(store => store.pedalboard.PBImage)
  console.log(actPedalboard)

  const styles = {
    pbContainer: {
        width: "auto",
        height: "200px",
        backgroundSize: "cover",
        backgroundImage: `url(${actPedalboard})`,
        backgroundRepeat:"no-repeat"
    }
  };

  return (
    <div style={styles.pbContainer}>
      
    </div>
  ); 

}

export default SearchPedal;
