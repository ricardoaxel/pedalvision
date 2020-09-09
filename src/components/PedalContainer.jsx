import React from 'react'
import { useDrag } from 'react-dnd'
import { ItemTypes } from './ItemTypes'
import {useDispatch} from 'react-redux'
import {setPedalAction} from '../redux/pedalDucks'
import {setDeletePedalAction} from '../redux/userPBDucks'
//Material UI
import IconButton from '@material-ui/core/IconButton';
import CancelIcon from '@material-ui/icons/Cancel';


const style = {
  position: 'absolute',
  padding: '0.5rem 1rem',
  cursor: 'move',
  width: "200px",
  height: "300px",
  backgroundSize: "100%",
  backgroundRepeat:"no-repeat"
}



export const PedalContainer = ({ id, left, top, hideSourceOnDrag, children, image, pedalID }) => {

  const dispatch = useDispatch()

  const selectActPedal = () => {
    dispatch(setPedalAction(pedalID))
  }

  const deletePedal = () => {
    dispatch(setDeletePedalAction(id))
  }
  
  const [{ isDragging }, drag] = useDrag({
    
    item: { id, left, top, type: ItemTypes.BOX },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })
  if (isDragging && hideSourceOnDrag) {
    
    return <div ref={drag} />
  }
  return (
    <div onClick={() => selectActPedal()} ref={drag} style={{ ...style, left, top, backgroundImage:`url(${image}` }}>
      <IconButton onClick={() => deletePedal()} style={{position: 'absolute',top: "-5%", left:"80%"}} aria-label="delete">
        <CancelIcon/>
      </IconButton>
    </div>
  )
}