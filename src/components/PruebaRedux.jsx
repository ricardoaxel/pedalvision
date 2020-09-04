import React from 'react'

import {useDispatch,useSelector} from 'react-redux'
import {setPBAction} from '../redux/pbDucks'


const PruebaRedux = () => {

    const actPedalboard = useSelector(store => store.pedalboard.pb)
    
    return (
        <div>
            Aqui se debería agregar el state que se ha cambiado:
            {actPedalboard}
        </div>
    )
}

export default PruebaRedux
