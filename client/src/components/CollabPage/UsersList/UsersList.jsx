import React, { useState, useEffect } from 'react'

// Libraries
import axios from 'axios'

// Redux
import { connect } from 'react-redux';

// Components
// import Dropdown from 'react-bootstrap/Dropdown';
// import Badge from 'react-bootstrap/Badge';
// import { Dropdown } from 'semantic-ui-react'
import Dropdown from 'react-bootstrap/Dropdown';

import usersImg from './users.png'

const DropDownButtonImage = React.forwardRef(({ children, onClick }, ref) => (
  <div ref={ref}
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }} 
    className="tool">
    <img src={usersImg}/>
  </div>
))

const UsersList = (props) => {
    const avatarImages = [
      'ade.jpg',
      'chris.jpg',
      'christian.jpg',
      'daniel.jpg',
      'elliot.jpg',
      'helen.jpg',
      'jenny.jpg',
      'joe.jpg',
      'justen.jpg',
      'laura.jpg',
      'lena.png',
      'lindsay.png',
      'mark.png',
      'matt.jpg',
      'matthew.png',
      'molly.png',
      'nan.jpg',
      'nom.jpg',
      'rachel.png',
      'steve.jpg',
      'stevie.jpg',
      'tom.jpg',
      'veronika.jpg',
      'zoe.jpg'
    ]
    const avatarImageURL = 'https://react.semantic-ui.com/images/avatar/small/'

    return (
        <Dropdown alignRight>
            <Dropdown.Toggle 
              as={DropDownButtonImage} 
              key="users-list-dropdown-toggle"></Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Header>Host</Dropdown.Header>
                <Dropdown.Item>
                  <img src={avatarImageURL+avatarImages[Math.floor(Math.random()*avatarImages.length)]} className="user-list-img"/>
                  {props.hostName}
                </Dropdown.Item>

              <Dropdown.Header>Guests</Dropdown.Header>
              {props.guests.map((guestName, i) => (
                <Dropdown.Item key={`user-${i}`}>
                  <img src={avatarImageURL+avatarImages[Math.floor(Math.random()*avatarImages.length)]} className="user-list-img"/>
                  {guestName}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
        </Dropdown>
    )
}

const mapStateToProps = state => ({
    // room
    roomCode: state.room.roomCode,
    guests: state.room.guests,
    hostName: state.room.hostName,
})

export default connect(mapStateToProps ,{
    
})(UsersList);