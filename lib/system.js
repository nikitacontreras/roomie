const fs = require("fs")
files = {}
fs.readdirSync(`${__dirname}/systems`)
    .filter((module) => {
        return module.slice(module.length - 3) === '.js';
    })
    .forEach((module) => {
        files[module.split(".")[0]] = require(`${__dirname}/systems/` + module);
    });
module.exports.systems = files
