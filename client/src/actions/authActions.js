import axios from "axios";
import setAuthToken from "../utils/setAuthToken";
import jwt_decode from "jwt-decode";

import {
    GET_ERRORS,
    SET_CURRENT_USER,
    USER_LOADING
} from "./types";

// Register User
export const registerUser = (userData, history) => dispatch => {
    axios.post(`${process.env.REACT_APP_BACKEND_ADDRESS}/api/users/register`, userData)
        .then(res => {
            const container = document.getElementById('sign-in-out-form-container');
            container.classList.remove("right-panel-active")
        }) // re-direct to login on successful register
        .catch(err =>
            dispatch({
                type: GET_ERRORS,
                payload: err.response.data
            })
    );
};

// Login - get user token
export const loginUser = userData => dispatch => {
    axios.post(`${process.env.REACT_APP_BACKEND_ADDRESS}/api/users/login`, userData)
      .then(res => {
        // Save to localStorage

        // Set token to localStorage
        const { token } = res.data;
        localStorage.setItem("jwtToken", token);
        // Set token to Auth header
        setAuthToken(token);
        // Decode token to get user data
        const decoded = jwt_decode(token);
        // Set current user
        dispatch(setCurrentUser(decoded));

        // reset login errors 
        dispatch({
            type: GET_ERRORS,
            payload: {
                email: '',
                emailnotfound: '',
                password: ''
            }
        })
    })
    .catch((err) => {
        dispatch({
            type: GET_ERRORS,
            payload: err.response.data
        })

    }
    );
};

export const setJwtToken = tokenRaw => dispatch => {
    const token = "Bearer " + tokenRaw
    // Set token to localStorage
    localStorage.setItem("jwtToken", token);
    // Set token to Auth header
    setAuthToken(token);
    // Decode token to get user data
    const decoded = jwt_decode(token);
    // Set current user
    dispatch(setCurrentUser(decoded));

    // reset login errors (incase they played around withit )
    dispatch({
        type: GET_ERRORS,
        payload: {
            email: '',
            emailnotfound: '',
            password: ''
        }
    })
}

// Set logged in user
export const setCurrentUser = decoded => {
    return {
        type: SET_CURRENT_USER,
        payload: decoded
    };
};

// User loading
export const setUserLoading = () => {
    return {
        type: USER_LOADING
    };
};

// Log user out
export const logoutUser = () => dispatch => {
    // Remove token from local storage
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("latestInvoiceId");
    localStorage.removeItem("latestInvoicePaymentIntentStatus");

    // Remove auth header for future requests
    setAuthToken(false);
    
    // Set current user to empty object {} which will set isAuthenticated to false
    dispatch(setCurrentUser({}));
};