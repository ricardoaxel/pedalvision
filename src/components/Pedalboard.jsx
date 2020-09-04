import React from 'react';
//useDispatch is for doing the actions and useSelector to read the state
import {useSelector} from 'react-redux'


function SearchPedal() {

  const actPedalboard = useSelector(store => store.pedalboard.PBImage)
  console.log(actPedalboard)

  const styles = {
    pbContainer: {
        width: "100%",
        height: "1000px",
        backgroundSize: "100%",
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
