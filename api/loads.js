const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('../services/datastore');

const datastore = ds.datastore;

router.use(bodyParser.json());

const constants = require('../services/constants');
const helpers = require('../services/helpers');

// ----------------- Begin Model Functions ------------------------------------
async function postLoad(volume, item, creation_date) {
    let key = datastore.key(constants.LOAD);
    let newLoad = {
        "volume": volume,
        "item": item,
        "carrier": null,
        "creation_date": creation_date,
    };
    const entity = {
        key: key,
        data: newLoad
    };
    await datastore.save(entity);
    return entity
}

async function getLoad(load_id) {
    const key = datastore.key([constants.LOAD, parseInt(load_id, 10)]);
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

async function assignCarrier(boat, load_id) {
    const load_key = datastore.key([constants.LOAD, parseInt(load_id, 10)]);
    const load = await datastore.get(load_key);
    load[0].carrier = {
        "id": boat.id
    }
    const entity = {
        key: load_key,
        data: load[0]
    };
    return datastore.save(entity)
}

async function setCarrierToNull(load_id) {
    const load_key = datastore.key([constants.LOAD, load_id]);
    const load = await datastore.get(load_key);
    load[0].carrier = null;
    const entity = {
        key: load_key,
        data: load[0]
    };
    return datastore.save(entity)
}

function deleteLoad(load_id) {
    const load_key = datastore.key([constants.LOAD, load_id]);
    return datastore.delete(load_key);
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

async function getAllLoads() {
    let q = datastore.createQuery(constants.LOAD).limit(5);
    const results = {};
    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    const entities = await datastore.runQuery(q)
    results.loads = entities[0].map(ds.fromDatastore);
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
        results.next = helpers.createNext(req, entities[1].endCursor);
    }
    return results;
}

async function getLoadCount() {
    let q = datastore.createQuery(constants.LOAD);
    const entities = await datastore.runQuery(q)
    return entities[0].length;
}

// ------------------ End Model Functions -------------------------------------

// ------------------ Start Helper Functions ----------------------------------
function isMissingParams(req) {
    if (req.body.volume == null || req.body.item == null || req.body.creation_date == null) {
        return true
    } else {
        return false
    }
}

function addSelfToCarrier(req, carrier) {
    if (carrier != null || carrier != undefined) {
        carrier.self = helpers.createSelfBoat(req, carrier.id);
    }
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

async function getAllLoads(req) {
    let q = datastore.createQuery(constants.LOAD).limit(5);
    const results = {};
    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    const entities = await datastore.runQuery(q)
    results.loads = entities[0].map(ds.fromDatastore);
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
        results.next = helpers.createNext(req, entities[1].endCursor);
    }
    return results;
}

function putLoad(id, volume, item, creation_date) {
    const key = datastore.key([constants.LOAD, parseInt(id, 10)]);
    let updatedLoad = {
        "volume": volume,
        "item": item,
        "carrier": null,
        "creation_date": creation_date,
    };
    const entity = {
        key: key,
        data: updatedLoad
    };
    return datastore.save(entity);
}

async function patchLoad(id, volume, item, creation_date) {
    const key = datastore.key([constants.LOAD, parseInt(id, 10)]);
    let load = await getLoad(parseInt(id, 10));
    if (volume != null || typeof (volume) !== 'undefined') {
        load[0].volume = volume;
    }
    if (item != null || typeof (item) !== 'undefined') {
        load[0].item = item;
    }
    if (creation_date != null || typeof (creation_date) !== 'undefined') {
        load[0].creation_date = creation_date;
    }
    const entity = {
        key: key,
        data: load[0]
    };
    return datastore.save(entity);
}

// ------------------- End Helper Functions -----------------------------------

// ----------------- Begin Controller Functions -------------------------------
// GET /loads
router.get('/', async (req, res) => {
    if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else {
        const results = await getAllLoads(req);
        // Add self url to all boats
        results.loads.forEach((load) => {
            // add self url to carrier
            addSelfToCarrier(req, load.carrier)
            load.self = helpers.createSelf(req, load.id)
        })
        results.total_items = await getLoadCount();
        res.status(200).json(results);
    }
});

// GET /loads/:load_id
router.get('/:load_id', async (req, res) => {
    const load = await getLoad(req.params.load_id);
    if (helpers.isArrayEmpty(load)) {
        res.status(404).json({ 'Error': 'No load with this load_id exists' });
    } else if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else {
        // add self url to carrier
        addSelfToCarrier(req, load[0].carrier)
        load[0].self = helpers.createSelf(req, req.params.load_id)
        res.status(200).json(load[0]);
    }
});

// POST /loads
router.post('/', async (req, res) => {
    if (isMissingParams(req)) {
        res.status(400).send({ "Error": "The request object is missing at least one of the required attributes" });
    } else if (!req.accepts(['*/*', 'application/json'])) {
        res.status(406).json({ 'Error': 'Server only sends application/json data.' });
    } else {
        const entity = await postLoad(req.body.volume, req.body.item, req.body.creation_date);
        res.status(201).json({
            id: parseInt(entity.key.id, 10),
            volume: entity.data.volume,
            item: entity.data.item,
            carrier: entity.data.carrier,
            creation_date: entity.data.creation_date,
            self: helpers.createSelf(req, entity.key.id)
        });
    }
});

// DELETE /loads/:load_id
router.delete('/:load_id', async (req, res) => {
    const load_id = parseInt(req.params.load_id, 10);
    const load = await getLoad(load_id);
    if (load[0] === undefined || load[0] === null) {
        res.status(404).json({ 'Error': 'No load with this load_id exists' });
    } else {
        if (load[0].carrier != null || load[0].carrier != undefined) {
            const boat = await getBoat(load[0].carrier.id);
            await removeLoad(boat[0], load_id);
        }
        await deleteLoad(load_id);
        res.status(204).end();
    }
})

// PUT /loads/:load_id
router.put('/:load_id', async (req, res) => {
    const load = await getLoad(req.params.load_id);
    if (helpers.isArrayEmpty(load)) {
        res.status(404).json({ 'Error': 'No load with this load_id exists' });
    } else {
        // Remove load from boat, if necessary
        if (load[0].carrier != null || load[0].carrier != undefined) {
            const boat = await getBoat(load[0].carrier.id);
            await removeLoad(boat[0], load[0].load_id);
        }
        await putLoad(req.params.load_id, req.body.volume, req.body.item, req.body.creation_date)
        res.status(204).end();
    }
})

// PATCH /loads/:load_id
router.patch('/:load_id', async (req, res) => {
    const load = await getLoad(req.params.load_id);
    if (helpers.isArrayEmpty(load)) {
        res.status(404).json({ 'Error': 'No load with this load_id exists' });
    } else {
        await patchLoad(req.params.load_id, req.body.volume, req.body.item, req.body.creation_date)
        res.status(204).end();
    }
})

// DELETE /loads
router.delete('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// PUT /loads
router.put('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// PATCH /loads
router.patch('/', (req, res) => {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
})

// ----------------- End Controller Functions -------------------------------

module.exports = {
    router: router,
    getLoad: getLoad,
    assignCarrier: assignCarrier,
    setCarrierToNull: setCarrierToNull
}