function define(name, value) {
    Object.defineProperty(exports, name, {
        value: value,
        enumerable: true
    });
}

define("BOAT", "Boat");
define("LOAD", "Load");
define("USER", "User");
define("DOMAIN", "cs493-spring2022.us.auth0.com");