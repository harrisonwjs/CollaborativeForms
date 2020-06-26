import { SET_ZOOM } from '../actions/types'

const initialState = {
    currentZoom: 1
}

export default function(state = initialState, action) {
    switch(action.type) {
        case SET_ZOOM:
            return {
                ...state,
                currentZoom: action.payload
            }
        
        default:
            return state;
    }
}