// Express
const express = require('express');
const router = express.Router();

// Misc modules
const bodyParser = require('body-parser');
router.use(bodyParser.json());

// Express-JWT
var { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');

// Local modules
const ds = require('../services/datastore');
const constants = require('../services/constants');
const helpers = require('../services/helpers');
const loads = require('./loads');

// Assign variables
const datastore = ds.datastore;
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${constants.DOMAIN}/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer.
    issuer: `https://${constants.DOMAIN}/`,
    algorithms: ['RS256']
});

// ----------------- Begin Model Functions ------------------------------------
async function postBoat(name, type, length, owner) {
    let key = datastore.key(constants.BOAT);
    let newBoat = {
        "name": name,
        "type": type,
        "length": length,
        "owner": owner,
        "loads": []
    };
    const entity = {
        key: key,
        data: newBoat
    };
    await datastore.save(entity);
    return key;
}

async function getBoat(boat_id) {
    const key = datastore.key([constants.BOAT, parseInt(boat_id, 10)]);
    const entity = await datastore.get(key);
    if (entity[0] === undefined || entity[0] === null) {
        // No entity found. Don't try to add the id attribute
        return entity;
    } else {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array entity
        return entity.map(ds.fromDatastore);
    }
}

async function putLoad(boat_id, load_id) {
    const boat_key = datastore.key([constants.BOAT, parseInt(boat_id, 10)]);
    const boat = await datastore.get(boat_key);
    boat[0].loads.push({ "id": parseInt(load_id, 10) });
    const entity = {
        key: boat_key,
        data: boat[0]
    };
    return datastore.save(entity);
}

function removeLoad(boat, load_id) {
    const boat_key = datastore.key([constants.BOAT, parseInt(boat.id, 10)]);
    const index = boat.loads.findIndex((load) => load.id === load_id);
    boat.loads.splice(index, 1);
    const entity = {
        key: boat_key,
        data: boat
    };
    return datastore.save(entity);
}

function deleteBoat(boat_id) {
    const boat_key = datastore.key([constants.BOAT, boat_id]);
    return datastore.delete(boat_key);
}

async function getAllBoats(req, owner) {
    let q = datastore.createQuery(constants.BOAT).filter('owner', '=', owner).limit(5);
    const results = {};
    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    const entities = await datastore.runQuery(q)
    results.boats = entities[0].map(ds.fromDatastore);
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
        results.next = helpers.createNext(req, entities[1].endCursor);
    }
    return results;

}

async function getBoatCount(owner) {
    let q = datastore.createQuery(constants.BOAT).filter('owner', '=', owner);
    const entities = await datastore.runQuery(q)
    return entities[0].length;
}

function putBoat(id, name, type, length, owner) {
    const key = datastore.key([constants.BOAT, parseInt(id, 10)]);
    let updatedBoat = {
        "name": name,
        "type": type,
        "length": length,
        "owner": owner,
        "loads": []
    };
    const entity = {
        key: key,
        data: updatedBoat
    };
    return datastore.save(entity);
}

async function patchBoat(id, name, type, length) {
    const key = datastore.key([constants.BOAT, parseInt(id, 10)]);
    let boat = await getBoat(parseInt(id, 10));
    if (name != null || typeof (name) !== 'undefined') {
        boat[0].name = name;
    }
    if (type != null || typeof (type) !== 'undefined') {
        boat[0].type = type;
    }
    if (length != null || typeof (length) !== 'undefined') {
        boat[0].length = length;
    }
    const entity = {
        key: key,
        data: boat[0]
    };
    return datastore.save(entity);
}

// ------------------ End Model Functions -------------------------------------

// ------------------ Start Helper Functions ----------------------------------
function addSelfToLoads(req, loadArray) {
    if (!helpers.isArrayEmpty(loadArray)) {
        loadArray.forEach((load) => {
            load.self = helpers.createSelfLoad(req, load.id)
        })
    }
}

function isLoadAssigned(boat, load_id) {
    if (boat.loads.findIndex((load) => load.id === load_id) < 0) {
        return false;
    } else {
        return true;
    }
}
// ------------------- End Helper Functions -----------------------------------

// ----------------- Begin Controller Functions -------------------------------
// POST /boats
router.post('/', checkJwt, async (req, res) => {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).json({ 'Error': 'Server only accepts application/json data.' });
    } else if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else if (!helpers.isInputValid(req)) {
        res.status(400).json({ 'Error': 'Request has invalid data.' });
    } else {
        const key = await postBoat(req.body.name, req.body.type, req.body.length, req.auth.sub);
        const boat = await getBoat(key.id);
        boat[0].self = helpers.createSelf(req, key.id)
        res.status(201).json(boat[0]);
    }
});

// GET /boats
router.get('/', checkJwt, async (req, res) => {
    if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else {
        const results = await getAllBoats(req, req.auth.sub);
        // Add self url to all boats
        results.boats.forEach((boat) => {
            addSelfToLoads(req, boat.loads);
            boat.self = helpers.createSelf(req, boat.id);
        })
        results.total_items = await getBoatCount(req.auth.sub);
        res.status(200).json(results);
    }
});

