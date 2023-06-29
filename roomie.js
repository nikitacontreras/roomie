String.prototype.hexEncode = function () {
    var hex, i;

    var result = "";
    for (i = 0; i < this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000" + hex).slice(-4);
    }

    return result
}


const fs = require('fs');

let rom;
let system;
const regions = {
    nds: {
        "A": "asia",
        "C": "china",
        "P": "europe",
        "E": "americas",
        "J": "japan",
        "F": "french",
        "H": "dutch",
        "I": "italian",
        "J": "japanese",
        "K": "korean",
        "L": "usa#2",
        "M": "swedish",
        "N": "norwegian",
        "O": "international",
        "Q": "danish",
        "R": "russian",
        "S": "spanish",
        "T": "usa+aus",
        "U": "australia",
        "V": "eur+aus",
        "W": "europe#3",
        "X": "europe#4",
        "Y": "europe#5",
        "Z": "europe#5"

    },
    gba: {
        "J": "japan",
        "E": "english",
        "P": "europe",
        "D": "german",
        "F": "french",
        "I": "italian",
        "S": "spanish"
    },
    gb: {
        0: "japan",
        1: "overseas"
    },
    snes: {
        0: "japan",
        1: "americas",
        2: "europe"
    }
}
exports.load = (path) => {
    rom = fs.readFileSync(path)
    system = path.split(".")[path.split().length]
};

exports.name = () => {
    switch (system) {
        case "nds":
            return rom.slice(0x0, 0xB).toString().trim()
        case "gba":
            return rom.slice(0xA0, 0xA0 + 12).toString().trim()
        case "gb":
            return rom.slice(0x134, 0x134 + 9).toString().trim()
        case "sfc":
            return rom.slice(0xFFC0, 0xFFC0 + 21).toString().trim()
        case "n64":
            return rom.slice(0x20, 0x20 + 14).toString().match(/.{1,2}/g).reverse().join('').split("").reverse().join("").trim()
    }
}

exports.gamecode = () => {
    switch (system) {
        case "nds":
            return rom.slice(0xD, 0xD + 2).toString()
        case "gba":
            return rom.slice(0xAD, 0xAD + 2).toString()
    }
}
exports.version = () => {

}

exports.gameid = () => {
    switch (system) {
        case "nds":
            return "NTR-" + rom.slice(0xC, 0xC + 4).toString()
        case "gba":
            return "AGB-" + rom.slice(0xAC, 0xAC + 4).toString()
    }
}

exports.cartridge = () => {
    switch (system) {
        case "nds":
            return {
                type: ""
            }
        case "sfc":
            return {
                rom: 2 ** (2 ^ (rom[0xFFD7])) * 1000,
                ram: 2 ** (2 ^ (rom[0xFFD8])) * 1000
            }
    }
}

exports.region = () => {
    switch (system) {
        case "nds":
            return regions.nds[(this.gameid()[this.gameid().length - 1])]
        case "gba":
            return regions.gba[(this.gameid()[this.gameid().length - 1])]
        case "gb":
            return regions.gb[rom[0x14A].toString()]
        case "sfc":
            return regions.snes[rom[0xFFD9].toString()]
    }
}
