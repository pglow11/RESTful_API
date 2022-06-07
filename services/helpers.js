function createSelf(req, id) {
    if (req.hostname === 'localhost') {
        return req.protocol + "://" + `${req.hostname}:8080` + req.baseUrl + `/${id}`;
    } else {
        return req.protocol + "://" + req.hostname + req.baseUrl + `/${id}`;
    }
}

function createSelfLoad(req, id) {
    if (req.hostname === 'localhost') {
        return req.protocol + "://" + `${req.hostname}:8080` + `/loads/${id}`;
    } else {
        return req.protocol + "://" + req.hostname + `/loads/${id}`;
    }
}

function createSelfBoat(req, id) {
    if (req.hostname === 'localhost') {
        return req.protocol + "://" + `${req.hostname}:8080` + `/boats/${id}`;
    } else {
        return req.protocol + "://" + req.hostname + `/boats/${id}`;
    }
}


function isArrayEmpty(array) {
    if (array[0] === undefined || array[0] === null) {
        return true;
    } else {
        return false;
    }
}

function addSelf(req, item) {
    item.self = createSelf(req, item.id);
    return item;
}

function createNext(req, endCursor) {
    if (req.hostname === 'localhost') {
        return req.protocol + "://" + `${req.hostname}:8080` + req.baseUrl + "?cursor=" + endCursor;

    } else {
        return req.protocol + "://" + req.hostname + req.baseUrl + "?cursor=" + endCursor;
    }
}

function isInputValid(req) {
    if (isMissingParams(req)) {
        return false;
    } else if (isNameLong(req.body.name)) {
        return false;
    } else if (hasExtraParams(req.body)) {
        return false;
    } else if (hasIncorrectTypes(req.body.name, req.body.type, req.body.length)) {
        return false;
    } else {
        return true;
    }
}

function isMissingParams(req) {
    // Ensure all 3 parameters (name, type, length) are included
    if (req.body.name == null || req.body.type == null || req.body.length == null) {
        return true
    } else {
        return false
    }
}

function isInputValidPatch(req) {
    if (isMissingAllParams(req)) {
        return false;
    } else if (req.body.name != null && isNameLong(req.body.name)) {
        return false;
    } else if (hasExtraParams(req.body)) {
        return false;
    }
    else if (hasIncorrectTypesPatch(req.body.name, req.body.type, req.body.length)) {
        return false;
    }
    else {
        return true;
    }
}

function isMissingAllParams(req) {
    // Ensure all 3 parameters (name, type, length) are included
    if (req.body.name == null && req.body.type == null && req.body.length == null) {
        return true
    } else {
        return false
    }
}

function isNameLong(name) {
    // If string.length is > 50, return true.
    return name.length > 50;
}

function hasExtraParams(object) {
    let keys = Object.keys(object);
    for (let key of keys) {
        if (key !== 'name' && key !== 'type' && key !== 'length') {
            return true;
        }
    }
    return false;
}

function hasIncorrectTypes(name, type, length) {
    if (typeof (name) !== 'string' ||
        typeof (type) !== 'string' ||
        typeof (length) !== 'number') {
        return true;
    }
    else {
        return false;
    }
}

function hasIncorrectTypesPatch(name, type, length) {
    if (name != null && typeof (name) !== 'string') {
        return true;
    }
    if (type != null && typeof (type) !== 'string') {
        return true;
    }
    if (length != null && typeof (length) !== 'number') {
        return true;
    }
    return false;
}

function isDuplicateName(nameArray, nameToCheck) {
    return nameArray.includes(nameToCheck)
}

module.exports = {
    createSelf: createSelf,
    isArrayEmpty: isArrayEmpty,
    addSelf: addSelf,
    createSelfLoad: createSelfLoad,
    createSelfBoat: createSelfBoat,
    createNext: createNext,
    isInputValid: isInputValid,
    isInputValidPatch: isInputValidPatch,
    isDuplicateName: isDuplicateName
}