// GET /boats/:boat_id
router.get('/:boat_id', checkJwt, async (req, res) => {
    const boat = await getBoat(req.params.boat_id);
    if (helpers.isArrayEmpty(boat)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    } else if (!req.accepts('application/json')) {
        res.status(406).json({ 'Error': 'Server only sends application/json or text/html data.' });
    } else {
        // Add self url to all loads
        addSelfToLoads(req, boat[0].loads);
        boat[0].self = helpers.createSelf(req, req.params.boat_id)
        res.status(200).json(boat[0]);
    }
});

// GET /boats/:boat_id/loads
router.get('/:boat_id/loads', async (req, res) => {
    const boat = await getBoat(req.params.boat_id);
    const loadsObj = {};
    if (helpers.isArrayEmpty(boat)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
    } else if (boat[0].loads.length === 0) {
        res.status(200).json([])
    } else {
        const loadKeys = boat[0].loads.map((load) => {
            return datastore.key([constants.LOAD, parseInt(load.id, 10)]);
        })
        const allLoads = await datastore.get(loadKeys);
        loadsObj.loads = allLoads[0].map(ds.fromDatastore);
        addSelfToLoads(req, loadsObj.loads);
        res.status(200).json(loadsObj)
    }
});

// PUT /boats/:boat_id/loads/:load_id
// Assign load to boat
router.put('/:boat_id/loads/:load_id', checkJwt, async (req, res) => {
    const boat = await getBoat(req.params.boat_id);
    const load = await loads.getLoad(req.params.load_id);
    if (helpers.isArrayEmpty(boat) || helpers.isArrayEmpty(load)) {
        res.status(404).json({ 'Error': 'The specified boat and/or load does not exist' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    } else if (load[0].carrier != null || load[0].carrier != undefined) {
        res.status(400).json({ 'Error': 'The load is already loaded on another boat' });
    } else {
        await putLoad(req.params.boat_id, req.params.load_id);
        await loads.assignCarrier(boat[0], req.params.load_id);
        res.status(204).end();
    }
})

// DELETE /boats/:boat_id/loads/:load_id
// Remove load from boat
router.delete('/:boat_id/loads/:load_id', checkJwt, async (req, res) => {
    const boat = await getBoat(req.params.boat_id);
    const load = await loads.getLoad(req.params.load_id);
    const load_id = parseInt(req.params.load_id);
    // Check if boat or load does not exist
    if (helpers.isArrayEmpty(boat) || helpers.isArrayEmpty(load)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    }
    // Check if load is assigned to boat  
    else if (!isLoadAssigned(boat[0], load_id)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id is loaded with the load with this load_id' });
    } else {
        await removeLoad(boat[0], load_id);
        await loads.setCarrierToNull(load_id);
        res.status(204).end();
    }
})

// PUT /boats/:boat_id/
router.put('/:boat_id', checkJwt, async (req, res) => {
    // Check if boat with boat_id exits
    let boat = await getBoat(req.params.boat_id);
    if (helpers.isArrayEmpty(boat)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    } else {
        // If boat exits, run same checks as POSTing a boat
        if (req.get('content-type') !== 'application/json') {
            res.status(415).json({ 'Error': 'Server only accepts application/json data.' });
        } else if (!req.accepts(['*/*', 'application/json'])) {
            res.status(406).json({ 'Error': 'Server only sends application/json data.' });
        } else if (!helpers.isInputValid(req)) {
            res.status(400).json({ 'Error': 'Request has invalid data.' });
        } else {
            boat[0].loads.forEach((load) => {
                loads.setCarrierToNull(load.id)
            })
            await putBoat(req.params.boat_id, req.body.name, req.body.type, req.body.length, req.auth.sub);
            res.status(204).end();
        }
    }
})


// PATCH /boats/:boat_id/
router.patch('/:boat_id', checkJwt, async (req, res) => {
    // Check if boat with boat_id exits
    let boat = await getBoat(req.params.boat_id);
    if (helpers.isArrayEmpty(boat)) {
        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    } else {
        if (req.get('content-type') !== 'application/json') {
            res.status(415).json({ 'Error': 'Server only accepts application/json data.' });
        } else if (!helpers.isInputValidPatch(req)) {
            res.status(400).json({ 'Error': 'Request has invalid data.' });
        } else {
            await patchBoat(req.params.boat_id, req.body.name, req.body.type, req.body.length);
            res.status(204).end();
        }
    }
})

// DELETE /boats/:boat_id
router.delete('/:boat_id', checkJwt, async (req, res) => {
    const boat_id = parseInt(req.params.boat_id, 10);
    const boat = await getBoat(boat_id);
    if (boat[0] === undefined || boat[0] === null) {
        // The 0th element is undefined. This means there is no boat with this id
        res.status(404).json({ 'Error': 'No boat with this boat_id exists' });
    } else if (boat[0].owner && boat[0].owner !== req.auth.sub) {
        res.status(403).send({ 'Error': 'Forbidden' });
    } else {
        // For each load, set the carrier attrbute to null
        if (boat[0].loads.length > 0) {
            boat[0].loads.forEach(async (load) => {
                await loads.setCarrierToNull(load.id);
            })
        }
        await deleteBoat(boat_id);
        res.status(204).end();
    }
})

// DELETE /boats
router.delete('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// PUT /boats
router.put('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// PATCH /boats
router.patch('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// ----------------- End Controller Functions -------------------------------

module.exports = {
    router: router
}