import React, { useRef, useCallback, useState, useEffect } from 'react'

// Components
import { Page } from 'react-pdf';

// Libraries
import { useInView } from 'react-intersection-observer'

// props: pageNum, dataURLFormat, width, height
function LoadPage(props) {
    
    const ref = useRef()
    const [inViewRef, inView, entry] = useInView()
    const [oneSecondReached, setOneSecondReached] = useState(false);
    const [pageRendered, setPageRenderd] = useState(false);
    const [fabricRendered, setFabricRendered] = useState(false);

    const [pageLoaded, setPageLoaded] = useState(false);
    const [pageWidth, setPageWidth] = useState(0);
    const [pageHeight, setPageHeight] = useState(0);

    // Use `useCallback` so we don't recreate the function on each render - Could result in infinite loop
    const setRefs = useCallback(
        (node) => {
            // Ref's from useRef needs to have the node assigned to `current`
            ref.current = node
            // Callback refs, like the one from `useInView`, is a function that takes the node as an argument
            inViewRef(node)
        },
        [inViewRef],
    )

    // timeout for the 1 second delay
    // this is for when a user scrolls down the document quickly enough 
    // that it is unneccary to render the pages
    useEffect(() => {
        // clear the timeout so when the person leaves the pages before 1s
        if (entry) {
            entry.target.dataset.visible = inView;
            if (inView && !entry.target.firstChild) {
                setTimeout(() => {
                    if (entry.target.dataset.visible === 'true') {
                        setOneSecondReached(true)
                    }
                }, 1000)
            }
        }

        if (pageLoaded && pageRendered && !fabricRendered) {
            // console.log(pageWidth, pageHeight)
            props.renderFabricCanvas(
                props.pageNum, 
                pageWidth, 
                pageHeight,
                props.socket,
                props.roomCode
            )
            setFabricRendered(true)
        }
    });

    renderFabricCanvas = (pageNum, width, height, socket, roomCode) => {
        let newPageDimensions = this.state.pageDimensions
        newPageDimensions[pageNum - 1] = { 'width': width,  'height': height}
        this.setState({ pageDimensions: newPageDimensions })
        let self = this

        // get the canvas element created by react-pdf
        const pageCanvasWrapperElement = document.getElementsByClassName(`react-pdf__Page ${pageNum}`)[0];
        const pageCanvasElement = pageCanvasWrapperElement.firstElementChild;
        pageCanvasElement.id = pageNum.toString()

        // browser
        // let browserElement = document.getElementById(`browser-${pageNum}`);
        // browserElement.style.backgroundImage = `url(${backgroundImg})`;

        // create fabric canvas element with correct dimensions of the document
        let fabricCanvas = new fabric.Canvas(pageNum.toString(), { width: Math.floor(width), height: Math.floor(height), selection: false });
        // console.log(document.getElementById(pageNum.toString()))
        document.getElementById(pageNum.toString()).fabric = fabricCanvas;

        fabricCanvas.setZoom(this.state.currentZoom)
        fabricCanvas.setWidth(this.state.pageDimensions[pageNum - 1].width * this.state.currentZoom)
        fabricCanvas.setHeight(this.state.pageDimensions[pageNum - 1].height * this.state.currentZoom)


        // if you are joinging and existing room and there are signatures that were already placed
        socket.emit('getCurrentPageSignatures', pageNum, (currentPageSignaturesJSONList) => {
            // Array of JSON -> Array of FabricJS Objects
            fabric.util.enlivenObjects(currentPageSignaturesJSONList, function (signatureObjects) {
                // loop through the array
                signatureObjects.forEach(function (signatureObject) {
                    // add the signature to the page
                    document.getElementById(pageNum.toString()).fabric.add(signatureObject)
                })
            })
        })


        //triggered when mousing over canvas or object
        fabricCanvas.on('mouse:over', function (o) {
            //different conditions for different tools
            //o.target is null when mousing out of canvas
            if (o.target && self.state.mode !== 'select') {
                o.target.hoverCursor = fabricCanvas.defaultCursor;
            } else if (o.target) {
                o.target.hoverCursor = fabricCanvas.hoverCursor;
            }

            if (self.state.mode === 'freedraw') {
                fabricCanvas.isDrawingMode = true;
                fabricCanvas.freeDrawingBrush.width = parseInt(self.state.brushSize);
                let match = self.state.selectedColor.match(/rgba?\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)?(?:, ?(\d(?:\.\d?))\))?/);
                fabricCanvas.freeDrawingBrush.color = `rgb(${match[1]}, ${match[2]}, ${match[3]}, ${self.state.opacity / 100})`;

            }
        });

        //triggered when mousing out of canvas or object
        fabricCanvas.on('mouse:out', function (o) {
            fabricCanvas.isDrawingMode = false;
        });

        //triggers when mouse is clicked down
        fabricCanvas.on('mouse:down', function (o) {
            var pointer = fabricCanvas.getPointer(o.e);
            //add rectangle if highlither tool is used
            if (self.state.mode === 'highlighter') {
                self.setState({
                    isDown: true,
                    origX: pointer.x,
                    origY: pointer.y
                }, () => {
                    let rect = new fabric.Rect({
                        id: nanoid(),
                        left: self.state.origX,
                        top: self.state.origY,
                        originX: 'left',
                        originY: 'top',
                        width: pointer.x - self.state.origX,
                        height: pointer.y - self.state.origY,
                        angle: 0,
                        opacity: self.state.highlighterOpacity / 100,
                        fill: self.state.highlighterFillColor,
                        stroke: self.state.highlighterBorderColor,
                        strokeWidth: parseInt(self.state.highlighterBorderThickness),
                        transparentCorners: false
                    });
                    let obj={owner: self.state.username};
                    rect.set('owner',obj);
                    self.setState({
                        rect: rect,
                        toSend: true
                    }, () => {
                        fabricCanvas.add(rect);

                    })
                });
            }
        });

        //triggers when mouse is moved on canvas
        fabricCanvas.on('mouse:move', function (o) {
            //trigger if left mouse button is pressed
            if (!self.state.isDown) return;
            var pointer = fabricCanvas.getPointer(o.e);
            //resize rectangle if highlighter is selected
            if (self.state.mode === 'highlighter') {
                if (self.state.origX > pointer.x) {
                    self.state.rect.set({ left: Math.abs(pointer.x) });
                }
                if (self.state.origY > pointer.y) {
                    self.state.rect.set({ top: Math.abs(pointer.y) });
                }

                self.state.rect.set({ width: Math.abs(self.state.origX - pointer.x) });
                self.state.rect.set({ height: Math.abs(self.state.origY - pointer.y) });
            }

            fabricCanvas.renderAll();
        });

        //triggers when left mouse button is released
        fabricCanvas.on('mouse:up', function (e) {
            var pointer = fabricCanvas.getPointer(e.e);
            self.setState({ isDown: false });

            if (self.state.mode === 'highlighter') {
                self.state.rect.setCoords();
                const modifiedSignatureObject = self.state.rect;
                const modifiedSignatureObjectJSON = JSON.parse(JSON.stringify(modifiedSignatureObject.toObject(['id', 'owner'])))

                let pageData = {
                    pageNum: pageNum,
                    modifiedSignatureObjectJSON: modifiedSignatureObjectJSON
                }

                socket.emit('editIn', pageData)
            } else if (self.state.mode === 'freedraw') {
                fabricCanvas.isDrawingMode = false;
            } else if (self.state.mode === 'text') {
                self.setState({ toSend: true }, () => {
                    fabricCanvas.add(new fabric.IText('Insert Text', {
                        fontFamily: 'roboto',
                        fontSize: self.state.textFontSize,
                        fill: self.state.textColor,
                        opacity: self.state.textOpacity / 100,
                        left: pointer.x,
                        top: pointer.y,
                        id: nanoid()
                    }));
                    fabricCanvas.renderAll();
                })

                self.setState({ mode: 'select' });
            }

            if (e.target) {
                e.target.lockScalingX = false
                e.target.lockScalingY = false
            }
            if (e.e.target.previousElementSibling !== null) {
                if (self.state.holding) {
                    self.addImage(fabricCanvas, self.state.signatureURL, e.pointer.x, e.pointer.y);
                    self.setState({
                        holding: false,
                        toSend: true
                    });
                }
            }
        });

        fabricCanvas.on('object:selected', function (e) {
            if (self.state.mode !== 'select') {
                fabricCanvas.discardActiveObject().renderAll();
            } else {
                self.setState({currentObjectOwner: e.target.get('owner').owner});
                if (self.state.username !== e.target.get('owner').owner) {
                    e.target.set({'borderColor':'#fbb802','cornerColor':'#fbb802'});
                }
            }


        });

        fabricCanvas.on('selection:updated', function (e) {
            if (self.state.mode !== 'select') {
                fabricCanvas.discardActiveObject().renderAll();
            } else {
                self.setState({currentObjectOwner: e.target.get('owner').owner});
                if (self.state.username !== e.target.get('owner').owner) {
                    e.target.set({'borderColor':'#fbb802','cornerColor':'#fbb802'});
                }
            }


        });

        fabricCanvas.on('before:selection:cleared', function() {
            self.setState({currentObjectOwner: null});
        });

        fabricCanvas.on('object:added', function (e) {
            const newSignatureObject = e.target
            if (!e.target.get('owner')) {
                let obj={owner: self.state.username};
                newSignatureObject.set('owner',obj);
            }
            const newSignatureObjectJSON = JSON.parse(JSON.stringify(newSignatureObject.toObject(['id', 'owner'])))
            let pageData = {
                pageNum: pageNum,
                newSignatureObjectJSON: newSignatureObjectJSON
            }
            if (self.state.toSend) {
                socket.emit('addIn', pageData)
                self.setState({ toSend: false });
            }
        });

        fabricCanvas.on('object:modified', function (e) {
            const modifiedSignatureObject = e.target
            const modifiedSignatureObjectJSON = JSON.parse(JSON.stringify(modifiedSignatureObject.toObject(['id', 'owner'])))

            let pageData = {
                pageNum: pageNum,
                modifiedSignatureObjectJSON: modifiedSignatureObjectJSON
            }

            socket.emit('editIn', pageData)
        });

        fabricCanvas.on('object:moving', function (e) {
            var obj = e.target;

            // if object is too big ignore
            if (obj.getScaledHeight() > obj.canvas.height || obj.getScaledWidth() > obj.canvas.width) {
                return;
            }
            obj.setCoords();
            // top-left  corner
            if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
                obj.top = Math.max(obj.top, obj.top - obj.getBoundingRect().top);
                obj.left = Math.max(obj.left, obj.left - obj.getBoundingRect().left);
            }
            // bot-right corner
            if (obj.getBoundingRect().top + obj.getBoundingRect().height > obj.canvas.height || obj.getBoundingRect().left + obj.getBoundingRect().width > obj.canvas.width) {
                obj.top = Math.min(obj.top, obj.canvas.height - obj.getBoundingRect().height + obj.top - obj.getBoundingRect().top);
                obj.left = Math.min(obj.left, obj.canvas.width - obj.getBoundingRect().width + obj.left - obj.getBoundingRect().left);
            }
        });

        fabricCanvas.on('object:scaling', function (e) {
            var obj = e.target;
            obj.setCoords();

            if (obj.top < 0) {
                obj.lockScalingY = true
                obj.top = 0
            } else if (obj.top + obj.getScaledHeight() > obj.canvas.height) {
                obj.lockScalingY = true
                obj.scaleY = (obj.canvas.height - obj.top) / obj.height
            }

            if (obj.left < 0) {
                obj.lockScalingX = true
                obj.left = 0
            } else if (obj.left + obj.getScaledWidth() > obj.canvas.width) {
                obj.lockScalingX = true
                obj.scaleX = (obj.canvas.width - obj.left) / obj.width
            }
        })

        fabricCanvas.on('object:removed', function (e) {
            const removedSignatureObject = e.target
            const removedSignatureObjectJSON = JSON.parse(JSON.stringify(removedSignatureObject.toObject(['id', 'owner'])))

            let pageData = {
                pageNum: pageNum,
                removedSignatureObjectJSON: removedSignatureObjectJSON
            }

            if (self.state.toSend) {
                socket.emit("deleteIn", pageData)
                self.setState({ toSend: false });
            }

        });

        fabricCanvas.on('text:changed', function (e) {
            const modifiedSignatureObject = e.target
            const modifiedSignatureObjectJSON = JSON.parse(JSON.stringify(modifiedSignatureObject.toObject(['id', 'owner'])))

            let pageData = {
                pageNum: pageNum,
                modifiedSignatureObjectJSON: modifiedSignatureObjectJSON
            }

            socket.emit('editIn', pageData)
        });

        fabricCanvas.on("path:created", function (o) {
            o.path.id = nanoid();
            const newSignatureObject = o.path
            const newSignatureObjectJSON = JSON.parse(JSON.stringify(newSignatureObject.toObject(['id', 'owner'])))
            let pageData = {
                pageNum: pageNum,
                newSignatureObjectJSON: newSignatureObjectJSON
            }

            socket.emit('addIn', pageData);
            self.setState({ toSend: false });
        });

        fabricCanvas.on('selection:created', function (e) {
            for (let i = 1; i <= self.state.numPages; i++) {
                if (i === pageNum) {
                    continue;
                }
                let canvasObject = document.getElementById(i.toString())
                if (canvasObject) {
                    let fabricCanvasObject = canvasObject.fabric
                    fabricCanvasObject.discardActiveObject().renderAll();
                }
            }
        });
    }

    function onPageLoadSuccess(page) {
        setPageWidth(page.view[2])
        setPageHeight(page.view[3])
        setPageLoaded(true)
    }

    return (<div 
                className='page-and-number-container' id={`container-${props.pageNum}`}
                >
                    {
                            (oneSecondReached) 
                        ? 
                            (<div className="father-of-two">
                                {/* PDF CANVAS */}
                                <Page 
                                    scale={props.scale}
                                    pageNumber={props.pageNum}
                                    // renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    className={'lowest-canvas'}
                                />

                                {/* FABRIC CANVAS */}
                                <Page 
                                    scale={1}
                                    pageNumber={props.pageNum}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    className={props.pageNum.toString()}
                                    onLoadSuccess={(page) => onPageLoadSuccess(page)}
                                    onRenderSuccess={() => setPageRenderd(true)}
                                />
                            </div>) 
                        : 
                            <div 
                                className='page-wrapper' id={`wrapper-${props.pageNum}`} 
                                ref={setRefs} />
                    }
                <p className='page-number'>{props.pageNum}</p>
            </div>)
}

export default LoadPage;