const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
var cors = require('cors');
// Load input validation
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");
const validateEmailInput = require("../../validation/email");
const validatePasswordInput = require("../../validation/password");

// Load User model
const User = require("../../models/User");

const { transporter, getPasswordResetURL, resetPasswordTemplate } = require('./modules/email');

router.use(cors({
  credentials: true,
  origin: 'http://localhost:3000',
  "Access-Control-Allow-Origin": "http://localhost:3000",
}))

//Check to make sure header is not undefined, if so, return Forbidden (403)
const checkToken = (req, res, next) => {
  const header = req.headers['authorization'];

  if(typeof header !== 'undefined') {
      const bearer = header.split(' ');
      const token = bearer[1];

      req.token = token;
      next();
  } else {
      //If header is undefined return Forbidden (403)
      res.sendStatus(403)
  }
}

//create one time use token that will expire in an hour. token consists of current pw + create date so once pw gets changed the token is no longer valid
const usePasswordHashToMakeToken = ({
  password,
  _id: userId,
  date
}) => {
  // highlight-start
  const secret = password + "-" + date;
  const token = jwt.sign({ userId }, secret, {
    expiresIn: 3600 // 1 hour
  })
  // highlight-end
  return token;
}

// @route POST api/users/register
// @desc Register user
// @access Public
router.post("/register", (req, res) => {
  // Form validation
  const { errors, isValid } = validateRegisterInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } else {
      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
      });
      // Hash password before saving in database
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
      });
    }
  });
});

// @route POST api/users/login
// @desc Login user and return JWT token
// @access Public
router.post("/login", (req, res) => {
    // Form validation
  const { errors, isValid } = validateLoginInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const password = req.body.password;
  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ emailnotfound: "Email not found" });
    }
    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        // Sign token
        jwt.sign(
          payload,
          process.env.JWT_PRIVATE_KEY,
          {
            expiresIn: '24h'
          },
          (err, token) => {
            res.json({
              success: true,
              token: "Bearer " + token
            });
          }
        );
      } else {
        return res
          .status(400)
          .json({ passwordincorrect: "Password incorrect" });
      }
    });
  });
});

//reset password in case the user forgot
router.get("/forgot-password", async (req, res) => {
  const { email } = req.query;
  const { errors, isValid } = validateEmailInput(req.query);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  let user = await User.findOne({ email }).exec();
  if (user === null) {
    return res.status(404).json("No user with that email exists");
  }
  //create one time token
  const token = usePasswordHashToMakeToken(user);
  //craete url containing token, which the  user will use to send back and validate the reset request
  const url = getPasswordResetURL(user, token);
  //formatting for the email
  const emailTemplate = resetPasswordTemplate(user, url);
  //send email to specified address
  const sendEmail = (res) => {
      transporter.sendMail(emailTemplate, (err, info) => {
          if (err) {
          res.status(500).json("Error sending email")
          }
          console.log(`** Email sent **`, info.response)
          res.status(200);
          res.send();
      })
  }
  sendEmail(res);
});

router.post("/new-password", (req, res) => {
  const { userId, token, password } = req.body
  const { errors, isValid } = validatePasswordInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }  
  // highlight-start
  User.findOne({ _id: userId }).then(user => {
      const secret = user.password + "-" + user.createdAt
      const payload = jwt.decode(token, secret)
      if (payload.userId === user.id) {
          bcrypt.genSalt(10, function(err, salt) {
              // Call error-handling middleware:
              if (err) return;
              bcrypt.hash(password, salt, function(err, hash) {
              // Call error-handling middleware:
              if (err) return;
              User.findOneAndUpdate({ _id: userId }, { password: hash })
                  .then(() => res.status(202).json("Password changed accepted"))
                  .catch(err => res.status(500).json(err))
              })
          })
      }
    })
    // highlight-end
    .catch(() => {
    res.status(404).json("Invalid user")
  })
});

router.post("/change-password", checkToken, (req, res) => {
  jwt.verify(req.token, process.env.JWT_PRIVATE_KEY, (err, authorizedData) => {
    if (err) {
        //If error send Forbidden (403)
        console.log('ERROR: Could not connect to the protected route');
        res.sendStatus(403);
    } else {
      const { userId, password, password2, oldPassword } = req.body;

      if (password !== password2) {
        return res
          .status(400)
          .json({ passwordincorrect: "New passwords do not match" });
      } 
      // highlight-start
      User.findOne({ _id: userId }).then(user => {
          if (userId === user.id) {
            bcrypt.compare(oldPassword, user.password).then(isMatch => {
              if (isMatch) {
                // User matched
                bcrypt.genSalt(10, (err, salt) => {
                  bcrypt.hash(password, salt, (err, hash) => {
                    if (err) throw err;
                    user.password = hash;
                    user
                      .save()
                      .then(user => res.send())
                      .catch(err => console.log(err));
                  });
                });
              } else {
                return res
                  .status(400)
                  .json({ passwordincorrect: "Password incorrect" });
              }
            });
          }
        })
        // highlight-end
        .catch(() => {
          res.status(404).json("Invalid user")
        })
      }
    })
});

//get user email
router.get("/get-email", checkToken, async (req, res) => {
  jwt.verify(req.token, process.env.JWT_PRIVATE_KEY, async (err, authorizedData) => {
    if (err) {
        //If error send Forbidden (403)
        console.log('ERROR: Could not connect to the protected route');
        res.sendStatus(403);
    } else {
      const { id } = req.query;
      
      let user = await User.findOne({ id }).exec();
      if (user === null) {
        return res.status(404).json("That user does not exist");
      }

      return res.send(user.email);
    }
  })
});

module.exports = router;