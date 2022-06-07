// Set up for express
const express = require('express');
const app = express();

// Set up for handlebars
const handlebars = require('express-handlebars').create({ defaultLayout: 'main' });
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// Set up 
const { auth } = require('express-openid-connect');

const config = {
    authRequired: false,
    auth0Logout: true,
    baseURL: 'https://portfolio-glowackp.uc.r.appspot.com',
    clientID: 'NuNWPctWh5xuENnGDCEPMCaAlsr5R9dL',
    issuerBaseURL: 'https://cs493-spring2022.us.auth0.com',
    secret: '[insert_secret_here]'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// Routing
app.use('/', require('./api/index'));
app.enable('trust proxy');

//--------------------- ERROR handlers ----------------------------------------

// Basic 404 handler
app.use((req, res) => {
    res.status(404).send('Not Found');
});

app.use((err, req, res, next) => {
    if (err.name === "UnauthorizedError") {
        res.status(401).send({ "Error": "Invalid token" });
    } else {
        next(err);
    }
});

// Basic error handler
app.use((err, req, res, next) => {
    /* jshint unused:false */
    console.error(err);
    // If our routes specified a specific response, then send that. Otherwise,
    // send a generic message so as not to leak anything.
    res.status(500).send(err.response || 'Something broke!');
});
//-----------------------------------------------------------------------------

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
