import React, { useRef, useCallback, useState, useEffect } from 'react'

// Redux
import { connect } from 'react-redux';

import {
    addHighlight,
} from '../../actions/toolActions';

const Highlighter = (props) => {
    let highlights = props.highlightDict[props.pageNum];
    function handleHighlight(e) {
    }

    return (
        <div className='highlighter-layer' id={`highlighter-layer-${props.pageNum}`}>
            {typeof highlights === 'undefined' ? 
            null 
            :
            [...Array(highlights).keys()].map((values, index) =>
                    Object.keys(highlights).map((key) => 
                        <div id={key}>
                            {highlights[key][0].map((dimensions, index2) =>
                                <div className='highlight-box' key={`highlight-${props.pageNum}-${index}-${index2}`} style={{'top': `${dimensions.m_y * props.currentZoom}px`, 'left': `${dimensions.m_x * props.currentZoom}px`, 'width': `${dimensions.m_width * props.currentZoom}px`, 'height': `${dimensions.m_height * props.currentZoom}px`}} onClick={handleHighlight}></div>
                            )}
                        </div>
                    )
            )}
        </div>
    )
}

const mapStateToProps = state => ({
    highlightDict: state.tool.highlightDict,
    currentZoom: state.tool.currentZoom,
})

export default connect(mapStateToProps, {
    addHighlight,
})(Highlighter);