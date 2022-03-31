const { Router } = require('express');
const { sign } = require('jsonwebtoken');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');
const GithubUser = require('../models/GithubUser');
const { exchangeCodeForToken, getGithubProfile } = require('../utils/github');
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

module.exports = Router()
  .get('/login', async (req, res) => {
    // TODO: Kick-off the github oauth flow
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}&scope=user&redirect_uri=${process.env.REDIRECT_URI}`);
  })

  .get('/login/callback', async (req, res) => {
    // * TODO:
    // * get code
    const { code } = req.query;

    // * exchange code for token
    const tokenRes = await exchangeCodeForToken(code);

    // * get info from github about user with token
    const info  = await getGithubProfile(tokenRes);
    
    // * get existing user if there is one
    let user = await GithubUser.findByUsername(info.login);
  
    // * if not, create one
    if (!user) {
      user = await GithubUser.insert({
        username: info.login,
        avatar: info.avatar_url,
        email: info.email
      });
    }

    // * create jwt
    const payload = jwt.sign(user.toJSON(), process.env.JWT_SECRET, { expiresIn: 'One Day' });

    // * set cookie and redirect
    res 
      .cookie(process.env.COOKIE_NAME, payload, {
        httpOnly: true,
        maxAge: ONE_DAY_IN_MS
      })
      .redirect('/api/v1/github/dashboard');
  })


  .get('/dashboard', authenticate, async (req, res) => {
    // require req.user
    // get data about user and send it as json
    res.json(req.user);
  })
  .delete('/sessions', (req, res) => {
    res
      .clearCookie(process.env.COOKIE_NAME)
      .json({ success: true, message: 'Signed out successfully!' });
  });
