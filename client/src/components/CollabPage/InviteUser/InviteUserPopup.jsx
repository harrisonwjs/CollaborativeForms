import React, { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import {CopyToClipboard} from 'react-copy-to-clipboard';
// Components
import Button from 'react-bootstrap/Button'; // open source
import Modal from 'react-bootstrap/Modal'; // open source
import Alert from 'react-bootstrap/Alert'

// Redux
import {
    closeInviteGuestsWindow,
    closeInviteGuestsAlert
} from '../../../actions/roomActions'

const InviteUserPopup = (props) => {

    const [showModal, setShowModal] = useState(props.showInviteGuestsModal)
    const [showAlert, setShowAlert] = useState(props.showInviteGuestAlert)

    useEffect(() => {

    })

    function handleCloseModal() {
        setShowModal(false)
        props.closeInviteGuestsWindow()
    }

    function handleCloseAlert() {
        setShowAlert(false)
        props.closeInviteGuestsAlert()
    }

    return(
        <div>
            <Modal show={props.showInviteGuestsModal} onHide={() => handleCloseModal()}>
                <Modal.Header>
                    <Modal.Title>Invite Others</Modal.Title>
                </Modal.Header>
                <Modal.Body className='modal-body'>
                    <h3>
                        {props.invitationLink}
                    </h3>
                </Modal.Body>
                <Modal.Footer>
                    <CopyToClipboard text={props.invitationLink}>
                        <Button onClick={() => handleCloseModal()}>Copy</Button>
                    </CopyToClipboard>
                </Modal.Footer>
            </ Modal>

            <Alert show={props.showInviteGuestAlert} variant={'danger'}>
                <Alert.Heading>Room Full!</Alert.Heading>
                <p> {props.invitationLink} </p>
                <div className="d-flex justify-content-end">
                    <Button onClick={() => handleCloseAlert()} variant="outline-success">
                        Ok
                    </Button>
                </div>
            </Alert>
        </div>
    )
}

const mapStateToProps = state => ({
    showInviteGuestsModal: state.room.showInviteGuestsModal,
    invitationLink: state.room.invitationLink
})

export default connect(mapStateToProps, {
    closeInviteGuestsWindow,
    closeInviteGuestsAlert
})(InviteUserPopup)