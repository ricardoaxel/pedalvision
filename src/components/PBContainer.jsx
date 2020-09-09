import React from 'react'
import { useDrop } from 'react-dnd'
import { ItemTypes } from './ItemTypes'
import { PedalContainer } from './PedalContainer'
import {useSelector} from 'react-redux'
import {setMovePedalAction} from '../redux/userPBDucks'
import {useDispatch} from 'react-redux'




export const PBContainer = () => {

  //Getting the actual PB from the store
  const actPedalboard = useSelector(store => store.pedalboard.PBImage)

    const styles = {
      pbContainer: {
          width: "100%",
          height: "1000px",
          backgroundSize: "100%",
          backgroundImage: `url(${actPedalboard})`,
          backgroundRepeat:"no-repeat"
      }
    };

  //Getting the user's actual PB
  const userPB = useSelector(store => store.userPB.userPedals)

  //For Redux
  const dispatch = useDispatch()

  //Pedals movement
  const [, drop] = useDrop({
    accept: ItemTypes.BOX,
    drop(item, monitor) {
      const delta = monitor.getDifferenceFromInitialOffset()
      const left = Math.round(item.left + delta.x)
      const top = Math.round(item.top + delta.y)
      moveBox(item.id, left, top)
      return undefined
    },
  })

//State changes
  const moveBox = (id, left, top) => {  
    dispatch(setMovePedalAction(id,left,top))
  }


  return (
    
    <div ref={drop} style={styles.pbContainer}>
      
      {Object.keys(userPB).map((key) => {
        const { left, top, image, pedalID } = userPB[key]
        
        return (
          
          <PedalContainer
            key={key}
            id={key}
            left={left}
            top={top}
            pedalID={pedalID}
            image= {image}
            hideSourceOnDrag="true"
          >
          </PedalContainer>
        )
      })}
    </div>
  )
} 
export default PBContainer;