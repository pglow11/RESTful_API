// Express
const express = require('express');
const router = module.exports = express.Router();

// Local modules
const ds = require('../services/datastore');
const datastore = ds.datastore;
const constants = require('../services/constants');

// Routes
const boats = require('./boats')
const loads = require('./loads');
const helpers = require('../services/helpers');


// ----------------- Begin Model Functions ------------------------------------
function saveUser(name, user_id) {
    let key = datastore.key(constants.USER);
    let newUser = {
        name: name,
        user_id: user_id
    };
    const entity = {
        key: key,
        data: newUser
    };
    return datastore.save(entity);
}

async function getUsers() {
    const q = datastore.createQuery(constants.USER)
    const entities = await datastore.runQuery(q)
    return entities[0].map(ds.fromDatastore);
}
// ------------------ End Model Functions -------------------------------------

// ------------------ Start Helper Functions ----------------------------------

// ------------------- End Helper Functions -----------------------------------

// GET / 
router.get('/', (req, res) => {
    context = {}
    context.logStatus = req.oidc.isAuthenticated() ? 'logged in' : 'logged out'
    if (req.oidc.isAuthenticated()) {
        res.redirect('/userinfo')
    } else {
        res.render('index', context);
    }
})

// GET /userinfo
router.get('/userinfo', async (req, res) => {
    // Check if user is already in database using user_id
    const allUsers = await getUsers();
    let userIds = [];
    allUsers.forEach(user => {
        userIds.push(user.user_id);
    });
    if (!helpers.isDuplicateName(userIds, req.oidc.user.sub)) {
        // Save user to database
        await saveUser(req.oidc.user.name, req.oidc.user.sub)
    }
    // Render html page with context object
    context = {};
    context.sub = req.oidc.user.sub;
    context.idToken = req.oidc.idToken;
    res.render('user_info', context);
})

// GET /users
router.get('/users', async (req, res) => {
    if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else {
        const results = await getUsers();
        res.status(200).json(results);
    }
})


router.use('/boats', boats.router);
router.use('/loads', loads.router);
