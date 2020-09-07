import React, { useState } from 'react'
import { useDrop } from 'react-dnd'
import { ItemTypes } from './ItemTypes'
import { PedalContainer } from './PedalContainer'
import update from 'immutability-helper'
const styles = {
  width: 300,
  height: 300,
  border: '1px solid black',
  position: 'relative',
}
export const PBContainer = () => {
  const [boxes, setBoxes] = useState({
    a: { top: 20, left: 80, title: 'Drag me around', image:"https://www.adslzone.net/app/uploads-adslzone.net/2019/04/borrar-fondo-imagen-800x419.jpg" },
    b: { top: 180, left: 20, title: 'Drag me too', image:"https://scontent.fmex10-1.fna.fbcdn.net/v/t1.15752-0/p280x280/118779644_305367300554341_7688996235444697364_n.jpg?_nc_cat=104&_nc_sid=b96e70&_nc_eui2=AeEDrYM0OUKt9u9vE5D-MKVRqlv6BFADXFSqW_oEUANcVD7112kCtDYb4pBZry4ksycciYh3DaZcGgp5mj72_aDo&_nc_ohc=5czP0AS_SE8AX8UjLsd&_nc_ht=scontent.fmex10-1.fna&tp=6&oh=845f271e223bf38b631831d8f2d30df7&oe=5F7C6550" },
  })
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
  const moveBox = (id, left, top) => {
    setBoxes(
      update(boxes, {
        [id]: {
          $merge: { left, top },
        },
      }),
    )
  }
  return (
    <div ref={drop} style={styles}>
      {Object.keys(boxes).map((key) => {
        const { left, top, title, image } = boxes[key]
        return (
          <PedalContainer
            key={key}
            id={key}
            left={left}
            top={top}
            image= {image}
          >
            {title}
          </PedalContainer>
        )
      })}
    </div>
  )
} 
export default PBContainer;